import { useCallback, useEffect, useRef } from 'react';

import { supabase } from '../lib/supabase';
import { friendlyAiError } from '../lib/edgeError';
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
import { useParams } from 'react-router-dom';

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
  type: 'text' | 'tool_call' | 'tool_result' | 'error' | 'done' | 'unavailable_modules' | 'conversation';
  content?: string;
  tool_call_id?: string;
  name?: string;
  arguments?: Record<string, unknown>;
  success?: boolean;
  summary?: string;
  message?: string;
  message_id?: string;
  modules?: string[];
  conversation_id?: string;
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

export type NytaChatSource = 'route' | 'modal';

export interface UseNytaChatReturn {
  messages: NytaChatMessage[];
  isStreaming: boolean;
  pendingToolCalls: PendingToolCall[];
  rateLimitInfo: { count: number; limit: number; resetAt: string | null } | null;
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  error: string | null;
  unavailableModules: string[];
  conversationId: string | null;
  selectConversation: (id: string) => Promise<void>;
  startNewConversation: () => void;
  sendMessage: (text: string) => void;
  confirmTool: (toolCallId: string) => void;
  cancelTool: (toolCallId: string) => void;
  loadOlderMessages: () => void;
  clearConversation: () => void;
  dismissError: () => void;
}

/**
 * O chat da Nyta — usado tanto pela página em tela cheia quanto pelo modal flutuante.
 *
 * A única diferença real entre os dois sempre foi de ONDE vem o artista e se a requisição
 * carrega o módulo em que a pessoa está. Mesmo assim viveram como dois arquivos de ~670 linhas
 * copiados um do outro, e as correções foram entrando só num deles: a guarda de limite diário
 * na origem, a leitura dos headers X-Daily-*, o clear sem race — tudo isso existia no do modal
 * e faltava no da página. Esta versão unificada parte do mais completo dos dois.
 *
 * `source`:
 *  - 'route' (padrão): artista vem da URL (/artists/:id/nyta).
 *  - 'modal': artista vem do nytaModalStore e a requisição leva module_context, que diz à Nyta
 *    de qual tela a pessoa está falando.
 */
