import { FC, useCallback, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { FiAlertCircle } from 'react-icons/fi';

import './styles.scss';
import { useEntitlements } from '@maestra/core/hooks/useEntitlements';
import { useNytaChat } from '@maestra/core/hooks/useNytaChat';
import { useNytaConversations } from '@maestra/core/hooks/useNytaConversations';
import { useArtist } from '@maestra/core/hooks/useArtist';
import { LockedFeature } from '../../components/LockedFeature';
import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { useAppSelector } from '@maestra/core/store/store';
import { saudacaoDaNyta } from '@maestra/core/constants/nytaChat';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';
import { ChatHeader } from './components/ChatHeader';
import { ConversationSidebar } from './components/ConversationSidebar';
import { InputBar } from './components/InputBar';
import { MessageList } from './components/MessageList';


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
    loadOlderMessages, sendMessage, stopStreaming, confirmTool, cancelTool,
    selectConversation, startNewConversation,
  } = useNytaChat('route', handleConversation);
  const { artist } = useArtist();
  const navigate = useNavigate();
  const usuario = useAppSelector((st) => st.auth.user);
  const quemEntrou = (usuario?.user_metadata as Record<string, unknown> | undefined);
  const nome = (quemEntrou?.full_name || quemEntrou?.name) as string | undefined;
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

  // O CARTÃO VERMELHO NO TOPO SAIU.
  //
  // Ele flutuava sobre a conversa dizendo "Erro de conexão" no mesmo instante em que o fio
  // dizia "Não foi possível completar a resposta": dois avisos para uma falha, e o mais feio
  // dos dois por cima justamente do que a pessoa estava lendo. Toda falha de envio marca a
  // mensagem com `status: 'error'` (ver `useNytaChat`), então o fio já conta a história.
  //
  // O que o fio NÃO conta é a conversa que não carregou — ali não há mensagem para marcar. Essa
  // vira uma linha discreta acima do campo, onde já mora a ressalva da Nyta.
  const falhaNoFio = messages.some((m) => m.status === 'error');
  const avisoDeFalha =
    error && error !== 'subscription_required' && !falhaNoFio ? error : null;

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
            onOpenHistory={() => setHistoryOpen(true)}
            onBack={() => navigate(`/artists/${artistId}`)}
          />
        </div>

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

          />
        ) : (
          // A conversa em branco abre com uma SAUDAÇÃO, e não com uma mensagem da Nyta.
          //
          // Ela se apresentava num balão de sete linhas explicando o que sabe fazer. Aquilo
          // ocupava a primeira tela inteira, e ninguém lê a segunda vez: quem abre o chat pela
          // décima vez já sabe quem é a Nyta. Uma linha basta, e o convite fica no campo.
          <div className="nyta-chat-page__greeting">
            <NytaAvatar size={34} />
            <p className="nyta-chat-page__greeting-text">{saudacaoDaNyta(nome)}</p>
          </div>
        )}

        {avisoDeFalha && (
          <p className="nyta-chat-page__aviso" role="alert">{avisoDeFalha}</p>
        )}

        {/* A caixa de texto é a mesma nos dois estados: com histórico e na conversa em branco. */}
        <div className="nyta-chat-page__input">
          <InputBar
            onSend={sendMessage}
            onStop={stopStreaming}
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
