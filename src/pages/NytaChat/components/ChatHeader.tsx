import { FC } from 'react';
import { FiArrowLeft, FiEdit, FiMessageSquare } from 'react-icons/fi';

import './ChatHeader.scss';

// A faixa do chat em tela cheia.
//
// Ela tinha o emblema da Nyta, o título "Nyta IA", uma pílula "sobre <artista>" com foto, o uso
// do dia e uma lixeira. Seis coisas para uma tela cuja função é ler e escrever. Sobraram três:
// sair, ver as conversas, começar outra.
//
// O título saiu porque a tela inteira já diz de quem é a voz — e porque, com a barra da Maestra
// escondida nesta rota (ver `isImmersiveRoute`), esta é a única faixa da tela e ela precisa
// pesar o mínimo. O nome do artista ficou, em texto solto no meio: a Nyta responde com os dados
// de UM perfil, e sem isso não há como saber de qual, ainda mais em conta com vários.
//
// A lixeira saiu por ser redundante: "nova conversa" já dá a folha em branco sem destruir nada,
// e apagar de vez é uma ação da lista de conversas, que é onde ela pertence.

interface ChatHeaderProps {
  artistName: string;
  /** Sai do chat e volta ao perfil. */
  onBack: () => void;
  /** Abre a gaveta de conversas. Só aparece abaixo de 900px, onde a coluna vira gaveta. */
  onOpenHistory: () => void;
  /** Folha em branco, sem apagar a conversa de agora. */
  onNew: () => void;
}

export const ChatHeader: FC<ChatHeaderProps> = ({ artistName, onBack, onOpenHistory, onNew }) => (
  <header className='chat-header'>
    <button
      className='chat-header__icone chat-header__voltar'
      onClick={onBack}
      aria-label='Sair da conversa'
      title='Sair da conversa'
      type='button'
    >
      <FiArrowLeft size={19} />
    </button>

    {artistName && <span className='chat-header__escopo'>{artistName}</span>}

    <div className='chat-header__actions'>
      <button
        className='chat-header__icone chat-header__conversas'
        onClick={onOpenHistory}
        aria-label='Ver as conversas'
        title='Ver as conversas'
        type='button'
      >
        <FiMessageSquare size={18} />
      </button>

      <button
        className='chat-header__icone'
        onClick={onNew}
        aria-label='Nova conversa'
        title='Nova conversa'
        type='button'
      >
        <FiEdit size={18} />
      </button>
    </div>
  </header>
);
