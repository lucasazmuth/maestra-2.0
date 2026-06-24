import { FC, PointerEvent as ReactPointerEvent, useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

import useIsMobile from '../../utils/isMobile';
import { useNytaModal } from '../../hooks/useNytaModal';
import { useNytaChatForModal } from '../../hooks/useNytaChatForModal';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PAYWALL_DISABLED, NYTA_SUGGESTIONS } from '../../constants/maestra';
import { useNytaModalStore } from '../../stores/nytaModalStore';
import { NytaModalHeader } from './NytaModalHeader';
import { NytaLockedFeatureView } from './NytaLockedFeatureView';
import { MessageList } from '../../pages/NytaChat/components/MessageList';
import { InputBar } from '../../pages/NytaChat/components/InputBar';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';

import styles from './NytaFloatingModal.module.scss';

// ─── Greeting text (empty state) ──────────────────────────────────────────────

const GREETING_TEXT =
  'Oi! Eu sou a Nyta, sua consultora estratégica aqui na Maestra. ' +
  'Pode me perguntar qualquer coisa sobre seu planejamento, catálogo, agenda ou equipe — ' +
  'e eu também posso executar ações por você, sempre com sua confirmação. Como posso te ajudar?';

// ─── Drag positioning ─────────────────────────────────────────────────────────

const POS_KEY = 'nyta_modal_pos';
const EDGE = 8; // folga mínima até a borda da viewport

interface Coords { top: number; left: number }

// Mantém o cartão dentro da viewport (com folga mínima nas bordas).
const clampToViewport = (left: number, top: number, w: number, h: number): Coords => ({
  left: Math.min(Math.max(EDGE, left), Math.max(EDGE, window.innerWidth - w - EDGE)),
  top: Math.min(Math.max(EDGE, top), Math.max(EDGE, window.innerHeight - h - EDGE)),
});

// ─── Component ────────────────────────────────────────────────────────────────

