import { FC, PointerEvent as ReactPointerEvent, useState } from 'react';
import { Dropdown, Popconfirm } from 'antd';
import { FiMoreVertical, FiTrash2, FiX, FiArrowLeft, FiLifeBuoy } from 'react-icons/fi';

import useIsMobile from '../../utils/isMobile';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import styles from './NytaModalHeader.module.scss';

const SUPPORT_EMAIL = 'maestra@musicrioacademy.com.br';

interface NytaModalHeaderProps {
  onClear: () => void;
  onClose: () => void;
  // Contador de uso diário (X/limite). Quando informado, mostra um selo discreto no header
  // pro artista acompanhar quanto falta pro limite diário.
  dailyCount?: number | null;
  dailyLimit?: number | null;
  // Inicia o arraste do modal (desktop). Indefinido no mobile (tela cheia, sem arraste).
  onDragStart?: (e: ReactPointerEvent) => void;
}

export const NytaModalHeader: FC<NytaModalHeaderProps> = ({
  onClear,
  onClose,
  dailyCount,
  dailyLimit,
  onDragStart,
}) => {
  const isMobile = useIsMobile();
  const draggable = !isMobile && !!onDragStart;
  const [clearOpen, setClearOpen] = useState(false);

  const openSupport = () => {
    window.open(`mailto:${SUPPORT_EMAIL}?subject=Suporte%20Nyta%20IA`, '_blank');
  };

  return (
    <div
      className={`${styles.header}${draggable ? ` ${styles.draggable}` : ''}`}
      onPointerDown={draggable ? onDragStart : undefined}
    >
      <div className={styles.brand}>
        <NytaAvatar size={30} />
        <div className={styles.titles}>
          <span className={styles.title}>Nyta IA</span>
        </div>
      </div>

      {/* Não inicia arraste ao clicar nos botões de ação. */}
      <div className={styles.actions} onPointerDown={(e) => e.stopPropagation()}>
        {typeof dailyCount === 'number' && typeof dailyLimit === 'number' && (
          <span
            className={`${styles.usage}${dailyCount >= dailyLimit ? ` ${styles.usageFull}` : ''}`}
            title="Mensagens usadas hoje"
          >
            {dailyCount}/{dailyLimit}
          </span>
        )}
        <Popconfirm
          open={clearOpen}
          title="Limpar histórico?"
          description="Esta ação não pode ser desfeita."
          okText="Limpar"
          cancelText="Cancelar"
          okButtonProps={{ danger: true }}
          placement="bottomRight"
          onOpenChange={setClearOpen}
          onConfirm={() => { setClearOpen(false); onClear(); }}
        >
          <Dropdown
            trigger={['click']}
            placement="bottomRight"
            menu={{
              items: [
                { key: 'clear', label: 'Limpar histórico', icon: <FiTrash2 size={15} />, danger: true },
                { key: 'support', label: 'Falar com o suporte', icon: <FiLifeBuoy size={15} /> },
              ],
              onClick: ({ key }) => key === 'clear' ? setClearOpen(true) : openSupport(),
            }}
          >
            <button className={styles.iconButton} aria-label="Mais opções" title="Mais opções">
              <FiMoreVertical size={18} />
            </button>
          </Dropdown>
        </Popconfirm>

        <button
          className={styles.iconButton}
          onClick={onClose}
          aria-label={isMobile ? 'Voltar' : 'Fechar'}
        >
          {isMobile ? <FiArrowLeft size={18} /> : <FiX size={18} />}
        </button>
      </div>
    </div>
  );
};
