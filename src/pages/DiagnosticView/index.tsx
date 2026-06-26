import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spin } from 'antd';
import { FiRotateCcw, FiRefreshCw, FiLock } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PageHeader } from '../../components/PageHeader';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import styles from '../ArtistCreate/ArtistCreate.module.scss';

// Visualização do diagnóstico REAL salvo, acessível a qualquer momento pelo
// artista pago (a partir do Dashboard / Plano de Ação). Sem regerar nada.
const DiagnosticView: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const artist = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const loaded = useAppSelector((s) => s.artists.loaded);

  useEffect(() => {
    if (!loaded && user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [loaded, user?.id, dispatch]);

  const { isPro } = useEntitlements();
  const realIndex = artist?.content?.realIndex ?? null;

  // Refazer diagnóstico (recurso PRO): reabre o quiz REAL pré-preenchido e recalcula o perfil.
  // Quem não é PRO vê o cadeado e vai pra /assinatura.
  const onRedo = () => {
    if (isPro) navigate(`/artists/${id}/diagnostico/refazer`);
    else navigate('/assinatura');
  };
  const cm = artist?.content?.chartmetricProfile;
  const chartmetric: Chartmetric | null = cm
    ? {
        monthly_listeners: cm.monthly_listeners ?? null,
        monthly_listeners_rank: cm.monthly_listeners_rank ?? null,
        career_rank: cm.career_rank ?? null,
        top_cities: cm.top_cities as Chartmetric['top_cities'],
        audience: (cm.audience as Chartmetric['audience']) ?? null,
        playlists: (cm.playlists as Chartmetric['playlists']) ?? null,
        similar: (cm.similar as Chartmetric['similar']) ?? null,
      }
    : null;

  if (!loaded) {
    return (
      <div style={{ padding: 24 }}>
        <div className={styles.analyzing}><Spin /> Carregando…</div>
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      {realIndex && (
        <PageHeader
          kicker="Crescimento"
          title="Diagnóstico REAL"
          subtitle="Sua fase de carreira atual, com base nos seus dados reais. Refaça o diagnóstico quando evoluir."
        />
      )}

      {realIndex ? (
        <DiagnosticReport
          realIndex={realIndex}
          chartmetric={chartmetric}
          artistName={artist?.name}
          artistImage={artist?.content?.spotifyProfile?.image}
          onContinue={() => navigate(`/artists/${id}/wizard`)}
          enableStickyCta={false}
          showPlanningCta={!artist?.content?.strategies?.length}
          hideHero
        />
      ) : (
        <div style={{ background: '#181818', borderRadius: 12, padding: 32, textAlign: 'center', color: '#b3b3b3' }}>
          Este perfil ainda não tem um diagnóstico REAL salvo.
        </div>
      )}

      {/* Loop do ciclo: executou o plano → refaz o REAL → sobe de fase. */}
      {realIndex && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
            marginTop: 24, padding: '14px 18px', borderRadius: 12,
            background: 'rgba(255,255,255,0.03)', border: '1px dashed rgba(255,255,255,0.12)',
          }}
        >
          <FiRotateCcw size={18} style={{ color: '#8a8a92', flexShrink: 0 }} />
          <span style={{ color: '#cfcfd4', fontSize: 13.5 }}>
            Executou o plano e cresceu? <b style={{ color: '#fff' }}>Refaça o REAL</b> pra ver sua fase subir.
          </span>
          <button
            onClick={onRedo}
            title={isPro ? 'Refaça o quiz e atualize seu perfil REAL' : 'Recurso PRO — assine para refazer'}
            style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 8, background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', color: '#fff', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontWeight: 700, fontSize: 13 }}
          >
            {isPro ? <FiRefreshCw size={14} /> : <FiLock size={14} />} Refazer diagnóstico
          </button>
        </div>
      )}
    </div>
  );
};

export default DiagnosticView;
