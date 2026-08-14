import { FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { FiArrowLeft, FiTrash2 } from 'react-icons/fi';

import { NytaAvatar } from '../../Wizard/chat/nytaPersona';
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
  onClear: () => void;
  // Uso diário (X/limite). Some quando não há informação — o contador só chega depois da
  // primeira resposta da Nyta no dia.
  dailyCount?: number | null;
  dailyLimit?: number | null;
}

export const ChatHeader: FC<ChatHeaderProps> = ({ artistName, onClear, dailyCount, dailyLimit }) => {
  const navigate = useNavigate();
  const { id: artistId } = useParams<{ id: string }>();
  const showUsage = typeof dailyCount === 'number' && typeof dailyLimit === 'number';

  return (
    <header className='chat-header'>
      {/* No desktop quem leva de volta ao perfil é o botão do topo da lista de conversas. Este
          aqui só aparece abaixo de 900px, onde a lista some e ele seria a única saída. */}
      <button
        className='chat-header__back'
        onClick={() => navigate(`/artists/${artistId}`)}
        aria-label='Voltar para o perfil'
        title='Voltar para o perfil'
        type='button'
      >
        <FiArrowLeft size={17} />
      </button>

      <div className='chat-header__id'>
        <NytaAvatar size={30} />
        <div className='chat-header__titles'>
          <h1 className='chat-header__title'>Nyta IA</h1>
          {artistName && <span className='chat-header__subtitle'>{artistName}</span>}
        </div>
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
