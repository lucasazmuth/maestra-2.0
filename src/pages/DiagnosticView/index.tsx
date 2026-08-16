import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FiLock, FiRefreshCw } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useEntitlements } from '../../hooks/useEntitlements';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import reportStyles from '../ArtistCreate/ArtistCreate.module.scss';
import { Spinner } from '../../components/spinner/spinner';

const DiagnosticView: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const artist = useAppSelector((state) => state.artists.items.find((item) => item.id === id));
  const loaded = useAppSelector((state) => state.artists.loaded);
  const { isPro } = useEntitlements();

  // Loop de crescimento: executou o plano e cresceu? Refaz o REAL pra fase subir. É recurso PRO —
  // quem não é vai pra /assinatura. Esta é a ÚNICA entrada para /diagnostico/refazer; sem ela a
  // rota fica registrada e inalcançável.
  const onRedo = () => {
    if (isPro) navigate(`/artists/${id}/diagnostico/refazer`);
    else navigate('/assinatura');
  };

  // Refazer é do DONO do perfil. A edge `artist-diagnostic` filtra por
  // `.eq("id", redoArtistId).eq("user_id", user.id)` e devolve 404 quando não bate — então um
  // colaborador via o botão, atravessava o quiz inteiro e a etapa "analisando" para receber
  // "Não consegui gerar seu diagnóstico agora", que soa como falha temporária e não como falta
  // de permissão. A condição aqui é a MESMA do servidor, para os dois não divergirem.
  const souDonoDoPerfil = Boolean(artist?.user_id && user?.id && artist.user_id === user.id);

  useEffect(() => {
    if (!loaded && user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [loaded, user?.id, dispatch]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Diagnóstico REAL · Maestra';
    return () => { document.title = previousTitle; };
  }, []);

  if (!loaded) {
    return <div className={reportStyles.pageReal}><Spinner loading>{null as any}</Spinner></div>;
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

  return (
    <div className={`board-content page-view workspace-view ${reportStyles.pageReal}`}>
      <header className={reportStyles.diagnosticPageHeader}>
        <div>
          <p>Onde você está</p>
          <h1>Diagnóstico REAL</h1>
          <span>Sua fase de carreira atual, com base nos seus dados reais.</span>
        </div>
        {souDonoDoPerfil && (
          <div className={reportStyles.headerActions}>
            <button
              type="button"
              className={reportStyles.headerGhost}
              onClick={onRedo}
              title={isPro ? 'Refazer o diagnóstico e atualizar sua fase' : 'Refazer o diagnóstico é um recurso PRO'}
            >
              {isPro ? <FiRefreshCw size={14} /> : <FiLock size={14} />}
              Refazer diagnóstico
            </button>
          </div>
        )}
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
