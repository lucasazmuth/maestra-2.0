import { FC, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';

import { FiLock, FiRefreshCw } from 'react-icons/fi';

import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';
import { artistsActions } from '@maestra/core/store/slices/artists';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import { CABECALHO_DA_REVISITA } from '@maestra/core/constants/realCopy';
import reportStyles from '../ArtistCreate/ArtistCreate.module.scss';
import { Spinner } from '../../components/spinner/spinner';

const DiagnosticView: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAppSelector((state) => state.auth.user);
  const artist = useAppSelector((state) => state.artists.items.find((item) => item.id === id));
  const loaded = useAppSelector((state) => state.artists.loaded);

  // Loop de crescimento: executou o plano e cresceu? Refaz o REAL pra fase subir. É recurso PRO —
  // quem não é vai pra /assinatura. Esta é a ÚNICA entrada para /diagnostico/refazer; sem ela a
  // rota fica registrada e inalcançável.
  const onRedo = () => {
    if (capacidades.manageTasks) navigate(`/artists/${id}/diagnostico/refazer`);
    else navigate('/assinatura');
  };

  // Quem pode refazer é quem o MODELO diz: `manageTasks` — "edições avançadas (adicionar
  // estratégia/tarefa, editar/excluir campos, refazer diagnóstico): PRO obrigatório pra TODOS
  // (inclusive dono); membro também precisa do nível 'plan'/'full'".
  //
  // Estava amarrado a ser DONO, e não era isso que o modelo dizia: um membro com acesso total —
  // que a dona do perfil escolheu deliberadamente — não via o botão. A edge fazia o mesmo corte,
  // e mudou junto: as duas continuam iguais, na regra certa.
  const capacidades = useArtistCapabilities(artist);
  const souDonoDoPerfil = capacidades.isOwner || capacidades.editPlanning;

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
          <p>{CABECALHO_DA_REVISITA.chapeu}</p>
          <h1>{CABECALHO_DA_REVISITA.titulo}</h1>
          <span>{CABECALHO_DA_REVISITA.apoio}</span>
        </div>
        {souDonoDoPerfil && (
          <div className={reportStyles.headerActions}>
            <button
              type="button"
              className={reportStyles.headerGhost}
              onClick={onRedo}
              title={capacidades.manageTasks ? 'Refazer o diagnóstico e atualizar sua fase' : 'Refazer o diagnóstico é um recurso PRO'}
            >
              {capacidades.manageTasks ? <FiRefreshCw size={14} /> : <FiLock size={14} />}
              Refazer diagnóstico
            </button>
          </div>
        )}
      </header>
      <DiagnosticReport
        realIndex={realIndex}
        chartmetric={artist.content?.chartmetricProfile as Chartmetric | null}
        artistId={artist.id}
        vinculo={(artist.content as any)?.titularidade?.vinculo}
        artistName={artist.name}
        artistImage={spotifyProfile?.image ?? null}
        noSpotify={!spotifyProfile?.spotify_artist_id}
        enableStickyCta={false}
        showPlanningCta={false}
        hideHero
        // O aviso de "diagnóstico em versão anterior" (§13.2) traz a saída junto do texto: quem lê
        // que a leitura está velha precisa poder refazer ali, sem procurar o botão do topo.
        onRedo={souDonoDoPerfil ? onRedo : undefined}
        redoLocked={!capacidades.manageTasks}
      />
    </div>
  );
};

export default DiagnosticView;
