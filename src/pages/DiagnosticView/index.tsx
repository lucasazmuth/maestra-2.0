import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spin } from 'antd';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useEntitlements } from '../../hooks/useEntitlements';
import { PageHeader } from '../../components/PageHeader';
import { RedoRealBanner } from '../../components/RedoRealBanner';
import { PRODUCT_THEME, pageBg } from '../../components/productTheme';
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
    <div style={{ padding: 24, minHeight: '100%', ...pageBg(PRODUCT_THEME.real.accent) }}>
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
          // Banner do loop logo abaixo do card "Seu perfil de carreira".
          belowProfile={<RedoRealBanner onRedo={onRedo} locked={!isPro} marginTop={18} />}
        />
      ) : (
        <div style={{ background: '#181818', borderRadius: 12, padding: 32, textAlign: 'center', color: '#b3b3b3' }}>
          Este perfil ainda não tem um diagnóstico REAL salvo.
        </div>
      )}
    </div>
  );
};

export default DiagnosticView;
