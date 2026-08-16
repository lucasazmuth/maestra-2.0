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
import { useLocalPlayerStore } from '../../stores/localPlayerStore';
import type { LocalTrack } from '../../components/LocalPlayerBar';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';

const fmtNumber = (value?: number | null) =>
  typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';

// Mesmo tratamento do selo de status do módulo Músicas: a cor do próprio status, com o fundo
// numa transparência dela (o `22` é o alpha em hex).
const statusStyle = (status: string) => {
  const cfg = (CATALOG_STATUS as any)[status] || { color: '#6b7280' };
  return { background: `${cfg.color}22`, color: cfg.color };
};

const Dashboard: FC = () => {
  const navigate = useNavigate();
  const [draftTracks, setDraftTracks] = useState<CatalogItem[]>([]);
  const { artist, loading } = useArtist();
  const journey = useJourneyState(artist);
  const playerCurrentId = useLocalPlayerStore((s) => s.currentId);
  const playerPlaying = useLocalPlayerStore((s) => s.playing);
  const togglePlayer = useLocalPlayerStore((s) => s.toggle);
  const setPlayerTracks = useLocalPlayerStore((s) => s.setTracks);
  const setPlayerCurrentId = useLocalPlayerStore((s) => s.setCurrentId);
  const setPlayerOpen = useLocalPlayerStore((s) => s.setOpen);

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
  // O card lista o catálogo cadastrado na plataforma — a MESMA lista, ordem (mais recém-
  // atualizada primeiro) e colunas que o módulo Músicas mostra. Álbum/single só publicado no
  // Spotify e nunca cadastrado como projeto não aparece; é a mesma distinção que o módulo faz.
  const catalogRows = draftTracks.slice(0, 5).map((track) => ({
    id: track.id,
    projectId: track.project_id || track.id,
    title: track.title,
    version: `V${track.version_number || 1}`,
    genre: track.genre || '—',
    status: track.status,
    hasAudio: !!track.audio_file,
  }));

  // Fila do player: mesma montagem do módulo Músicas (LocalTrack). O player é global — mora no
  // Layout e é comandado pelo store —, então o play daqui toca de verdade, sem sair da tela.
  const playerQueue: LocalTrack[] = draftTracks.map((t) => ({
    id: t.id,
    title: t.title,
    // Mesma legenda do módulo Músicas: qual versão está tocando, já que a fila usa a principal.
    subtitle: t.audio_file
      ? `V${t.version_number || 1} · versão principal`
      : 'Áudio pendente',
    cover: t.cover_image,
    url: t.audio_file || '',
  }));

  const playTrack = (id: string) => {
    if (playerCurrentId === id) { togglePlayer?.(); return; } // já é a faixa atual: pausa/retoma
    setPlayerTracks(playerQueue);
    setPlayerCurrentId(id);
    setPlayerOpen(true);
  };
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

        {/* Este card se chamava "Performance das músicas" e mostrava ouvintes/crescimento, mas os
            números eram decorativos: o mesmo total de ouvintes MENSAIS do artista repetido em
            toda linha e um "+18,5%" fixo no primeiro item. Não existe métrica por faixa nos
            dados hoje, então o card passa a ser o que de fato consegue mostrar — o catálogo,
            com as colunas do módulo Músicas. */}
        <article className='track-performance'>
          <header>
            <h2>Músicas</h2>
          </header>
          {/* Rótulos das colunas na MESMA grade das linhas. Antes eram um texto solto
              ("Tipo    Status") no canto do cabeçalho, separado por espaços — não caía sobre as
              colunas que nomeava, e a leitura não fechava. */}
          {catalogRows.length > 0 && (
            <div className='track-performance-cols' aria-hidden>
              <i /><strong>Música</strong><b>Tipo</b><em>Status</em>
            </div>
          )}
          {catalogRows.map((track) => {
            const isCurrent = playerCurrentId === track.id;
            const isPlaying = isCurrent && playerPlaying;
            return (
              <div
                key={track.id}
                role='button'
                tabIndex={0}
                title='Abrir o Espaço Jam desta música'
                onClick={() => navigate(`/artists/${artist.id}/catalog/projects/${track.projectId}`)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    navigate(`/artists/${artist.id}/catalog/projects/${track.projectId}`);
                  }
                }}
              >
                {/* Mesmo play do módulo Músicas, e tocando de verdade: o player é global. O
                    clique não pode subir pra linha, senão tocar também navegaria pra fora. */}
                <button
                  className='catalog-track-play'
                  type='button'
                  title={!track.hasAudio ? 'Abrir player — áudio pendente' : isPlaying ? 'Pausar' : 'Tocar'}
                  onClick={(e) => { e.stopPropagation(); playTrack(track.id); }}
                >
                  {isPlaying ? (
                    <svg viewBox='0 0 16 16' width='11' height='11' fill='currentColor'>
                      <path d='M2.7 1a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7H2.7zm8 0a.7.7 0 0 0-.7.7v12.6a.7.7 0 0 0 .7.7h2.6a.7.7 0 0 0 .7-.7V1.7a.7.7 0 0 0-.7-.7h-2.6z' />
                    </svg>
                  ) : (
                    <svg viewBox='0 0 16 16' width='11' height='11' fill='currentColor'>
                      <path d='M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288V1.713z' />
                    </svg>
                  )}
                </button>
                <strong>{track.title}<small>{track.version}</small></strong>
                <b>{track.genre}</b>
                <em className='track-status' style={statusStyle(track.status)}>
                  {(CATALOG_STATUS as any)[track.status]?.label || track.status}
                </em>
              </div>
            );
          })}
          {catalogRows.length === 0 && <p>Nenhuma música cadastrada ainda.</p>}
          <button type='button' onClick={() => navigate(`/artists/${artist.id}/catalog`)}>Ver músicas</button>
        </article>
      </section>

      {/* Os ícones eram caracteres soltos (◷ ◌ ♬): tamanho e peso variavam por fonte, e o ◌
          mal aparecia. Viraram ícones do mesmo set (react-icons/fi) já usado no resto do app.
          Só o Suporte leva a algum lugar — os outros dois são informativos, então continuam
          como <article> e não fingem ser clicáveis. */}
      {/* Consultora da Nyta. Vinha renderizada no Plano de Ação, onde disputava a atenção com as
          tarefas; aqui fecha o painel, depois de tudo que a pessoa veio consultar. Fica ANTES da
          faixa de Suporte/Dados/Novidades, que é rodapé informativo e encerra a página. */}
      <NytaDashboardHero />

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
