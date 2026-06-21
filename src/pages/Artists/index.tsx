import { FC, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Popconfirm } from 'antd';
import { FiPlus, FiTrash2 } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useCanCreateArtist } from '../../hooks/useCanCreateArtist';
import { formatRemainingTime } from '../../utils/rateLimitCalc';
import PendingInvites from '../../components/PendingInvites';
import { Spinner } from '../../components/spinner/spinner';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { isOnboardingComplete } from '../../constants/maestra';

const Artists: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { message } = App.useApp();

  const user = useAppSelector((s) => s.auth.user);
  const artists = useAppSelector((s) => s.artists.items);
  const loading = useAppSelector((s) => s.artists.loading);

  useEffect(() => {
    if (user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [user?.id, dispatch]);

  // Para onde cada card leva: não-pago → desbloqueio; pago → dashboard (o
  // planejamento é opcional e acessível pelo menu).
  const routeFor = (a: { id: string; is_locked?: boolean; role?: string }) => {
    if (a.role !== 'member' && a.is_locked) return `/artists/${a.id}/desbloquear`;
    return `/artists/${a.id}`;
  };

  // Rate limit: verifica se pode criar via hook (limite de pendentes + cooldown progressivo)
  const { canCreate: allowed, reason, pendingCount, cooldownRemainingSeconds, loading: rlLoading, error: rlError } = useCanCreateArtist();

  const handleCreate = () => {
    // Se ainda está carregando, deixa navegar — a página de criação faz sua própria verificação
    if (rlLoading) {
      navigate('/criar-artista');
      return;
    }
    if (!allowed) {
      if (reason === 'pending_limit') {
        message.warning(`Você tem ${pendingCount} perfis pendentes. Pague ou exclua antes de criar outro.`);
      } else if (reason === 'cooldown') {
        message.warning(`Aguarde ${formatRemainingTime(cooldownRemainingSeconds)} para criar outro perfil.`);
      } else if (rlError) {
        message.error('Erro ao verificar limites. Tente novamente.');
      } else {
        // Fallback: reason null mas allowed false (estado transitório)
        message.warning('Verificando limites… tente novamente em instantes.');
      }
      return;
    }
    navigate('/criar-artista');
  };

  // Deep-link ?create=1 → abre o chat de criação full-screen (respeitando a trava).
  useEffect(() => {
    if (params.get('create') === '1') {
      params.delete('create');
      setParams(params, { replace: true });
      handleCreate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params, setParams, navigate]);

  return (
    <div style={{ padding: 24 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: 24,
        }}
      >
        <h1
          style={{
            fontFamily: 'SpotifyMixUITitle',
            fontWeight: 800,
            fontSize: 32,
            color: '#fff',
            margin: 0,
          }}
        >
          Seus artistas
        </h1>
        <button
          onClick={handleCreate}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: '#af2896',
            border: 'none',
            color: '#fff',
            padding: '10px 20px',
            borderRadius: 9999,
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          <FiPlus /> Criar artista
        </button>
      </div>

      <Spinner loading={loading && !artists.length}>
        <PendingInvites />
        {!artists.length ? (
          <div
            style={{
              textAlign: 'center',
              padding: '80px 24px',
              color: '#b3b3b3',
            }}
          >
            <p style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>
              Nenhum artista ainda
            </p>
            <p>Crie seu primeiro perfil de artista para começar.</p>
          </div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: 20,
            }}
          >
            {artists.map((a) => {
              const sp = a.content?.spotifyProfile;
              const canDelete = a.role !== 'member';
              return (
                <div
                  key={a.id}
                  role='button'
                  tabIndex={0}
                  onClick={() => navigate(routeFor(a))}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(routeFor(a))}
                  style={{
                    position: 'relative',
                    background: '#181818',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                    textAlign: 'left',
                    transition: 'background-color .2s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#282828';
                    const del = e.currentTarget.querySelector('[data-del]') as HTMLElement | null;
                    if (del) del.style.opacity = '1';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#181818';
                    const del = e.currentTarget.querySelector('[data-del]') as HTMLElement | null;
                    if (del) del.style.opacity = '0';
                  }}
                >
                  {canDelete && (
                    <Popconfirm
                      title='Excluir artista?'
                      description='Catálogo, agenda, equipe e planejamento serão apagados. Esta ação não pode ser desfeita.'
                      okText='Excluir'
                      cancelText='Cancelar'
                      okButtonProps={{ danger: true }}
                      // o popup renderiza dentro do card — impede o clique de navegar para o artista
                      onPopupClick={(e) => e.stopPropagation()}
                      onConfirm={async () => {
                        try {
                          await dispatch(artistsActions.deleteArtist(a.id)).unwrap();
                          message.success(`"${a.name}" excluído.`);
                        } catch (e: any) {
                          message.error(e?.message || 'Erro ao excluir artista');
                        }
                      }}
                    >
                      <button
                        data-del
                        title='Excluir artista'
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          position: 'absolute',
                          top: 10,
                          right: 10,
                          width: 30,
                          height: 30,
                          borderRadius: '50%',
                          border: 'none',
                          background: 'rgba(0,0,0,0.6)',
                          color: '#b3b3b3',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          opacity: 0,
                          transition: 'opacity .15s, color .15s',
                          zIndex: 2,
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = '#e91429')}
                        onMouseLeave={(e) => (e.currentTarget.style.color = '#b3b3b3')}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </Popconfirm>
                  )}
                  <img
                    src={sp?.image || ARTISTS_DEFAULT_IMAGE}
                    alt={a.name}
                    style={{
                      width: '100%',
                      aspectRatio: '1',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      marginBottom: 12,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                    }}
                  />
                  <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>{a.name}</div>
                  {a.role !== 'member' && a.is_locked ? (
                    <span
                      style={{
                        display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 9999,
                        background: 'rgba(80,155,245,0.14)', border: '1px solid rgba(80,155,245,0.4)',
                        color: '#7db4f7', fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Pagamento pendente
                    </span>
                  ) : !isOnboardingComplete(a) ? (
                    <span
                      style={{
                        display: 'inline-block', marginTop: 6, padding: '3px 10px', borderRadius: 9999,
                        background: 'rgba(245,158,11,0.14)', border: '1px solid rgba(245,158,11,0.35)',
                        color: '#f5b15a', fontSize: 12, fontWeight: 700,
                      }}
                    >
                      Planejamento pendente
                    </span>
                  ) : null}
                  <div style={{ color: '#b3b3b3', fontSize: 13, marginTop: 4 }}>
                    {sp?.followers != null
                      ? `${sp.followers.toLocaleString('pt-BR')} seguidores`
                      : a.role === 'member'
                      ? 'Membro'
                      : 'Artista'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Spinner>
    </div>
  );
};

export default Artists;
