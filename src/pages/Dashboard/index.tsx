import { FC, useEffect, useState } from 'react';
import type { CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLifeBuoy, FiMusic, FiShield } from 'react-icons/fi';

import { useArtist } from '../../hooks/useArtist';
import { useJourneyState } from '../../hooks/useJourneyState';
import { Spinner } from '../../components/spinner/spinner';
import { listCatalogProjectItems } from '../../services/db/catalog';
import { CATALOG_STATUS } from '../../constants/maestra';
import { TASK_TYPES } from '../ActionPlan/TaskControls';
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
  // Rótulo da categoria da tarefa, da mesma fonte que o Plano de Ação usa nos chips. Fica nulo
  // quando a tarefa não tem categoria — hoje a esmagadora maioria (a categoria é opcional e
  // preenchida à mão no plano), e um chip "Sem categoria" em toda tela seria pior que o texto
  // repetido que ele substituiu.
  const taskCategory = nextTask
    ? TASK_TYPES.find((t) => t.v === nextTask.type)?.label ?? null
    : journey.next.kicker;
  const activeTracks = tracks.length ? tracks : albums.map((album) => ({
    id: album.id,
    name: album.name,
    album: 'Spotify',
    album_image: album.image,
    spotify_url: album.spotify_url,
  }));
  // "Performance das músicas" mostra o catálogo cadastrado na plataforma — a MESMA lista (e
  // ordem: mais recém-atualizada primeiro) que o módulo Músicas exibe por padrão — em vez do
  // blend com faixas do Spotify que havia aqui antes. Álbum/single só publicado no Spotify e
  // nunca cadastrado como projeto no catálogo não aparece; é essa a distinção que o módulo
  // Músicas também faz.
  const performanceRows = draftTracks
    .map((track) => ({
      id: track.id,
      title: track.title,
      type: track.genre || (CATALOG_STATUS as any)[track.status]?.label || track.status,
    }))
    .slice(0, 5);
  return (
    <div className='board-content page-view music-dashboard'>
      <section className='music-hero music-hero-task'>
        <div>
          <p>PRÓXIMA TAREFA DO PLANO</p>
          <h1>{nextTask?.description || journey.next.title}</h1>
          <span>{nextTask?.strategyTitle || journey.next.desc}</span>
          {/* O chip do meio repetia `strategyTitle`, que o <span> logo acima já mostra por
              inteiro — texto longo cortado com reticências, sem informação nova. Passa a
              mostrar a CATEGORIA da tarefa (Design, Show, Rádio…): curta, cabe na pílula e não
              aparece em nenhum outro ponto do hero. Sem categoria, o chip simplesmente não
              entra e sobram #01 e prazo. */}
          <div className='music-hero-task-meta'>
            <b>#01</b>
            {taskCategory && <strong>{taskCategory}</strong>}
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
                <button
                  type='button'
                  key={track.id || track.name}
                  style={{ '--release': ['#8833ff', '#33bfff', '#ff6633', '#29cc39'][index % 4] } as CSSProperties}
                  // Abre a faixa no Spotify — mesmo destino do link que o catálogo já usa pra
                  // "Ouvir no Spotify". Sem spotify_url (ex.: faixa só teve o álbum indexado) o
                  // clique não faz nada; não vale a pena desabilitar o botão por isso, o resto
                  // do card ainda é informativo.
                  onClick={() => track.spotify_url && window.open(track.spotify_url, '_blank', 'noopener,noreferrer')}
                >
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

      {/* Os ícones eram caracteres soltos (◷ ◌ ♬): tamanho e peso variavam por fonte, e o ◌
          mal aparecia. Viraram ícones do mesmo set (react-icons/fi) já usado no resto do app.
          Só o Suporte leva a algum lugar — os outros dois são informativos, então continuam
          como <article> e não fingem ser clicáveis. */}
      <section className='music-footer'>
        <article
          className='music-footer-action'
          role='button'
          tabIndex={0}
          onClick={() => navigate('/suporte')}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); navigate('/suporte'); } }}
        >
          <i><FiLifeBuoy /></i>
          <h2>Suporte</h2>
          <p>Conte com o time Maestra em cada etapa.</p>
        </article>
        <article><i><FiShield /></i><h2>Dados seguros</h2><p>Suas músicas e informações sempre protegidas.</p></article>
        <article><i><FiMusic /></i><h2>Novidades da indústria</h2><p>Curadoria para apoiar decisões da carreira.</p></article>
      </section>
    </div>
  );
};

export default Dashboard;
