import { FC, useCallback, useEffect, useRef } from 'react';
import { FiAlertTriangle } from 'react-icons/fi';
import Markdown from 'react-markdown';

import { NytaBubble, UserBubble, TypingIndicator } from '../../Wizard/chat/ChatMessage';
import { NytaAvatar } from '../../Wizard/chat/nytaPersona';
import { NytaChatMessage, PendingToolCall } from '../../../store/slices/nytaChat';
import { sanitizeNytaContent } from '../../../utils/sanitizeNytaContent';
import { ToolConfirmationCard } from './ToolConfirmationCard';

import './MessageList.scss';

// ─── Props ────────────────────────────────────────────────────────────────────

export interface MessageListProps {
  messages: NytaChatMessage[];
  isStreaming: boolean;
  loadingHistory: boolean;
  hasMoreHistory: boolean;
  pendingToolCalls?: PendingToolCall[];
  onLoadOlder: () => void;
  onConfirmTool?: (toolCallId: string) => void;
  onCancelTool?: (toolCallId: string) => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const AUTO_SCROLL_THRESHOLD = 100; // px from bottom to suppress auto-scroll

// ─── Component ────────────────────────────────────────────────────────────────

export const MessageList: FC<MessageListProps> = ({
  messages,
  isStreaming,
  loadingHistory,
  hasMoreHistory,
  pendingToolCalls = [],
  onLoadOlder,
  onConfirmTool,
  onCancelTool,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const userScrolledUpRef = useRef(false);
  const prevMessageCountRef = useRef(messages.length);

  // ─── Determine if user is near bottom ───────────────────────────────────

  const isNearBottom = useCallback((): boolean => {
    const container = containerRef.current;
    if (!container) return true;
    const { scrollTop, scrollHeight, clientHeight } = container;
    return scrollHeight - scrollTop - clientHeight <= AUTO_SCROLL_THRESHOLD;
  }, []);

  // ─── Auto-scroll to bottom when new messages arrive ─────────────────────

  useEffect(() => {
    const newCount = messages.length;
    const hadNewMessages = newCount > prevMessageCountRef.current;
    prevMessageCountRef.current = newCount;

    if (hadNewMessages && !userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // Mantém a lista fixada no fim durante o streaming e ao terminar a resposta.
  // IMPORTANTE: durante o streaming usamos rolagem INSTANTÂNEA (não 'smooth'): cada
  // novo pedaço de texto dispararia uma nova animação suave que interrompe a anterior,
  // fazendo a rolagem "correr atrás" e nunca alcançar o fim (resposta cortada pela metade).
  // E quando o streaming termina, o markdown ainda reflui (listas/parágrafos crescem a
  // altura) — por isso fazemos um ajuste final no próximo frame para assentar no fim.
  const prevStreamingRef = useRef(isStreaming);
  const lastMessageContent = messages[messages.length - 1]?.content;
  useEffect(() => {
    const justEnded = prevStreamingRef.current && !isStreaming;
    prevStreamingRef.current = isStreaming;
    if (userScrolledUpRef.current) return;

    if (isStreaming) {
      bottomRef.current?.scrollIntoView({ behavior: 'auto' });
    } else if (justEnded) {
      requestAnimationFrame(() => {
        if (!userScrolledUpRef.current) {
          bottomRef.current?.scrollIntoView({ behavior: 'auto' });
        }
      });
    }
  }, [isStreaming, lastMessageContent]);

  // Auto-scroll when tool confirmation cards appear
  useEffect(() => {
    if (pendingToolCalls.length > 0 && !userScrolledUpRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [pendingToolCalls.length]);

  // ─── Scroll event to track user scroll position ─────────────────────────

  const handleScroll = useCallback(() => {
    userScrolledUpRef.current = !isNearBottom();
  }, [isNearBottom]);

  // ─── IntersectionObserver for infinite scroll up ────────────────────────

  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = containerRef.current;
    if (!sentinel || !container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const [entry] = entries;
        if (entry.isIntersecting && hasMoreHistory && !loadingHistory) {
          onLoadOlder();
        }
      },
      {
        root: container,
        rootMargin: '100px 0px 0px 0px',
        threshold: 0,
      }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMoreHistory, loadingHistory, onLoadOlder]);

  // ─── Preserve scroll position when prepending older messages ────────────

  const prevScrollHeightRef = useRef(0);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    prevScrollHeightRef.current = container.scrollHeight;
  });

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // If messages were prepended (scroll height grew from the top), preserve position
    const scrollDiff = container.scrollHeight - prevScrollHeightRef.current;
    if (scrollDiff > 0 && container.scrollTop < 50) {
      container.scrollTop += scrollDiff;
    }
  }, [messages.length]);

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div
      className="nyta-message-list"
      ref={containerRef}
      onScroll={handleScroll}
    >
      {/* Sentinel for infinite scroll (top) */}
      <div ref={sentinelRef} className="nyta-message-list__sentinel" />

      {/* Loading spinner at the top */}
      {loadingHistory && (
        <div className="nyta-message-list__loading">
          <div className="nyta-message-list__spinner" />
        </div>
      )}

      {/* Messages */}
      {messages.map((msg) => {
        // Remove markup de tool-call que alguns modelos vazam como texto (ver sanitizeNytaContent).
        const content =
          msg.role === 'assistant' ? sanitizeNytaContent(msg.content) : msg.content || '';

        // Mensagens de assistant vazias: normalmente são tool-call (o card aparece à parte) ou
        // placeholder de streaming — essas pulamos. MAS se a msg TINHA texto e foi sanitizada a
        // vazio (ex.: o modelo respondeu só com um bloco JSON que removemos) e NÃO é tool-call,
        // mostramos um fallback em vez de sumir silenciosamente (senão o chat parece travado).
        if (msg.role === 'assistant' && !content && msg.status !== 'error') {
          const isToolCall = !!msg.toolCalls?.length;
          const hadRawText = !!(msg.content && msg.content.trim());
          if (!isToolCall && hadRawText) {
            return (
              <div
                key={msg.id}
                className="nyta-message-list__item nyta-message-list__item--assistant"
              >
                <NytaBubble>
                  <span style={{ opacity: 0.75 }}>
                    Hmm, não consegui formular essa resposta direito. Pode reformular o pedido?
                  </span>
                </NytaBubble>
              </div>
            );
          }
          return null;
        }

        return (
          <div
            key={msg.id}
            className={`nyta-message-list__item nyta-message-list__item--${msg.role}`}
          >
            {msg.role === 'assistant' && msg.status === 'error' && !content ? (
              <div className="nyta-message-list__error-bubble">
                <FiAlertTriangle size={14} />
                <span>Não foi possível completar a resposta. Tente novamente.</span>
              </div>
            ) : msg.role === 'assistant' ? (
              <NytaBubble>
                <Markdown>{content}</Markdown>
              </NytaBubble>
            ) : msg.role === 'user' ? (
              <UserBubble>{content}</UserBubble>
            ) : null}
          </div>
        );
      })}

      {/* Typing indicator during streaming (before content starts arriving) */}
      {isStreaming &&
        (!messages.length ||
          messages[messages.length - 1]?.role !== 'assistant' ||
          !messages[messages.length - 1]?.content) && (
        <div className="nyta-message-list__item nyta-message-list__item--assistant">
          <TypingIndicator />
        </div>
      )}

      {/* Tool Confirmation Cards (only pending ones) */}
      {pendingToolCalls.length > 0 && onConfirmTool && onCancelTool && (
        pendingToolCalls
          .filter((tc) => tc.status === 'pending')
          .map((tc) => (
            <div
              key={tc.toolCallId}
              className="nyta-message-list__item nyta-message-list__item--tool"
            >
              <div className="nyta-row">
                <NytaAvatar />
                <ToolConfirmationCard
                  toolCall={tc}
                  onConfirm={onConfirmTool}
                  onCancel={onCancelTool}
                />
              </div>
            </div>
          ))
      )}

      {/* Scroll anchor */}
      <div ref={bottomRef} className="nyta-message-list__bottom" />
    </div>
  );
};

export default MessageList;
