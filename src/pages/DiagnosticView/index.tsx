import { FC, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Spin } from 'antd';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import reportStyles from '../ArtistCreate/ArtistCreate.module.scss';

const DiagnosticView: FC = () => {
  const dispatch = useAppDispatch();
  const { id } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const artist = useAppSelector((state) => state.artists.items.find((item) => item.id === id));
  const loaded = useAppSelector((state) => state.artists.loaded);

  useEffect(() => {
    if (!loaded && user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [loaded, user?.id, dispatch]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Diagnóstico REAL · Maestra';
    return () => { document.title = previousTitle; };
  }, []);

  if (!loaded) {
    return <div className={reportStyles.pageReal} style={{ padding: 24 }}><Spin /> Carregando...</div>;
  }

  const realIndex = artist?.content?.realIndex;
  if (!artist || !realIndex) {
    return (
      <div className={`board-content page-view workspace-view ${reportStyles.pageReal}`}>
        <section className={reportStyles.realProfileCard}>
          <span className={reportStyles.realProfileKicker}>Diagnóstico REAL</span>
          <h1 className={reportStyles.realProfileName}>Diagnóstico indisponível</h1>
          <p className={reportStyles.realProfileDesc}>Este perfil ainda não tem um diagnóstico REAL salvo.</p>
        </section>
      </div>
    );
  }

  const spotifyProfile = artist.content?.spotifyProfile;
  const handleShare = async () => {
    const shareData = {
      title: 'Diagnóstico REAL',
      text: `Diagnóstico REAL de ${artist.name}`,
      url: window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // Closing the native share sheet does not require a UI error state.
      }
      return;
    }

    await navigator.clipboard?.writeText(window.location.href);
  };

  return (
    <div className={`board-content page-view workspace-view ${reportStyles.pageReal}`}>
      <header className={reportStyles.diagnosticPageHeader}>
        <div>
          <p>Onde você está</p>
          <h1>Diagnóstico REAL</h1>
          <span>Sua fase de carreira atual, com base nos seus dados reais.</span>
        </div>
        <button type="button" onClick={() => void handleShare()}>Compartilhar</button>
      </header>
      <DiagnosticReport
        realIndex={realIndex}
        chartmetric={artist.content?.chartmetricProfile as Chartmetric | null}
        artistName={artist.name}
        artistImage={spotifyProfile?.image ?? null}
        noSpotify={!spotifyProfile?.spotify_artist_id}
        enableStickyCta={false}
        showPlanningCta={false}
        hideHero
      />
    </div>
  );
};

export default DiagnosticView;
