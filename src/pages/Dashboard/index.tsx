import { FC, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';

import { useArtist } from '../../hooks/useArtist';
import { useJourneyState } from '../../hooks/useJourneyState';
import { Spinner } from '../../components/spinner/spinner';
import { listCatalogProjectItems } from '../../services/db/catalog';
import { CATALOG_STATUS } from '../../constants/maestra';
import type { CatalogItem } from '../../interfaces/maestra';

const fmtNumber = (value?: number | null) =>
  typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';

const Dashboard: FC = () => {
  const navigate = useNavigate();
  const [draftTracks, setDraftTracks] = useState<CatalogItem[]>([]);
  const { artist, loading } = useArtist();
  const journey = useJourneyState(artist);

  useEffect(() => {
    let alive = true;
    if (!artist?.id) return () => { alive = false; };
    listCatalogProjectItems(artist.id)
      .then((items) => alive && setDraftTracks(items))
      .catch(() => alive && setDraftTracks([]));
    return () => { alive = false; };
  }, [artist?.id]);

  if (loading && !artist) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <div className='board-content page-view music-dashboard'>Artista não encontrado.</div>;
  }

  const content = artist.content || {};
  const sp = content.spotifyProfile;
  const chartmetric = content.chartmetricProfile;
  const strategies = content.strategies || [];
  const tracks = content.spotifyCatalog?.tracks || [];
  const albums = content.spotifyCatalog?.albums || [];
  const taskList = strategies.flatMap((strategy) =>
    (strategy.tasks || []).map((task) => ({ ...task, strategyTitle: strategy.title }))
  );
  const pendingTasks = taskList.filter((task) => task.status !== 'done' && task.status !== 'archived');
  const nextTask = pendingTasks[0];
  const activeTracks = tracks.length ? tracks : albums.map((album) => ({
    id: album.id,
    name: album.name,
    album: 'Spotify',
    album_image: album.image,
  }));
  const performanceRows = [
    ...draftTracks.map((track) => ({
      id: track.id,
      title: track.title,
      type: track.genre || (CATALOG_STATUS as any)[track.status]?.label || track.status,
    })),
    ...activeTracks
      .filter((track) => !draftTracks.some((draft) => draft.title?.toLowerCase() === track.name?.toLowerCase()))
      .map((track) => ({
        id: track.id || track.name,
        title: track.name,
        type: track.album || 'Spotify',
      })),
  ].slice(0, 5);
  return (
    <div className='board-content page-view music-dashboard'>
      <section className='music-hero music-hero-task'>
        <div>
          <p>PRÓXIMA TAREFA DO PLANO</p>
          <h1>{nextTask?.description || journey.next.title}</h1>
          <span>{nextTask?.strategyTitle || journey.next.desc}</span>
          <div className='music-hero-task-meta'>
            <b>#01</b>
            <strong>{nextTask?.strategyTitle || journey.next.kicker}</strong>
            <em>{nextTask?.deadline || 'Sem prazo definido'}</em>
          </div>
        </div>
        <button type='button' onClick={() => navigate(`/artists/${artist.id}/action-plan`)}>
          Ver Plano de Ação
        </button>
      </section>

      <section className='music-stat-grid'>
        {[
          ['Ouvintes mensais', fmtNumber(chartmetric?.monthly_listeners), sp?.popularity != null ? `${sp.popularity}/100 popularidade` : 'Spotify'],
          // Seguidores vêm da Chartmetric, não do spotifyProfile: desde Fev/2026 a Web API do
          // Spotify em Dev Mode não devolve mais `followers`, e o fallback pelo token do embed
          // player hoje bate em 429 QUOTA_EXCEEDED. O campo ficava nulo em quase todos os
          // artistas e o card exibia um traço mudo, que lê como "não tem seguidores". A
          // Chartmetric é a mesma fonte que o Diagnóstico REAL já usa pra esse número.
          ['Seguidores', fmtNumber(chartmetric?.sp_followers ?? sp?.followers), 'Spotify'],
          ['Músicas ativas', String(tracks.length), `${albums.length} álbuns/singles`],
          ['Tarefas pendentes', String(pendingTasks.length), `${journey.tasksDone} concluídas`],
        ].map(([label, value, change], index) => (
          <article key={label}>
            <header><i style={{ background: ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] }} /><span>{label}</span></header>
            <strong>{value}</strong>
            <b style={{ color: ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] }}>{change}</b>
            <div className='music-spark' style={{ '--spark': ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] } as CSSProperties} />
          </article>
        ))}
      </section>

      <section className='music-main-grid'>
        <div className='music-left'>
          <article className='release-board'>
            <header>
              <h2>Músicas lançadas</h2>
              <button type='button' onClick={() => navigate(`/artists/${artist.id}/catalog`, { state: { catalogTab: 'spotify' } })}>Ver músicas →</button>
            </header>
            <div>
              {activeTracks.slice(0, 4).map((track, index) => (
                <button type='button' key={track.id || track.name} style={{ '--release': ['#8833ff', '#33bfff', '#ff6633', '#29cc39'][index % 4] } as CSSProperties}>
                  {/* `<i>` é o círculo decorativo do design de referência (sempre translúcido,
                      sem imagem). Com a capa disponível (album_image/image), ela some por trás
                      da própria arte — sem capa, cai de volta no círculo liso. */}
                  <i style={track.album_image ? { backgroundImage: `url(${track.album_image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined} />
                  <span><strong>{track.name}</strong><small>{track.album || 'Spotify'}</small></span>
                  <b>{index === 0 ? 'Em destaque' : 'Publicado'}</b>
                  <em>›</em>
                </button>
              ))}
              {activeTracks.length === 0 && (
                <button type='button' style={{ '--release': '#8833ff' } as CSSProperties}>
                  <i />
                  <span><strong>Sem músicas</strong><small>Conecte o Spotify ou adicione músicas</small></span>
                  <b>Pendente</b>
                  <em>›</em>
                </button>
              )}
            </div>
          </article>

          <div className='music-promo-grid'>
            <article className='promo-card promo-dark'>
              <span>MÚSICAS</span>
              <h2>Organize suas músicas, versões e créditos.</h2>
              <button type='button' onClick={() => navigate(`/artists/${artist.id}/catalog`)}>Abrir músicas →</button>
            </article>
            <article className='promo-card promo-light'>
              <strong>{strategies.length.toString().padStart(2, '0')}</strong>
              <span>Estratégias ativas<br />para o ciclo atual</span>
              <button type='button' onClick={() => navigate(`/artists/${artist.id}/perfil`)}>Ver planejamento →</button>
            </article>
          </div>
        </div>

        <article className='track-performance'>
          <header>
            <h2>Performance das músicas</h2>
            <span>Ouvintes&nbsp;&nbsp;&nbsp;&nbsp;Crescimento</span>
          </header>
          {performanceRows.map((track, index) => (
            <div key={track.id || track.title}>
              <i>{index + 1}</i>
              <span className='track-dot' style={{ background: ['#8833ff', '#33bfff', '#ff6633', '#29cc39', '#e62e7b'][index % 5] }} />
              <strong>{track.title}<small>{track.type}</small></strong>
              <b>{fmtNumber(chartmetric?.monthly_listeners)}</b>
              <em>{index === 0 ? '+18,5%' : '+0,0%'}</em>
            </div>
          ))}
          {performanceRows.length === 0 && <p>Nenhuma música cadastrada ainda.</p>}
          <button type='button' onClick={() => navigate(`/artists/${artist.id}/catalog`)}>Ver músicas</button>
        </article>
      </section>

      <section className='music-footer'>
        <article><i>◷</i><h2>Suporte 24/7</h2><p>Conte com o time Maestra em cada etapa.</p></article>
        <article><i>◌</i><h2>Dados seguros</h2><p>Suas músicas e informações sempre protegidas.</p></article>
        <article><i>♬</i><h2>Novidades da indústria</h2><p>Curadoria para apoiar decisões da carreira.</p></article>
      </section>
    </div>
  );
};

export default Dashboard;
