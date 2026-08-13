import { FC, FormEvent, useMemo, useState } from 'react';
import { FiArrowUp } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useNytaChatForModal } from '../../hooks/useNytaChatForModal';
import { NytaAvatar } from '../Wizard/chat/nytaPersona';

const GREETING = 'Oi! Eu sou a Nyta, sua assistente estratégica aqui na Maestra. Posso ajudar com planejamento, músicas, agenda e equipe. Como posso te ajudar?';

const formatTime = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
}).format(new Date(value));

const initials = (name?: string) => (name || 'Você')
  .split(' ')
  .map((part) => part.charAt(0))
  .filter(Boolean)
  .slice(0, 2)
  .join('')
  .toUpperCase();

const Nyta: FC = () => {
  const [draft, setDraft] = useState('');
  const { artist } = useArtist();
  const {
    messages,
    isStreaming,
    pendingToolCalls,
    hasMoreHistory,
    error,
    sendMessage,
    confirmTool,
    cancelTool,
    loadOlderMessages,
    dismissError,
  } = useNytaChatForModal();

  const conversation = useMemo(() => {
    const withText = messages.filter((message) => message.content?.trim());
    const firstQuestion = withText.find((message) => message.role === 'user');
    const lastMessage = withText.at(-1);

    return {
      title: firstQuestion?.content || 'Nova conversa com a Nyta',
      preview: lastMessage?.content || GREETING,
      updatedAt: lastMessage?.createdAt,
    };
  }, [messages]);

  const artistName = artist?.name || 'Você';
  const artistImage = artist?.content?.spotifyProfile?.image;

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const message = draft.trim();
    if (!message || isStreaming) return;
    sendMessage(message);
    setDraft('');
  };

  return (
    <div className='nyta-page page-view'>
      <aside className='nyta-sidebar' aria-label='Histórico de conversas'>
        <section className='nyta-directory'>
          <header>
            Conversas
          </header>
          {messages.length ? (
            <button className='nyta-conversation-entry' type='button' onClick={() => document.querySelector('.nyta-stream')?.scrollTo({ top: 0, behavior: 'smooth' })}>
              <NytaAvatar size={30} />
              <span>
                <strong>{conversation.title}</strong>
                <small>{conversation.preview}</small>
              </span>
              {conversation.updatedAt && <time>{formatTime(conversation.updatedAt)}</time>}
            </button>
          ) : <p className='nyta-empty-history'>Sua primeira conversa com a Nyta aparecerá aqui.</p>}
        </section>
      </aside>

      <section className='nyta-conversation' aria-label='Conversa com Nyta IA'>
        <header className='nyta-conversation-head'>
          <strong><i />Nyta IA</strong>
          <span>Assistente estratégica</span>
        </header>

        <div className='nyta-stream' aria-live='polite'>
          {hasMoreHistory && <button className='nyta-load-history' type='button' onClick={loadOlderMessages}>Carregar mensagens anteriores</button>}
          {error && <div className='nyta-error' role='alert'><span>{error}</span><button type='button' onClick={dismissError}>Fechar</button></div>}

          {!messages.length && !isStreaming && (
            <article className='nyta-post'>
              <header><NytaAvatar size={40} /><strong>Nyta</strong></header>
              <p className='nyta-text-message'>{GREETING}</p>
            </article>
          )}

          {messages.map((message) => {
            const isAssistant = message.role === 'assistant';
            return (
              <article className={`nyta-post${isAssistant ? '' : ' nyta-post-user'}`} id={`nyta-message-${message.id}`} key={message.id}>
                <header>
                  {isAssistant ? <NytaAvatar size={40} /> : (
                    <span className='nyta-user-avatar'>
                      {artistImage ? <img src={artistImage} alt='' /> : initials(artistName)}
                    </span>
                  )}
                  <strong>{isAssistant ? 'Nyta' : 'Você'}</strong>
                  <time>{formatTime(message.createdAt)}</time>
                </header>
                {message.content && <p className='nyta-text-message'>{message.content}</p>}
              </article>
            );
          })}

          {isStreaming && <article className='nyta-post'><header><NytaAvatar size={40} /><strong>Nyta IA</strong><span>Respondendo...</span></header></article>}

          {pendingToolCalls.filter((tool) => tool.status === 'pending').map((tool) => (
            <article className='nyta-tool-confirmation' key={tool.toolCallId}>
              <strong>A Nyta precisa da sua confirmação para concluir esta ação.</strong>
              <div><button type='button' onClick={() => cancelTool(tool.toolCallId)}>Cancelar</button><button type='button' onClick={() => confirmTool(tool.toolCallId)}>Confirmar</button></div>
            </article>
          ))}
        </div>

        <form className='nyta-composer' onSubmit={submit}>
          <div className='nyta-composer-field'>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} aria-label='Mensagem para Nyta IA' placeholder='Mensagem para Nyta' disabled={isStreaming} />
            <button className='nyta-send' type='submit' aria-label='Enviar mensagem' disabled={!draft.trim() || isStreaming}><FiArrowUp /></button>
          </div>
        </form>
      </section>
    </div>
  );
};

export default Nyta;
