import { FC } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Popconfirm } from 'antd';
import { FiChevronLeft, FiTrash2 } from 'react-icons/fi';

import './ChatHeader.scss';

// ─── Props ────────────────────────────────────────────────────────────────────

interface ChatHeaderProps {
  artistName: string;
  onClear: () => void;
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ChatHeader: FC<ChatHeaderProps> = ({ artistName, onClear }) => {
  const navigate = useNavigate();
  const { id: artistId } = useParams<{ id: string }>();

  const handleBack = () => {
    navigate(`/artists/${artistId}`);
  };

  return (
    <header className="chat-header">
      <button
        className="chat-header__back"
        onClick={handleBack}
        aria-label="Voltar para artista"
      >
        <FiChevronLeft size={20} />
      </button>

      <h1 className="chat-header__title">{artistName}</h1>

      <Popconfirm
        title='Limpar conversa?'
        description='Todas as mensagens serão apagadas. Esta ação não pode ser desfeita.'
        onConfirm={onClear}
        okText='Sim'
        cancelText='Não'
        placement='bottomRight'
      >
        <button
          className="chat-header__clear"
          aria-label="Limpar conversa"
          title="Limpar conversa"
        >
          <FiTrash2 size={16} />
        </button>
      </Popconfirm>
    </header>
  );
};
