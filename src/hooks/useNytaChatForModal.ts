import { useCallback, useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';
import { useAppDispatch, useAppSelector } from '../store/store';
import {
  addMessage,
  updateMessage,
  setStreaming,
  addPendingToolCall,
  updateToolCallStatus,
  setRateLimitInfo,
  setLoadingHistory,
  setHasMoreHistory,
  setError,
  setUnavailableModules,
  clearMessages,
  resetConversation,
  prependMessages,
  setConversationId,
  type NytaChatMessage,
  type PendingToolCall,
} from '../store/slices/nytaChat';
import { useNytaModalStore } from '../stores/nytaModalStore';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const uid = () => crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 14);

const SUPABASE_URL =
  process.env.REACT_APP_SUPABASE_URL || 'https://tpwmzcgtidaxgxwqfxwf.supabase.co';

const PAGE_SIZE = 50;

type NytaMessageRow = {
  id: string;
  role: string;
  content: string | null;
  tool_calls: NytaChatMessage['toolCalls'] | null;
  tool_results: NytaChatMessage['toolResults'] | null;
  created_at: string;
};

const mapRowToMessage = (row: NytaMessageRow): NytaChatMessage => ({
  id: row.id,
  role: row.role as NytaChatMessage['role'],
  content: row.content,
  toolCalls: row.tool_calls ?? undefined,
  toolResults: row.tool_results ?? undefined,
  createdAt: row.created_at,
  status: 'sent' as const,
});

// ─── SSE Line Parser ──────────────────────────────────────────────────────────

interface SSEEvent {
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'unavailable_modules';
  content?: string;
  tool_call_id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  success?: boolean;
  summary?: string;
  message?: string;
  message_id?: string;
  modules?: string[];
}

