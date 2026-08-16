import { FC, useCallback, useState } from 'react';
import { useParams } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

import './styles.scss';
import { useEntitlements } from '../../hooks/useEntitlements';
import { useNytaChat } from '../../hooks/useNytaChat';
import { useNytaConversations } from '../../hooks/useNytaConversations';
import { useArtist } from '../../hooks/useArtist';
import { LockedFeature } from '../../components/LockedFeature';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { ChatHeader } from './components/ChatHeader';
import { ConversationSidebar } from './components/ConversationSidebar';
import { InputBar } from './components/InputBar';
import { MessageList } from './components/MessageList';

// ─── Greeting text (empty state) ──────────────────────────────────────────────

const GREETING_TEXT =
  'Oi! Eu sou a Nyta, sua assistente estratégica aqui na Maestra. ' +
  'Pode me perguntar qualquer coisa sobre seu planejamento, músicas, agenda ou equipe — ' +
  'e eu também posso executar ações por você, sempre com sua confirmação. Como posso te ajudar?';

// ─── Component ────────────────────────────────────────────────────────────────

const NytaChatPage: FC = () => {
  const entitlements = useEntitlements();
  const { id: artistId } = useParams<{ id: string }>();
  const { conversations, refresh, rename, remove } = useNytaConversations(artistId);
  // Só tem efeito abaixo de 900px, onde a coluna de conversas vira gaveta.
  const [historyOpen, setHistoryOpen] = useState(false);

  // A lista de conversas só ganha a linha nova quando o servidor a cria (na primeira mensagem),
  // então é o próprio chat que avisa a hora de recarregar.
  const handleConversation = useCallback(() => { refresh(); }, [refresh]);

  const {
    messages, isStreaming, pendingToolCalls, rateLimitInfo, loadingHistory, hasMoreHistory,
    error, unavailableModules, conversationId,
    loadOlderMessages, sendMessage, confirmTool, cancelTool, clearConversation, dismissError,
    selectConversation, startNewConversation,
  } = useNytaChat('route', handleConversation);
  const { artist } = useArtist();
  // A carga inicial (e o reset ao trocar de artista) é feita pelo useNytaChat.

  const handleDelete = useCallback(async (id: string) => {
    const ok = await remove(id);
    // Apagar a conversa aberta deixaria a tela mostrando mensagens que não existem mais.
    if (ok && id === conversationId) startNewConversation();
  }, [remove, conversationId, startNewConversation]);

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
    // `nyta-surface` traz o skin claro do chat (o mesmo do modal flutuante) — ver styles.scss.
    <div className="nyta-chat-shell nyta-surface">
      <ConversationSidebar
        conversations={conversations}
        activeId={conversationId}
        // Abrir/criar conversa é o motivo da gaveta existir: feito isso, ela sai da frente.
        onSelect={(id) => { setHistoryOpen(false); selectConversation(id); }}
        onNew={() => { setHistoryOpen(false); startNewConversation(); }}
        onRename={rename}
        onDelete={handleDelete}
        open={historyOpen}
      />

      <div className="nyta-chat-page">
        {/* ChatHeader */}
        <div className="nyta-chat-page__header">
          <ChatHeader
            artistName={artist?.name || ''}
            artistImage={artist?.content?.spotifyProfile?.image}
            onClear={clearConversation}
            dailyCount={rateLimitInfo?.count ?? null}
            dailyLimit={rateLimitInfo?.limit ?? null}
            onOpenHistory={() => setHistoryOpen(true)}
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
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            loadingHistory={loadingHistory}
            hasMoreHistory={hasMoreHistory}
            pendingToolCalls={pendingToolCalls}
            onLoadOlder={loadOlderMessages}
            onConfirmTool={confirmTool}
            onCancelTool={cancelTool}
            showAuthorAvatar
          />
        ) : (
          <div className="nyta-chat-page__greeting">
            <div className="nyta-chat-page__greeting-bubble">
              <NytaAvatar size={32} />
              <div className="nyta-bubble">{GREETING_TEXT}</div>
            </div>
          </div>
        )}

        {/* A caixa de texto é a mesma nos dois estados: com histórico e na conversa em branco. */}
        <div className="nyta-chat-page__input">
          <InputBar
            onSend={sendMessage}
            disabled={isStreaming}
            rateLimitInfo={rateLimitInfo}
            pendingToolCalls={pendingToolCalls}
          />
        </div>
      </div>
    </div>
  );
};

export default NytaChatPage;
