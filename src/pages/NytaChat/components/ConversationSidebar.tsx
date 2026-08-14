import { FC, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Dropdown, Popconfirm } from 'antd';
import { FiArrowLeft, FiEdit2, FiMoreHorizontal, FiPlus, FiTrash2 } from 'react-icons/fi';

import type { NytaConversationSummary } from '../../../hooks/useNytaConversations';
import { useAppSelector } from '../../../store/store';
import { ARTISTS_DEFAULT_IMAGE } from '../../../constants/spotify';
import './ConversationSidebar.scss';

// Histórico de conversas da Nyta, na lateral da página em tela cheia.
//
// A tela antiga tinha uma lista com este mesmo nome, mas era enfeite: o banco guardava uma
// conversa por artista, então o único item sempre levava de volta pro mesmo lugar.

interface ConversationSidebarProps {
  conversations: NytaConversationSummary[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
}

// Data curta como as pessoas leem numa lista: hoje vira hora, esta semana vira o dia da semana,
// o resto vira dia/mês.
const shortDate = (iso: string): string => {
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' }).format(d);
  const days = (now.getTime() - d.getTime()) / 86400000;
  if (days < 7) return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' }).format(d).replace('.', '');
  return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' }).format(d);
};

export const ConversationSidebar: FC<ConversationSidebarProps> = ({
  conversations, activeId, onSelect, onNew, onRename, onDelete,
}) => {
  const navigate = useNavigate();
  const { id: artistId } = useParams<{ id: string }>();
  // Autoria na lista: um perfil pode ter várias pessoas da equipe conversando com a Nyta, e sem
  // o rosto de quem abriu, o histórico não diz de quem é cada conversa.
  const user = useAppSelector((s) => s.auth.user);
  const meta = (user?.user_metadata || {}) as Record<string, unknown>;
  const myAvatar = (meta.avatar_url as string) || (meta.picture as string) || ARTISTS_DEFAULT_IMAGE;
  const myName = (meta.full_name as string) || (meta.name as string) || user?.email || 'Você';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [menuId, setMenuId] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);

  const commitRename = () => {
    if (editingId && draft.trim()) onRename(editingId, draft);
    setEditingId(null);
  };

  return (
    <aside className='nyta-conversations' aria-label='Conversas com a Nyta'>
      <header className='nyta-conversations__head'>
        {/* Sair da Nyta é navegação da página inteira, não do chat — por isso mora aqui na
            coluna, junto do título, e não no cabeçalho da conversa. */}
        <button
          className='nyta-conversations__back'
          type='button'
          onClick={() => navigate(`/artists/${artistId}`)}
          aria-label='Voltar para o perfil'
          title='Voltar para o perfil'
        >
          <FiArrowLeft size={16} />
        </button>
        <span className='nyta-conversations__title'>Conversas</span>
        <button
          className='nyta-conversations__new'
          type='button'
          onClick={onNew}
          aria-label='Nova conversa'
          title='Nova conversa'
        >
          <FiPlus size={16} />
        </button>
      </header>

      {/* Conversa nova ainda sem id: a lista não tem o que destacar, então o cabeçalho de
          rascunho segura o lugar até a primeira mensagem criar a linha no banco. */}
      {activeId === null && (
        <div className='nyta-conversations__draft'>Nova conversa</div>
      )}

      {conversations.length === 0 ? (
        <p className='nyta-conversations__empty'>
          Suas conversas com a Nyta aparecem aqui.
        </p>
      ) : (
        <ul className='nyta-conversations__list'>
          {conversations.map((c) => (
            <li key={c.id}>
              <div className={`nyta-conversations__item${c.id === activeId ? ' nyta-conversations__item--active' : ''}`}>
                {editingId === c.id ? (
                  <input
                    className='nyta-conversations__rename'
                    value={draft}
                    autoFocus
                    maxLength={80}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') commitRename();
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                    aria-label='Nome da conversa'
                  />
                ) : (
                  <button
                    className='nyta-conversations__open'
                    type='button'
                    onClick={() => onSelect(c.id)}
                    aria-current={c.id === activeId ? 'true' : undefined}
                  >
                    <img
                      className='nyta-conversations__author'
                      src={c.userId === user?.id ? myAvatar : ARTISTS_DEFAULT_IMAGE}
                      alt=''
                      title={c.userId === user?.id ? myName : 'Outro integrante da equipe'}
                      aria-hidden
                    />
                    <span className='nyta-conversations__lines'>
                      <span className='nyta-conversations__name'>{c.title || 'Nova conversa'}</span>
                      <time className='nyta-conversations__time' dateTime={c.updatedAt}>{shortDate(c.updatedAt)}</time>
                    </span>
                  </button>
                )}

                {/* Excluir apaga as mensagens junto (cascade), então o item do menu arma esta
                    confirmação em vez de agir na hora — mesmo padrão do menu do modal. */}
                <Popconfirm
                  trigger={[]}
                  open={confirmingId === c.id}
                  title='Excluir conversa?'
                  description='As mensagens desta conversa serão apagadas.'
                  okText='Excluir'
                  cancelText='Cancelar'
                  okButtonProps={{ danger: true }}
                  placement='bottomRight'
                  onOpenChange={(open) => { if (!open) setConfirmingId(null); }}
                  onConfirm={() => { setConfirmingId(null); onDelete(c.id); }}
                >
                  <Dropdown
                    trigger={['click']}
                    placement='bottomRight'
                    open={menuId === c.id}
                    onOpenChange={(open) => {
                      setMenuId(open ? c.id : null);
                      if (open) setConfirmingId(null);
                    }}
                    menu={{
                      items: [
                        { key: 'rename', icon: <FiEdit2 size={13} />, label: 'Renomear' },
                        { key: 'delete', icon: <FiTrash2 size={13} />, label: 'Excluir', danger: true },
                      ],
                      onClick: ({ key }) => {
                        setMenuId(null);
                        if (key === 'rename') {
                          setDraft(c.title || '');
                          setEditingId(c.id);
                        } else {
                          setConfirmingId(c.id);
                        }
                      },
                    }}
                  >
                    <button
                      className='nyta-conversations__more'
                      type='button'
                      aria-label={`Ações da conversa ${c.title || 'sem título'}`}
                    >
                      <FiMoreHorizontal size={15} />
                    </button>
                  </Dropdown>
                </Popconfirm>
              </div>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
};
