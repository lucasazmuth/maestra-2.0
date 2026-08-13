import { FC, useEffect, useState } from 'react';
import { Popconfirm, message } from 'antd';
import { FiCheck, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { useAppSelector, useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { MVP_ACCESS_LEVELS } from '../../constants/maestra';
import * as membersDb from '../../services/db/members';
import type { PendingInvite } from '../../services/db/members';
import type { AccessLevel } from '../../interfaces/maestra';
import styles from './PendingInvites.module.scss';

// Convites de equipe pendentes, listados no topo de "Seus perfis". É o ÚNICO caminho do app para
// aceitar ou recusar um convite (membersDb.acceptInvite/rejectInvite não são chamados em mais
// lugar nenhum) — sem esta lista renderizada, quem é convidado não consegue entrar na equipe.
const PendingInvites: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    if (!user?.email) return; // a RPC filtra pelo e-mail do usuário logado
    setLoading(true);
    membersDb
      .fetchPendingInvites()
      .then(setInvites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.email]);

  const accept = async (invite: PendingInvite) => {
    if (!user) return;
    try {
      await membersDb.acceptInvite(invite.id, user.id, user.user_metadata?.full_name || '');
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      message.success(`Você entrou na equipe de ${invite.artist_name || 'artista'}!`);
      dispatch(artistsActions.fetchArtists(user.id));
    } catch {
      message.error('Erro ao aceitar convite');
    }
  };

  const reject = async (invite: PendingInvite) => {
    try {
      await membersDb.rejectInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      message.info('Convite recusado');
    } catch {
      message.error('Erro ao recusar convite');
    }
  };

  const getImage = (invite: PendingInvite): string => {
    return invite.artist_image || ARTISTS_DEFAULT_IMAGE;
  };

  const getGenre = (invite: PendingInvite): string | undefined => {
    return invite.artist_genre || undefined;
  };

  const getAccessLabels = (levels: AccessLevel[]): string[] => {
    return levels
      .map((l) => (MVP_ACCESS_LEVELS as Record<string, string>)[l])
      .filter(Boolean);
  };

  if (loading || !invites.length) return null;

  return (
    <section className={styles.wrap} aria-label='Convites pendentes'>
      <h2 className={styles.title}>Convites pendentes</h2>
      <div className={styles.list}>
        {invites.map((inv) => {
          const isExpanded = expanded === inv.id;
          const accessLabels = getAccessLabels(inv.access_levels);
          const genre = getGenre(inv);

          return (
            <article key={inv.id} className={styles.card}>
              <div className={styles.row}>
                <img className={styles.avatar} src={getImage(inv)} alt={inv.artist_name || 'Artista'} />

                <div className={styles.info}>
                  <div className={styles.name}>{inv.artist_name || 'Artista'}</div>
                  <div className={styles.sub}>Você foi convidado para a equipe</div>
                </div>

                <button
                  type='button'
                  className={styles.toggle}
                  onClick={() => setExpanded(isExpanded ? null : inv.id)}
                  title='Ver detalhes'
                  aria-expanded={isExpanded}
                >
                  {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </button>

                <button
                  type='button'
                  className={styles.accept}
                  onClick={() => accept(inv)}
                  title='Aceitar convite'
                  aria-label={`Aceitar convite de ${inv.artist_name || 'artista'}`}
                >
                  <FiCheck size={18} strokeWidth={3} />
                </button>

                <Popconfirm
                  title='Recusar convite?'
                  description={`Você não vai mais poder acessar a equipe de ${inv.artist_name || 'este artista'}.`}
                  okText='Recusar'
                  cancelText='Cancelar'
                  okButtonProps={{ danger: true }}
                  onConfirm={() => reject(inv)}
                >
                  <button
                    type='button'
                    className={styles.reject}
                    title='Recusar convite'
                    aria-label={`Recusar convite de ${inv.artist_name || 'artista'}`}
                  >
                    <FiX size={18} />
                  </button>
                </Popconfirm>
              </div>

              {isExpanded && (
                <div className={styles.details}>
                  {genre && (
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Gênero</span>
                      <span className={styles.value}>{genre}</span>
                    </div>
                  )}
                  {accessLabels.length > 0 && (
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Acesso</span>
                      <div className={styles.chips}>
                        {accessLabels.map((label) => (
                          <span key={label} className={styles.chip}>
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {inv.created_at && (
                    <div className={styles.detailRow}>
                      <span className={styles.key}>Enviado</span>
                      <span className={styles.value}>
                        {new Date(inv.created_at).toLocaleDateString('pt-BR', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};

export default PendingInvites;
