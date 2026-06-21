import { FC, useEffect, useState } from 'react';
import { message } from 'antd';
import { FiCheck, FiX, FiChevronDown, FiChevronUp } from 'react-icons/fi';

import { useAppSelector, useAppDispatch } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { MVP_ACCESS_LEVELS } from '../../constants/maestra';
import * as membersDb from '../../services/db/members';
import type { PendingInvite } from '../../services/db/members';
import type { AccessLevel } from '../../interfaces/maestra';

const PendingInvites: FC = () => {
  const user = useAppSelector((s) => s.auth.user);
  const dispatch = useAppDispatch();
  const [invites, setInvites] = useState<PendingInvite[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    const email = user?.email;
    if (!email) return;
    setLoading(true);
    membersDb
      .fetchPendingInvites(email)
      .then(setInvites)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user?.email]);

  const accept = async (invite: PendingInvite) => {
    if (!user) return;
    try {
      await membersDb.acceptInvite(invite.id, user.id, user.user_metadata?.full_name || '');
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
      message.success(`Você entrou na equipe de ${invite.artists?.name || 'artista'}!`);
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
    return invite.artists?.content?.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE;
  };

  const getGenre = (invite: PendingInvite): string | undefined => {
    return invite.artists?.content?.identity?.genre;
  };

  const getAccessLabels = (levels: AccessLevel[]): string[] => {
    return levels
      .map((l) => (MVP_ACCESS_LEVELS as Record<string, string>)[l])
      .filter(Boolean);
  };

  if (loading || !invites.length) return null;

  return (
    <div style={{ marginBottom: 28 }}>
      <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, marginBottom: 12 }}>
        Convites pendentes
      </h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {invites.map((inv) => {
          const isExpanded = expanded === inv.id;
          const image = getImage(inv);
          const genre = getGenre(inv);
          const accessLabels = getAccessLabels(inv.access_levels);

          return (
            <div
              key={inv.id}
              style={{
                background: '#181818',
                border: '1px solid #2a2a2a',
                borderRadius: 12,
                overflow: 'hidden',
                transition: 'border-color .2s',
              }}
            >
              {/* Header row */}
              <div
                style={{
                  padding: 16,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 14,
                }}
              >
                <img
                  src={image}
                  alt={inv.artists?.name || 'Artista'}
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: '50%',
                    objectFit: 'cover',
                    flexShrink: 0,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 15 }}>
                    {inv.artists?.name || 'Artista'}
                  </div>
                  <div style={{ color: '#b3b3b3', fontSize: 13 }}>
                    Você foi convidado para a equipe
                  </div>
                </div>

                {/* Expand / collapse */}
                <button
                  onClick={() => setExpanded(isExpanded ? null : inv.id)}
                  title='Ver detalhes'
                  style={{
                    width: 32,
                    height: 32,
                    borderRadius: '50%',
                    border: 'none',
                    background: 'rgba(255,255,255,0.06)',
                    color: '#b3b3b3',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {isExpanded ? <FiChevronUp size={16} /> : <FiChevronDown size={16} />}
                </button>

                {/* Actions */}
                <button
                  onClick={() => accept(inv)}
                  title='Aceitar convite'
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: 'none',
                    background: '#af2896',
                    color: '#fff',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'transform .1s',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.transform = 'scale(1.08)')}
                  onMouseLeave={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  <FiCheck size={18} strokeWidth={3} />
                </button>
                <button
                  onClick={() => reject(inv)}
                  title='Recusar convite'
                  style={{
                    width: 38,
                    height: 38,
                    borderRadius: '50%',
                    border: '1px solid #404040',
                    background: 'transparent',
                    color: '#b3b3b3',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    transition: 'transform .1s, color .15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'scale(1.08)';
                    e.currentTarget.style.color = '#e91429';
                    e.currentTarget.style.borderColor = '#e91429';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'scale(1)';
                    e.currentTarget.style.color = '#b3b3b3';
                    e.currentTarget.style.borderColor = '#404040';
                  }}
                >
                  <FiX size={18} />
                </button>
              </div>

              {/* Expanded details */}
              {isExpanded && (
                <div
                  style={{
                    padding: '0 16px 16px',
                    borderTop: '1px solid #2a2a2a',
                    paddingTop: 14,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                >
                  {genre && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#6b7280', fontSize: 13, minWidth: 80 }}>Gênero</span>
                      <span style={{ color: '#fff', fontSize: 13 }}>{genre}</span>
                    </div>
                  )}
                  {accessLabels.length > 0 && (
                    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <span style={{ color: '#6b7280', fontSize: 13, minWidth: 80 }}>Acesso</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {accessLabels.map((label) => (
                          <span
                            key={label}
                            style={{
                              background: 'rgba(175, 40, 150, 0.12)',
                              color: '#af2896',
                              borderRadius: 9999,
                              padding: '2px 10px',
                              fontSize: 12,
                              fontWeight: 600,
                            }}
                          >
                            {label}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {inv.created_at && (
                    <div style={{ display: 'flex', gap: 8 }}>
                      <span style={{ color: '#6b7280', fontSize: 13, minWidth: 80 }}>Enviado</span>
                      <span style={{ color: '#b3b3b3', fontSize: 13 }}>
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
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default PendingInvites;
