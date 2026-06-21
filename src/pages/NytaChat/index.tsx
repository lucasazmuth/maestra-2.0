import { FC } from 'react';
import { FiAlertCircle } from 'react-icons/fi';

import './styles.scss';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useNytaChat } from '../../hooks/useNytaChat';
import { useArtist } from '../../hooks/useArtist';
import { LockedFeature } from '../../components/LockedFeature';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { ChatHeader } from './components/ChatHeader';
import { InputBar } from './components/InputBar';
import { MessageList } from './components/MessageList';

// ─── Greeting text (empty state) ──────────────────────────────────────────────

const GREETING_TEXT =
  'Oi! Eu sou a Nyta, sua consultora estratégica aqui na Maestra. ' +
  'Pode me perguntar qualquer coisa sobre seu planejamento, catálogo, agenda ou equipe — ' +
  'e eu também posso executar ações por você, sempre com sua confirmação. Como posso te ajudar?';

// ─── Component ────────────────────────────────────────────────────────────────

const NytaChatPage: FC = () => {
  const entitlements = useEntitlements();
  const { messages, isStreaming, pendingToolCalls, rateLimitInfo, loadingHistory, hasMoreHistory, error, unavailableModules, loadOlderMessages, sendMessage, confirmTool, cancelTool, clearConversation, dismissError } = useNytaChat();
  const { artist } = useArtist();
  // A carga inicial (e o reset ao trocar de artista) é feita pelo useNytaChat.

  // Nyta Consultora é recurso PRO (nível conta): trava sem assinatura ativa.
  if (!PAYWALL_DISABLED && !entitlements.isPro) {
    return <LockedFeature feature="nyta" />;
  }

  // HTTP 403 subscription_required: render LockedFeature (Req 7.5)
  if (error === 'subscription_required') {
    return <LockedFeature feature="nyta" />;
  }

  const hasMessages = messages.length > 0;

  // Determine if we should show the error banner (non-subscription errors)
  const showErrorBanner = error && error !== 'subscription_required';

  return (
    <div className="nyta-chat-page">
      {/* ChatHeader */}
      <div className="nyta-chat-page__header">
        <ChatHeader
          artistName={artist?.name || ''}
          onClear={clearConversation}
        />
      </div>

      {/* Error banner for connection/stream errors (Req 8.11, 1.4) */}
      {showErrorBanner && (
        <div className="nyta-chat-page__error-banner" role="alert">
          <FiAlertCircle size={16} />
          <span className="nyta-chat-page__error-text">{error}</span>
          <button
            className="nyta-chat-page__error-dismiss"
            onClick={dismissError}
            aria-label="Fechar erro"
            type="button"
          >
            ✕
          </button>
        </div>
      )}

      {/* Inline warning when modules are unavailable (Req 3.6) */}
      {unavailableModules.length > 0 && (
        <div className="nyta-chat-page__module-warning" role="status" aria-live="polite">
          <FiAlertCircle size={14} />
          <span className="nyta-chat-page__module-warning-text">
            {unavailableModules.length === 1
              ? `O módulo "${unavailableModules[0]}" está temporariamente indisponível.`
              : `Os módulos ${unavailableModules.map((m) => `"${m}"`).join(', ')} estão temporariamente indisponíveis.`}
            {' '}A Nyta responderá com os dados dos demais módulos.
          </span>
        </div>
      )}

      {hasMessages ? (
        <>
          {/* MessageList with infinite scroll */}
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            loadingHistory={loadingHistory}
            hasMoreHistory={hasMoreHistory}
            pendingToolCalls={pendingToolCalls}
            onLoadOlder={loadOlderMessages}
            onConfirmTool={confirmTool}
            onCancelTool={cancelTool}
          />

          {/* InputBar */}
          <div className="nyta-chat-page__input">
            <InputBar
              onSend={sendMessage}
              disabled={isStreaming}
              rateLimitInfo={rateLimitInfo}
              pendingToolCalls={pendingToolCalls}
            />
          </div>
        </>
      ) : (
        <>
          {/* Greeting bubble when no messages exist */}
          <div className="nyta-chat-page__greeting">
            <div className="nyta-chat-page__greeting-bubble">
              <NytaAvatar size={32} />
              <div className="nyta-bubble">{GREETING_TEXT}</div>
            </div>
          </div>

          {/* InputBar — also present in empty state */}
          <div className="nyta-chat-page__input">
            <InputBar
              onSend={sendMessage}
              disabled={isStreaming}
              rateLimitInfo={rateLimitInfo}
              pendingToolCalls={pendingToolCalls}
            />
          </div>
        </>
      )}
    </div>
  );
};

export default NytaChatPage;
