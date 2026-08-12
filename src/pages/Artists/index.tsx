import { FC, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App } from 'antd';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useCanCreateArtist } from '../../hooks/useCanCreateArtist';
import { formatRemainingTime } from '../../utils/rateLimitCalc';
import { Spinner } from '../../components/spinner/spinner';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import styles from './Artists.module.scss';

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
    <main className={`profile-home-content ${styles.page}`}>
      <header className={styles.heading}>
        <h1>Seus perfis</h1>
        <button
          type='button'
          onClick={handleCreate}
        >
          ＋ Criar perfil
        </button>
      </header>
      <p>Escolha um perfil para abrir seu espaço de trabalho.</p>

      <Spinner loading={loading && !artists.length}>
        {artists.length > 0 && (
          <div className={`home-profile-directory ${styles.grid}`}>
            {artists.map((a) => {
              const sp = a.content?.spotifyProfile;
              return (
                <button
                  className={styles.card}
                  type='button'
                  key={a.id}
                  onClick={() => navigate(routeFor(a))}
                >
                  <img
                    src={sp?.image || ARTISTS_DEFAULT_IMAGE}
                    alt={a.name}
                  />
                  <strong>{a.name}</strong>
                  <span>{a.role === 'member' ? 'Membro' : 'Administrador'}</span>
                </button>
              );
            })}
          </div>
        )}
      </Spinner>
    </main>
  );
};

export default Artists;
