import { FC } from 'react';
import { Popconfirm } from 'antd';
import { FiArrowLeft, FiTrash2 } from 'react-icons/fi';

import { NytaAvatar } from '../../Wizard/chat/nytaPersona';
import { ARTISTS_DEFAULT_IMAGE } from '../../../constants/spotify';
import './ChatHeader.scss';

// Cabeçalho da página do chat em tela cheia.
//
// Quem fala aqui é a Nyta, então é o nome dela que titula — o do artista vira contexto ao lado.
// Antes o título era só o nome do artista, o que fazia a tela parecer a página do perfil.
//
// O desenho segue os outros cabeçalhos do redesign (wizard e modal): 70px de altura, voltar em
// botão redondo à esquerda, ações à direita.

interface ChatHeaderProps {
  artistName: string;
  artistImage?: string;
  onClear: () => void;
  // Uso diário (X/limite). Some quando não há informação — o contador só chega depois da
  // primeira resposta da Nyta no dia.
  dailyCount?: number | null;
  dailyLimit?: number | null;
  // Abre a gaveta de conversas. Só aparece abaixo de 900px, onde a coluna lateral vira gaveta.
  onOpenHistory: () => void;
}

export const ChatHeader: FC<ChatHeaderProps> = ({
  artistName, artistImage, onClear, dailyCount, dailyLimit, onOpenHistory,
}) => {
  const showUsage = typeof dailyCount === 'number' && typeof dailyLimit === 'number';

  return (
    <header className='chat-header'>
      {/* Só existe abaixo de 900px, onde a lista de conversas fica escondida atrás desta tela.
          Ali a navegação é em dois níveis, como em qualquer app de mensagem: voltar leva à
          lista, e é de lá que se sai para o perfil. No desktop a lista já está ao lado e este
          botão não aparece (ver ChatHeader.scss). */}
      <button
        className='chat-header__back'
        onClick={onOpenHistory}
        aria-label='Voltar para as conversas'
        title='Voltar para as conversas'
        type='button'
      >
        <FiArrowLeft size={17} />
      </button>

      <div className='chat-header__id'>
        <NytaAvatar size={30} />
        <h1 className='chat-header__title'>Nyta IA</h1>

        {/* De quem é esta conversa. A Nyta responde com os dados do artista selecionado, e o
            nome solto embaixo do título não deixava isso claro — parecia legenda. Com a foto e
            o "sobre", a pessoa vê de imediato sobre qual perfil está perguntando. */}
        {artistName && (
          <div className='chat-header__scope' title={`Conversa sobre ${artistName}`}>
            <span className='chat-header__scope-label'>sobre</span>
            <img className='chat-header__scope-avatar' src={artistImage || ARTISTS_DEFAULT_IMAGE} alt='' aria-hidden />
            <span className='chat-header__scope-name'>{artistName}</span>
          </div>
        )}
      </div>

      <div className='chat-header__actions'>
        {showUsage && (
          <span
            className={`chat-header__usage${dailyCount >= dailyLimit ? ' chat-header__usage--full' : ''}`}
            title='Mensagens usadas hoje'
          >
            {dailyCount}/{dailyLimit}
          </span>
        )}

        <Popconfirm
          title='Limpar conversa?'
          description='Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.'
          onConfirm={onClear}
          okText='Limpar'
          cancelText='Cancelar'
          okButtonProps={{ danger: true }}
          placement='bottomRight'
        >
          <button
            className='chat-header__clear'
            aria-label='Limpar conversa'
            title='Limpar conversa'
            type='button'
          >
            <FiTrash2 size={16} />
          </button>
        </Popconfirm>
      </div>
    </header>
  );
};