function parseSSELine(line: string): SSEEvent | null {
  const trimmed = line.trim();
  if (!trimmed || !trimmed.startsWith('data:')) return null;
  const json = trimmed.slice(5).trim();
  if (!json) return null;
  try {
    return JSON.parse(json) as SSEEvent;
  } catch {
    return null;
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export interface UseNytaChatForModalReturn {
  messages: NytaChatMessage[];
  isStreaming: boolean;
  pendingToolCalls: PendingToolCall[];
  rateLimitInfo: { count: number; limit: number; resetAt: string | null } | null;
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  error: string | null;
  sendMessage: (text: string) => void;
  confirmTool: (toolCallId: string) => void;
  cancelTool: (toolCallId: string) => void;
  loadOlderMessages: () => void;
  clearConversation: () => void;
  dismissError: () => void;
}

/**
 * Versão do useNytaChat para o Floating Modal.
 * Usa artistId do moduleContext (nytaModalStore) em vez de useParams().
 * Inclui module_context no body das requisições.
 */
export function useNytaChatForModal(): UseNytaChatForModalReturn {
  const artistId = useNytaModalStore((s) => s.moduleContext.artistId);
  const dispatch = useAppDispatch();

  const messages = useAppSelector((s) => s.nytaChat.messages);
  const isStreaming = useAppSelector((s) => s.nytaChat.isStreaming);
  const pendingToolCalls = useAppSelector((s) => s.nytaChat.pendingToolCalls);
  const rateLimitInfo = useAppSelector((s) => s.nytaChat.rateLimitInfo);
  const loadingHistory = useAppSelector((s) => s.nytaChat.loadingHistory);
  const hasMoreHistory = useAppSelector((s) => s.nytaChat.hasMoreHistory);
  const error = useAppSelector((s) => s.nytaChat.error);
  const conversationId = useAppSelector((s) => s.nytaChat.conversationId);

  // Abort controller ref for cancelling in-flight streams
  const abortRef = useRef<AbortController | null>(null);

  // ─── Reset + carga inicial por artista ─────────────────────────────────────
  const lastArtistRef = useRef<string | null>(null);

  useEffect(() => {
    if (!artistId || lastArtistRef.current === artistId) return;
    lastArtistRef.current = artistId;

    abortRef.current?.abort();
    dispatch(resetConversation());
    dispatch(setLoadingHistory(true));

    let cancelled = false;
    (async () => {
      try {
        const { data: conv } = await supabase
          .from('nyta_conversations')
          .select('id')
          .eq('artist_id', artistId)
          .maybeSingle();
        if (cancelled) return;

        if (!conv) {
          dispatch(setHasMoreHistory(false));
          return;
        }
        dispatch(setConversationId(conv.id));

        const { data, error: queryError } = await supabase
          .from('nyta_messages')
          .select('id, conversation_id, role, content, tool_calls, tool_results, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(PAGE_SIZE);
        if (cancelled) return;

        if (queryError) {
          dispatch(setError('Erro ao carregar a conversa.'));
          return;
        }

        dispatch(prependMessages((data ?? []).reverse().map(mapRowToMessage)));
        if ((data?.length ?? 0) < PAGE_SIZE) {
          dispatch(setHasMoreHistory(false));
        }
      } catch {
        if (!cancelled) dispatch(setError('Erro ao carregar a conversa.'));
      } finally {
        if (!cancelled) dispatch(setLoadingHistory(false));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artistId, dispatch]);

  // ─── Get Auth Token ───────────────────────────────────────────────────────

  const getAccessToken = async (): Promise<string | null> => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  };

  // ─── Stream SSE Response ──────────────────────────────────────────────────

  const processStream = useCallback(
    async (response: Response, assistantMsgId: string) => {
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      let accumulatedContent = '';
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            const event = parseSSELine(line);
            if (!event) continue;

            switch (event.type) {
              case 'text':
                accumulatedContent += event.content || '';
                dispatch(
                  updateMessage({
                    id: assistantMsgId,
                    content: accumulatedContent,
                    status: 'sending',
                  })
                );
                break;

              case 'unavailable_modules':
                if (event.modules && event.modules.length > 0) {
                  dispatch(setUnavailableModules(event.modules));
                }
                break;

              case 'tool_call':
                dispatch(
                  addPendingToolCall({
                    toolCallId: event.tool_call_id!,
                    name: event.name!,
                    arguments: event.arguments || {},
                    status: 'pending',
                  })
                );
                break;

              case 'tool_result':
                if (event.tool_call_id) {
                  dispatch(
                    updateToolCallStatus({
                      toolCallId: event.tool_call_id,
                      status: event.success ? 'done' : 'error',
                    })
                  );
                }
                break;

              case 'error':
                dispatch(setError(event.message || 'Erro ao processar mensagem'));
                dispatch(
                  updateMessage({
                    id: assistantMsgId,
                    status: 'error',
                    content: accumulatedContent || event.message || null,
                  })
                );
                break;

              case 'done':
                dispatch(
                  updateMessage({
                    id: assistantMsgId,
                    status: 'sent',
                    ...(event.message_id ? { id: event.message_id } : {}),
                  })
                );
                break;
            }
          }
        }

        // Process remaining buffer
        if (buffer.trim()) {
          const event = parseSSELine(buffer);
          if (event?.type === 'done') {
            dispatch(
              updateMessage({
                id: assistantMsgId,
                status: 'sent',
                ...(event.message_id ? { id: event.message_id } : {}),
              })
            );
          }
        }
      } finally {
        dispatch(setStreaming(false));
      }
    },
    [dispatch]
  );

  // ─── POST to Edge Function (with module_context) ──────────────────────────

  const postToNytaChat = useCallback(
    async (body: Record<string, unknown>): Promise<Response | null> => {
      const token = await getAccessToken();
      if (!token) {
        dispatch(setError('Sessão expirada. Faça login novamente.'));
        return null;
      }

      const controller = new AbortController();
      abortRef.current = controller;

      // Attach module_context from the modal store
      const { moduleContext } = useNytaModalStore.getState();
      const enrichedBody = {
        ...body,
        module_context: {
          module: moduleContext.module,
          artist_id: moduleContext.artistId,
          artist_name: moduleContext.artistName,
          raw_path: moduleContext.rawPath,
        },
      };

      try {
        const response = await fetch(`${SUPABASE_URL}/functions/v1/nyta-chat`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(enrichedBody),
          signal: controller.signal,
        });

        return response;
      } catch (err: any) {
        if (err.name === 'AbortError') return null;
        dispatch(setError('Erro de conexão. Verifique sua internet.'));
        return null;
      }
    },
    [dispatch]
  );

  // ─── Handle Non-200 Responses ─────────────────────────────────────────────

  const handleErrorResponse = useCallback(
    async (response: Response): Promise<boolean> => {
      if (response.ok) return false;

      try {
        const body = await response.json();

        if (response.status === 429) {
          dispatch(
            setRateLimitInfo({
              count: 100,
              limit: 100,
              resetAt: body.resetAt || null,
            })
          );
          dispatch(setError('Limite diário de mensagens atingido.'));
          return true;
        }

        if (response.status === 403) {
          dispatch(
            setError(
              body.error === 'subscription_required'
                ? 'subscription_required'
                : 'Acesso negado.'
            )
          );
          return true;
        }

        dispatch(setError(body.error || `Erro ${response.status}`));
      } catch {
        dispatch(setError(`Erro ${response.status}`));
      }

      return true;
    },
    [dispatch]
  );

  // ─── sendMessage ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!artistId || !text.trim()) return;

      dispatch(setError(null));

      const userMsgId = uid();
      const userMessage: NytaChatMessage = {
        id: userMsgId,
        role: 'user',
        content: text.trim(),
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      dispatch(addMessage(userMessage));
      dispatch(setStreaming(true));

      const assistantMsgId = uid();
      const assistantMessage: NytaChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      dispatch(addMessage(assistantMessage));

      const response = await postToNytaChat({
        action: 'message',
        message: text.trim(),
        artist_id: artistId,
      });

      if (!response) {
        dispatch(updateMessage({ id: userMsgId, status: 'error' }));
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      const isError = await handleErrorResponse(response);
      if (isError) {
        dispatch(updateMessage({ id: userMsgId, status: 'error' }));
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      dispatch(updateMessage({ id: userMsgId, status: 'sent' }));
      await processStream(response, assistantMsgId);
    },
    [artistId, dispatch, postToNytaChat, handleErrorResponse, processStream]
  );

  // ─── confirmTool ──────────────────────────────────────────────────────────

  const confirmTool = useCallback(
    async (toolCallId: string) => {
      if (!artistId) return;

      dispatch(updateToolCallStatus({ toolCallId, status: 'executing' }));
      dispatch(setStreaming(true));

      const assistantMsgId = uid();
      const assistantMessage: NytaChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      dispatch(addMessage(assistantMessage));

      const response = await postToNytaChat({
        action: 'confirm',
        tool_call_id: toolCallId,
        approved: true,
        artist_id: artistId,
      });

      if (!response) {
        dispatch(updateToolCallStatus({ toolCallId, status: 'error' }));
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      const isError = await handleErrorResponse(response);
      if (isError) {
        dispatch(updateToolCallStatus({ toolCallId, status: 'error' }));
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      dispatch(updateToolCallStatus({ toolCallId, status: 'confirmed' }));
      await processStream(response, assistantMsgId);
    },
    [artistId, dispatch, postToNytaChat, handleErrorResponse, processStream]
  );

  // ─── cancelTool ───────────────────────────────────────────────────────────

  const cancelTool = useCallback(
    async (toolCallId: string) => {
      if (!artistId) return;

      dispatch(updateToolCallStatus({ toolCallId, status: 'cancelled' }));
      dispatch(setStreaming(true));

      const assistantMsgId = uid();
      const assistantMessage: NytaChatMessage = {
        id: assistantMsgId,
        role: 'assistant',
        content: '',
        createdAt: new Date().toISOString(),
        status: 'sending',
      };
      dispatch(addMessage(assistantMessage));

      const response = await postToNytaChat({
        action: 'confirm',
        tool_call_id: toolCallId,
        approved: false,
        artist_id: artistId,
      });

      if (!response) {
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      const isError = await handleErrorResponse(response);
      if (isError) {
        dispatch(updateMessage({ id: assistantMsgId, status: 'error', content: null }));
        dispatch(setStreaming(false));
        return;
      }

      await processStream(response, assistantMsgId);
    },
    [artistId, dispatch, postToNytaChat, handleErrorResponse, processStream]
  );

  // ─── loadOlderMessages ────────────────────────────────────────────────────

  const loadOlderMessages = useCallback(async () => {
    if (!artistId || loadingHistory || !hasMoreHistory) return;

    dispatch(setLoadingHistory(true));
    dispatch(setError(null));

    try {
      const token = await getAccessToken();
      if (!token) {
        dispatch(setError('Sessão expirada. Faça login novamente.'));
        dispatch(setLoadingHistory(false));
        return;
      }

      let convId = conversationId;
      if (!convId) {
        const { data: conv } = await supabase
          .from('nyta_conversations')
          .select('id')
          .eq('artist_id', artistId)
          .maybeSingle();

        if (!conv) {
          dispatch(setHasMoreHistory(false));
          dispatch(setLoadingHistory(false));
          return;
        }
        convId = conv.id;
        dispatch(setConversationId(convId));
      }

      const oldestMessage = messages[0];
      const cursor = oldestMessage?.createdAt;

      let query = supabase
        .from('nyta_messages')
        .select('id, conversation_id, role, content, tool_calls, tool_results, created_at')
        .eq('conversation_id', convId)
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

      if (cursor) {
        query = query.lt('created_at', cursor);
      }

      const { data, error: queryError } = await query;

      if (queryError) {
        dispatch(setError('Erro ao carregar mensagens anteriores.'));
        dispatch(setLoadingHistory(false));
        return;
      }

      if (!data || data.length === 0) {
        dispatch(setHasMoreHistory(false));
        dispatch(setLoadingHistory(false));
        return;
      }

      dispatch(prependMessages(data.reverse().map(mapRowToMessage)));

      if (data.length < PAGE_SIZE) {
        dispatch(setHasMoreHistory(false));
      }
    } catch {
      dispatch(setError('Erro ao carregar mensagens anteriores.'));
    } finally {
      dispatch(setLoadingHistory(false));
    }
  }, [artistId, loadingHistory, hasMoreHistory, conversationId, messages, dispatch]);

  // ─── clearConversation ────────────────────────────────────────────────────

  const clearConversation = useCallback(async () => {
    if (!artistId) return;

    dispatch(setError(null));

    try {
      let convId = conversationId;
      if (!convId) {
        const { data: conv } = await supabase
          .from('nyta_conversations')
          .select('id')
          .eq('artist_id', artistId)
          .maybeSingle();

        if (!conv) {
          dispatch(clearMessages());
          return;
        }
        convId = conv.id;
      }

      const { error: deleteError } = await supabase
        .from('nyta_messages')
        .delete()
        .eq('conversation_id', convId);

      if (deleteError) {
        dispatch(setError('Erro ao limpar conversa.'));
        return;
      }

      dispatch(clearMessages());
      dispatch(setConversationId(convId));
    } catch {
      dispatch(setError('Erro ao limpar conversa.'));
    }
  }, [artistId, conversationId, dispatch]);

  // ─── dismissError ──────────────────────────────────────────────────────────

  const dismissError = useCallback(() => {
    dispatch(setError(null));
  }, [dispatch]);

  // ─── Return ───────────────────────────────────────────────────────────────

  return {
    messages,
    isStreaming,
    pendingToolCalls,
    rateLimitInfo,
    loadingHistory,
    hasMoreHistory,
    error,
    sendMessage,
    confirmTool,
    cancelTool,
    loadOlderMessages,
    clearConversation,
    dismissError,
  };
}