export function useNytaChat(
  source: NytaChatSource = 'route',
  // Avisa quando o servidor grava numa conversa — a barra lateral usa pra recarregar a lista
  // assim que uma conversa nova nasce (ela só existe no banco a partir da primeira mensagem).
  onConversation?: (conversationId: string) => void,
): UseNytaChatReturn {
  const { id: routeArtistId } = useParams<{ id: string }>();
  const modalArtistId = useNytaModalStore((s) => s.moduleContext.artistId);
  const artistId = source === 'modal' ? modalArtistId : routeArtistId;
  const dispatch = useAppDispatch();

  const messages = useAppSelector((s) => s.nytaChat.messages);
  const isStreaming = useAppSelector((s) => s.nytaChat.isStreaming);
  const pendingToolCalls = useAppSelector((s) => s.nytaChat.pendingToolCalls);
  const rateLimitInfo = useAppSelector((s) => s.nytaChat.rateLimitInfo);
  const loadingHistory = useAppSelector((s) => s.nytaChat.loadingHistory);
  const hasMoreHistory = useAppSelector((s) => s.nytaChat.hasMoreHistory);
  const error = useAppSelector((s) => s.nytaChat.error);
  const conversationId = useAppSelector((s) => s.nytaChat.conversationId);
  const unavailableModules = useAppSelector((s) => s.nytaChat.unavailableModules);

  // Abort controller ref for cancelling in-flight streams
  const abortRef = useRef<AbortController | null>(null);

  // Em ref pra que trocar o callback não recrie processStream (e com ele todo o sendMessage).
  const onConversationRef = useRef(onConversation);
  onConversationRef.current = onConversation;

  // ─── Carregar as mensagens de uma conversa ─────────────────────────────────

  // Traz a última página de mensagens da conversa pedida. Usado tanto na carga inicial quanto
  // ao trocar de conversa pela barra lateral.
  const loadConversation = useCallback(async (convId: string, cancelled?: () => boolean) => {
    dispatch(setConversationId(convId));
    const { data, error: queryError } = await supabase
      .from('nyta_messages')
      .select('id, conversation_id, role, content, tool_calls, tool_results, created_at')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: false })
      .limit(PAGE_SIZE);
    if (cancelled?.()) return;

    if (queryError) {
      dispatch(setError('Erro ao carregar a conversa.'));
      return;
    }
    dispatch(prependMessages((data ?? []).reverse().map(mapRowToMessage)));
    if ((data?.length ?? 0) < PAGE_SIZE) dispatch(setHasMoreHistory(false));
  }, [dispatch]);

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
        // Abre na conversa mexida por último. O `.limit(1)` antes do `.maybeSingle()` não é
        // enfeite: agora que um artista pode ter várias conversas, o maybeSingle sozinho
        // recebe mais de uma linha e devolve ERRO — o mesmo tipo de armadilha que já derrubou
        // o webhook da Asaas.
        const { data: conv } = await supabase
          .from('nyta_conversations')
          .select('id')
          .eq('artist_id', artistId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (cancelled) return;

        if (!conv) {
          dispatch(setHasMoreHistory(false));
          return;
        }
        await loadConversation(conv.id, () => cancelled);
      } catch {
        if (!cancelled) dispatch(setError('Erro ao carregar a conversa.'));
      } finally {
        if (!cancelled) dispatch(setLoadingHistory(false));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [artistId, dispatch, loadConversation]);

  // ─── Trocar de conversa / começar uma nova ─────────────────────────────────

  const selectConversation = useCallback(async (convId: string) => {
    if (convId === conversationId) return;
    abortRef.current?.abort();
    dispatch(clearMessages());
    dispatch(setLoadingHistory(true));
    try {
      await loadConversation(convId);
    } finally {
      dispatch(setLoadingHistory(false));
    }
  }, [conversationId, dispatch, loadConversation]);

  // Conversa nova é só uma tela em branco: a linha no banco nasce com a primeira mensagem, no
  // servidor. Criar aqui encheria a lista de conversas vazias a cada clique.
  const startNewConversation = useCallback(() => {
    abortRef.current?.abort();
    dispatch(clearMessages());
    dispatch(setConversationId(null));
    dispatch(setHasMoreHistory(false));
  }, [dispatch]);

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

              // Em qual conversa a resposta está sendo gravada. Importa quando a mensagem saiu
              // sem conversation_id (conversa nova): é assim que a tela descobre o id recém
              // criado, pra próxima mensagem cair na mesma conversa e a barra lateral marcá-la
              // como a ativa.
              case 'conversation':
                if (event.conversation_id) {
                  dispatch(setConversationId(event.conversation_id));
                  onConversationRef.current?.(event.conversation_id);
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

      // module_context diz à Nyta de qual tela a pessoa está falando — faz sentido no modal,
      // que abre por cima de um módulo. Na página em tela cheia o módulo É o chat, então o
      // contexto seria sempre o mesmo e não acrescenta nada ao prompt.
      const { moduleContext } = useNytaModalStore.getState();
      const enrichedBody = source === 'modal'
        ? {
            ...body,
            module_context: {
              module: moduleContext.module,
              artist_id: moduleContext.artistId,
              artist_name: moduleContext.artistName,
              raw_path: moduleContext.rawPath,
            },
          }
        : body;

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
    [dispatch, source]
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

        // body.error vem escrito para desenvolvedor (ex.: "Groq error 404: ... model_not_found").
        // Vai pro console; o artista lê uma frase que diz o que aconteceu e o que fazer.
        dispatch(setError(friendlyAiError(body?.error || `HTTP ${response.status}`, 'nyta-chat')));
      } catch {
        dispatch(setError(friendlyAiError(`HTTP ${response.status}`, 'nyta-chat')));
      }

      return true;
    },
    [dispatch]
  );

  // ─── sendMessage ──────────────────────────────────────────────────────────

  const sendMessage = useCallback(
    async (text: string) => {
      if (!artistId || !text.trim()) return;

      // Guarda do limite diário NA ORIGEM: vale pra QUALQUER entrada (input do chat, chips do
      // Dashboard, "Nova estratégia/tarefa" do Plano de Ação). Sem isso, as entradas externas
      // (openWithPrompt) mandavam a mensagem otimista mesmo no limite — parecia um bypass.
      // O servidor já bloqueia (429), mas aqui evitamos a mensagem-fantasma e o reset visual.
      if (rateLimitInfo && rateLimitInfo.count >= rateLimitInfo.limit) {
        return;
      }

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
        // Sem conversationId a mensagem abre uma conversa nova no servidor, que responde com
        // o id no evento SSE 'conversation'.
        ...(conversationId ? { conversation_id: conversationId } : {}),
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

      // Contador de uso diário (header da resposta) → selo "X/limite" ao vivo no header.
      const dc = response.headers.get('X-Daily-Count');
      const dl = response.headers.get('X-Daily-Limit');
      if (dc != null && dl != null) {
        dispatch(setRateLimitInfo({ count: Number(dc), limit: Number(dl), resetAt: null }));
      }

      dispatch(updateMessage({ id: userMsgId, status: 'sent' }));
      await processStream(response, assistantMsgId);
    },
    [artistId, conversationId, dispatch, postToNytaChat, handleErrorResponse, processStream, rateLimitInfo]
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
        ...(conversationId ? { conversation_id: conversationId } : {}),
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
    [artistId, conversationId, dispatch, postToNytaChat, handleErrorResponse, processStream]
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
        ...(conversationId ? { conversation_id: conversationId } : {}),
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
    [artistId, conversationId, dispatch, postToNytaChat, handleErrorResponse, processStream]
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
    // Limpa a UI IMEDIATAMENTE (otimista). Isso evita uma race: se o DELETE no banco
    // demorasse e o clearMessages só rodasse DEPOIS, ele apagaria uma mensagem que o
    // artista mandou logo após clicar em "Limpar" — a resposta sumia (chat parecia travado).
    // Limpando antes, um envio seguinte já parte de um estado limpo e não é afetado.
    dispatch(clearMessages());
    const cutoff = new Date().toISOString();

    try {
      let convId = conversationId;
      if (!convId) {
        const { data: conv } = await supabase
          .from('nyta_conversations')
          .select('id')
          .eq('artist_id', artistId)
          .maybeSingle();

        if (!conv) return;
        convId = conv.id;
        dispatch(setConversationId(convId));
      }

      // Apaga só o que existia ANTES do clear: uma mensagem nova enviada em seguida
      // (created_at > cutoff) é preservada no banco.
      const { error: deleteError } = await supabase
        .from('nyta_messages')
        .delete()
        .eq('conversation_id', convId)
        .lte('created_at', cutoff);

      if (deleteError) {
        dispatch(setError('Erro ao limpar conversa.'));
      }
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
    unavailableModules,
    conversationId,
    selectConversation,
    startNewConversation,
    sendMessage,
    confirmTool,
    cancelTool,
    loadOlderMessages,
    clearConversation,
    dismissError,
  };
}
