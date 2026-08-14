import { FC, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { App, Popconfirm } from 'antd';
import { FiTrash2 } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useCanCreateArtist } from '../../hooks/useCanCreateArtist';
import { formatRemainingTime } from '../../utils/rateLimitCalc';
import PendingInvites from '../../components/PendingInvites';
import { Spinner } from '../../components/spinner/spinner';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import { artistEntryRoute, isOnboardingComplete } from '../../constants/maestra';
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

      <PendingInvites />

      <Spinner loading={loading && !artists.length}>
        {artists.length > 0 && (
          <div className={`home-profile-directory ${styles.grid}`}>
            {artists.map((a) => {
              const sp = a.content?.spotifyProfile;
              const owner = a.role !== 'member';
              // Estado do perfil, na ordem em que importa pro usuário: cobrança em aberto trava
              // tudo; sem plano, o próximo passo é o planejamento.
              const status = owner && a.is_locked
                ? { tone: styles.statusLocked, label: 'Pagamento pendente' }
                : !isOnboardingComplete(a)
                ? { tone: styles.statusPlan, label: 'Planejamento não iniciado' }
                : null;

              return (
                // O card é um <button>; excluir precisa ser um controle irmão, e não aninhado
                // (button dentro de button é HTML inválido e o clique não isola).
                <div className={styles.cardWrap} key={a.id}>
                  <button
                    className={styles.card}
                    type='button'
                    onClick={() => navigate(artistEntryRoute(a))}
                  >
                    <img
                      src={sp?.image || ARTISTS_DEFAULT_IMAGE}
                      alt={a.name}
                    />
                    <strong>{a.name}</strong>
                    <span>{a.role === 'member' ? 'Membro' : 'Administrador'}</span>
                    {status && (
                      <em className={`${styles.status} ${status.tone}`}>
                        <i aria-hidden />
                        {status.label}
                      </em>
                    )}
                    {sp?.followers != null && (
                      <span className={styles.followers}>
                        {sp.followers.toLocaleString('pt-BR')} seguidores
                      </span>
                    )}
                  </button>

                  {owner && (
                    <Popconfirm
                      title='Excluir artista?'
                      description='Essa ação não pode ser desfeita.'
                      okText='Excluir'
                      cancelText='Cancelar'
                      okButtonProps={{ danger: true }}
                      onConfirm={async () => {
                        try {
                          await dispatch(artistsActions.deleteArtist(a.id)).unwrap();
                          message.success('Perfil excluído');
                        } catch {
                          message.error('Erro ao excluir o perfil');
                        }
                      }}
                    >
                      <button
                        type='button'
                        className={styles.deleteButton}
                        title='Excluir artista'
                        aria-label={`Excluir ${a.name}`}
                      >
                        <FiTrash2 size={15} />
                      </button>
                    </Popconfirm>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Spinner>
    </main>
  );
};

export default Artists;