export const NytaFloatingModal: FC = () => {
  const navigate = useNavigate();
  const { isOpen, close, moduleContext } = useNytaModal();
  const pendingPrompt = useNytaModalStore((s) => s.pendingPrompt);
  const clearPendingPrompt = useNytaModalStore((s) => s.clearPendingPrompt);
  const entitlements = useEntitlements();
  const {
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
  } = useNytaChatForModal();

  const [isAnimatingOut, setIsAnimatingOut] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const prevOpenRef = useRef(false);
  const chatAreaRef = useRef<HTMLDivElement>(null);

  // ─── Drag (mover o cartão pela tela — desktop) ───────────────────────────────

  const isMobile = useIsMobile();
  const panelRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef<{ dx: number; dy: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [coords, setCoords] = useState<Coords | null>(() => {
    try {
      const saved = localStorage.getItem(POS_KEY);
      return saved ? (JSON.parse(saved) as Coords) : null;
    } catch {
      return null;
    }
  });

  // A posição padrão (canto inferior direito) vem do CSS — não calculamos por JS na abertura.
  // Medir o painel antes do conteúdo carregar dava um top/left errado na primeira abertura.
  // `coords` só passa a valer quando o usuário arrasta o cartão.

  // Ao abrir, se houver uma posição salva, garante que ela ainda cabe na viewport
  // (ex.: salva numa tela maior e reaberta numa menor) — senão o cartão abriria cortado.
  useEffect(() => {
    if (!isOpen || isMobile) return;
    setCoords((c) => {
      if (!c) return c; // sem posição salva → CSS cuida do canto inferior direito
      const el = panelRef.current;
      const w = el?.offsetWidth ?? 400;
      const h = el?.offsetHeight ?? Math.min(680, window.innerHeight - 112);
      return clampToViewport(c.left, c.top, w, h);
    });
  }, [isOpen, isMobile]);

  const handleDragMove = useCallback((e: PointerEvent) => {
    const el = panelRef.current;
    const off = dragOffset.current;
    if (!el || !off) return;
    setCoords(clampToViewport(e.clientX - off.dx, e.clientY - off.dy, el.offsetWidth, el.offsetHeight));
  }, []);

  const handleDragEnd = useCallback(() => {
    dragOffset.current = null;
    setIsDragging(false);
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
    // Persiste a última posição para a próxima sessão.
    setCoords((c) => {
      if (c) { try { localStorage.setItem(POS_KEY, JSON.stringify(c)); } catch { /* ignora */ } }
      return c;
    });
  }, [handleDragMove]);

  const handleDragStart = useCallback((e: ReactPointerEvent) => {
    const el = panelRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    dragOffset.current = { dx: e.clientX - rect.left, dy: e.clientY - rect.top };
    setIsDragging(true);
    window.addEventListener('pointermove', handleDragMove);
    window.addEventListener('pointerup', handleDragEnd);
  }, [handleDragMove, handleDragEnd]);

  // Remove listeners se o componente desmontar no meio de um arraste.
  useEffect(() => () => {
    window.removeEventListener('pointermove', handleDragMove);
    window.removeEventListener('pointerup', handleDragEnd);
  }, [handleDragMove, handleDragEnd]);

  // Reposiciona dentro da viewport quando a janela é redimensionada.
  useEffect(() => {
    if (isMobile) return;
    const onResize = () => setCoords((c) => {
      const el = panelRef.current;
      if (!c || !el) return c;
      return clampToViewport(c.left, c.top, el.offsetWidth, el.offsetHeight);
    });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [isMobile]);

  // ─── Animation state management ────────────────────────────────────────────

  useEffect(() => {
    if (isOpen && !prevOpenRef.current) {
      // Opening: make visible immediately, CSS transition handles slide-in
      setIsVisible(true);
      setIsAnimatingOut(false);
    } else if (!isOpen && prevOpenRef.current) {
      // Closing: trigger slide-out animation, then hide
      setIsAnimatingOut(true);
      const timer = setTimeout(() => {
        setIsVisible(false);
        setIsAnimatingOut(false);
      }, 250);
      return () => clearTimeout(timer);
    }
    prevOpenRef.current = isOpen;
  }, [isOpen]);

  // ─── Scroll restoration on reopen ────────────────────────────────────────────
  // When the modal transitions from closed to open and has existing messages,
  // scroll the MessageList to the bottom so the user sees the latest message.
  // Requirement 3.2: Close/reopen preserves messages and restores scroll.

  useEffect(() => {
    if (isOpen && chatAreaRef.current && messages.length > 0) {
      // Small delay to allow the CSS transition to start (visibility becomes visible)
      const timer = setTimeout(() => {
        const bottomAnchor = chatAreaRef.current?.querySelector(
          '.nyta-message-list__bottom'
        );
        if (bottomAnchor) {
          bottomAnchor.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  // Only trigger when isOpen becomes true (not on every message change)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  // ─── Escape key listener ───────────────────────────────────────────────────

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, close]);

  // ─── Pergunta pendente (chips do Dashboard) ──────────────────────────────────
  // Quando o modal abre com uma pergunta enfileirada (openWithPrompt), envia-a e limpa.

  useEffect(() => {
    if (isOpen && pendingPrompt) {
      sendMessage(pendingPrompt);
      clearPendingPrompt();
    }
  }, [isOpen, pendingPrompt, sendMessage, clearPendingPrompt]);

  // ─── Handlers ──────────────────────────────────────────────────────────────

  const handleNavigateToPlans = useCallback(() => {
    navigate('/assinatura');
    close();
  }, [navigate, close]);

  // A confirmação de limpar histórico é feita por um Popconfirm no header (padrão do sistema).

  // ─── Derived state ─────────────────────────────────────────────────────────

  const hasAccess = PAYWALL_DISABLED || entitlements.isPro;
  const showLockedView =
    !hasAccess || error === 'subscription_required';
  // No limite diário, o card do InputBar já comunica tudo — suprimimos o banner de topo
  // e os balões de erro da mensagem que não passou, pra não mostrar 3 erros ao mesmo tempo.
  const isRateLimited =
    !!rateLimitInfo && rateLimitInfo.count >= rateLimitInfo.limit;
  const showErrorBanner =
    error && error !== 'subscription_required' && !isRateLimited;
  const hasMessages = messages.length > 0;

  // ─── Don't render anything if never opened ─────────────────────────────────

  if (!isVisible && !isOpen) return null;

  // ─── Compute container class ───────────────────────────────────────────────

  const containerClassName = [
    styles.container,
    isOpen && !isAnimatingOut ? styles.open : '',
    isAnimatingOut ? styles.closing : '',
    isDragging ? styles.dragging : '',
  ]
    .filter(Boolean)
    .join(' ');

  // No desktop, a posição vem do arraste (top/left); no mobile fica em tela cheia (CSS).
  const panelStyle =
    !isMobile && coords ? { top: coords.top, left: coords.left, right: 'auto', bottom: 'auto' } : undefined;

  return (
    <div
      ref={panelRef}
      className={containerClassName}
      style={panelStyle}
      role="dialog"
      aria-label="Nyta"
      aria-hidden={!isOpen}
    >
      {/* Header */}
      <NytaModalHeader
        onClear={clearConversation}
        onClose={close}
        dailyCount={rateLimitInfo?.count ?? null}
        dailyLimit={rateLimitInfo?.limit ?? null}
        onDragStart={handleDragStart}
      />

      {/* Error banner */}
      {showErrorBanner && (
        <div className={styles.errorBanner} role="alert">
          <FiAlertCircle size={16} />
          <span className={styles.errorText}>{error}</span>
          <button
            className={styles.errorDismiss}
            onClick={dismissError}
            aria-label="Fechar erro"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* Content area */}
      {showLockedView ? (
        <NytaLockedFeatureView onNavigateToPlans={handleNavigateToPlans} />
      ) : hasMessages ? (
        <div className={styles.chatArea} ref={chatAreaRef}>
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            loadingHistory={loadingHistory}
            hasMoreHistory={hasMoreHistory}
            pendingToolCalls={pendingToolCalls}
            onLoadOlder={loadOlderMessages}
            onConfirmTool={confirmTool}
            onCancelTool={cancelTool}
            suppressErrorBubbles={isRateLimited}
          />
          <div className={styles.inputWrapper}>
            <InputBar
              onSend={sendMessage}
              disabled={isStreaming}
              rateLimitInfo={rateLimitInfo}
              pendingToolCalls={pendingToolCalls}
            />
          </div>
        </div>
      ) : (
        <div className={styles.chatArea}>
          {/* Greeting empty state + exemplos de uso */}
          <div className={styles.greeting}>
            <div className={styles.greetingInner}>
              <div className={styles.greetingBubble}>
                <NytaAvatar size={32} />
                <div className={styles.greetingText}>{GREETING_TEXT}</div>
              </div>
              <div className={styles.suggestions}>
                <span className={styles.suggestionsLabel}>Experimente perguntar</span>
                <div className={styles.suggestionsList}>
                  {NYTA_SUGGESTIONS.map((s) => (
                    <button
                      key={s}
                      type="button"
                      className={styles.suggestionChip}
                      onClick={() => sendMessage(s)}
                      disabled={isStreaming}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
          <div className={styles.inputWrapper}>
            <InputBar
              onSend={sendMessage}
              disabled={isStreaming}
              rateLimitInfo={rateLimitInfo}
              pendingToolCalls={pendingToolCalls}
            />
          </div>
        </div>
      )}
    </div>
  );
};
