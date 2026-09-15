import { FC, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiCheck, FiFileText, FiLifeBuoy, FiStar } from 'react-icons/fi';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { pilaresDoPainel, type Pilar } from '@maestra/core/nucleo/pilaresDoPainel';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { Spinner } from '../../components/spinner/spinner';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { PillarCards, type SecaoDoPainel } from '../../components/dashboard/PillarCards';
import { PlatformReviewModal } from '../../components/PlatformReviewModal';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';

// A home do artista, e a porta do método.
//
// Ela abre com os TRÊS PILARES (onde estou, execução, para onde ir) porque Diagnóstico, Plano de
// Ação e Planejamento saíram da navegação: estes cartões são o único caminho até eles. O que vem
// depois é consulta, na ordem em que se consulta: a Nyta, os números, as músicas e o rodapé.
//
// O que saiu daqui, e por quê: o herói da próxima tarefa (virou o cartão de Execução, que diz a
// mesma coisa e leva ao mesmo lugar), os dois cartões promo (um repetia o módulo Músicas, o outro
// virou a linha do cartão de Planejamento) e a lista do catálogo com tocador (ela existe igual,
// com o mesmo tocador global, dentro de Músicas).

const fmtNumber = (value?: number | null) =>
  typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';

const secaoDaUrl = (search: string): SecaoDoPainel => {
  const aba = new URLSearchParams(search).get('aba');
  return aba === 'diagnostico' || aba === 'execucao' || aba === 'planejamento' ? aba : 'visao-geral';
};

/** Um cartão do rodapé. Os três levam a algum lugar, então os três são alvo de clique e de foco. */
const Atalho: FC<{ icone: ReactNode; titulo: string; texto: string; aoAbrir: () => void }> = ({
  icone, titulo, texto, aoAbrir,
}) => (
  <article
    className='music-footer-action'
    role='button'
    tabIndex={0}
    onClick={aoAbrir}
    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); aoAbrir(); } }}
  >
    <i>{icone}</i>
    <h2>{titulo}</h2>
    <p>{texto}</p>
  </article>
);

const PainelDoMetodo: FC<{
  pilar: Pilar;
  artist: Artist;
  aoAbrir: () => void;
  podeRefazer: boolean;
}> = ({ pilar, artist, aoAbrir, podeRefazer }) => {
  const content = artist.content || {};
  const strategies = content.strategies || [];
  const tasks = strategies.flatMap((strategy) => strategy.tasks || []).filter((task) => task.status !== 'archived');
  const pending = tasks.filter((task) => task.status !== 'done').slice(0, 5);
  const objectives = content.objectives || [];
  const real = content.realIndex;

  if (pilar.chave === 'diagnostico' && real) {
    return (
      <section className='method-view method-view-diagnostico method-view-report' aria-label='Relatório completo do Diagnóstico REAL'>
        <DiagnosticReport
          realIndex={real}
          chartmetric={content.chartmetricProfile as Chartmetric | null}
          artistId={artist.id}
          vinculo={(content as any)?.titularidade?.vinculo}
          artistName={artist.name}
          artistImage={content.spotifyProfile?.image ?? null}
          noSpotify={!content.spotifyProfile?.spotify_artist_id}
          enableStickyCta={false}
          showPlanningCta={false}
          hideHero={false}
          onRedo={aoAbrir}
          redoLocked={!podeRefazer}
        />
      </section>
    );
  }

  return (
    <section className={`method-view method-view-${pilar.chave}`} aria-labelledby={`method-${pilar.chave}`}>
      <header className='method-view-header'>
        <div>
          <span>{pilar.rotulo}</span>
          <h1 id={`method-${pilar.chave}`}>{pilar.titulo}</h1>
          <p>{pilar.linha}</p>
        </div>
        <button type='button' onClick={aoAbrir}>{pilar.cta}<FiArrowRight aria-hidden /></button>
      </header>

      {pilar.chave === 'diagnostico' && (
        <div className='method-diagnostic-grid'>
          <article className='method-primary-card'>
            <span>FASE ATUAL</span>
            <strong>{real?.profile?.name || 'Ainda não medida'}</strong>
            <p>{real?.profile?.description || pilar.detalhe || 'Faça o diagnóstico para descobrir o momento da sua carreira.'}</p>
          </article>
          <article className='method-real-card'>
            <span>DIMENSÕES REAL</span>
            <div>{['R', 'E', 'A', 'L'].map((letra, index) => <i key={letra} className={pilar.marcas?.[index] ? 'acesa' : ''}>{letra}</i>)}</div>
            <p>{pilar.marcas?.filter(Boolean).length || 0} de 4 dimensões acesas</p>
          </article>
        </div>
      )}

      {pilar.chave === 'execucao' && (
        <div className='method-execution-grid'>
          <article className='method-progress-card'>
            <span>PROGRESSO DO PLANO</span>
            <strong>{pilar.progresso?.pct || 0}%</strong>
            <div><i style={{ width: `${pilar.progresso?.pct || 0}%` }} /></div>
            <p>{pilar.detalhe || 'As próximas tarefas aparecem aqui conforme o plano avança.'}</p>
          </article>
          <article className='method-list-card'>
            <header><span>PRÓXIMAS TAREFAS</span><b>{pending.length}</b></header>
            {(pending.length ? pending : [{ id: 'empty', description: 'Nenhuma tarefa pendente.', status: 'done', deadline: '' }]).map((task) => (
              <div key={task.id}><i>{task.status === 'done' ? <FiCheck /> : null}</i><span>{task.description}</span><small>{task.deadline || ''}</small></div>
            ))}
          </article>
        </div>
      )}

      {pilar.chave === 'planejamento' && (
        <div className='method-planning-grid'>
          <article className='method-primary-card'>
            <span>VISÃO</span>
            <strong>{content.identity?.vision || 'Defina onde você quer chegar.'}</strong>
            <p>{content.identity?.mission || 'Sua missão e sua visão orientam todas as escolhas do plano.'}</p>
          </article>
          <article className='method-list-card'>
            <header><span>OBJETIVOS DO CICLO</span><b>{objectives.length}</b></header>
            {(objectives.length ? objectives.slice(0, 5) : ['Nenhum objetivo definido.']).map((objective, index) => (
              <div key={objective}><i>{String(index + 1).padStart(2, '0')}</i><span>{objective}</span></div>
            ))}
          </article>
          <article className='method-list-card method-strategies-card'>
            <header><span>ESTRATÉGIAS ATIVAS</span><b>{strategies.length}</b></header>
            {(strategies.length ? strategies.slice(0, 5).map((item) => item.title) : ['Nenhuma estratégia definida.']).map((strategy, index) => (
              <div key={strategy}><i>{String(index + 1).padStart(2, '0')}</i><span>{strategy}</span></div>
            ))}
          </article>
        </div>
      )}
    </section>
  );
};

const Dashboard: FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { artist, loading } = useArtist();
  const journey = useJourneyState(artist);
  const capabilities = useArtistCapabilities(artist);
  // A avaliação abre daqui, com estado próprio: o `reviewOpen` do Layout é privado dele.
  const [avaliando, setAvaliando] = useState(false);
  const [secao, setSecao] = useState<SecaoDoPainel>(() => secaoDaUrl(location.search));

  if (loading && !artist) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <div className='board-content page-view music-dashboard'>Artista não encontrado.</div>;
  }

  const content = artist.content || {};
  const sp = content.spotifyProfile;
  const chartmetric = content.chartmetricProfile;
  const tracks = content.spotifyCatalog?.tracks || [];
  const albums = content.spotifyCatalog?.albums || [];
  const activeTracks = tracks.length ? tracks : albums.map((album) => ({
    id: album.id,
    name: album.name,
    album: 'Spotify',
    album_image: album.image,
    spotify_url: album.spotify_url,
  }));
  const pilares = pilaresDoPainel(artist, journey, capabilities);
  const pilarAtivo = pilares.find((pilar) => pilar.chave === secao);

  return (
    <div className='board-content page-view music-dashboard'>
      <PillarCards artist={artist} ativa={secao} onSelect={setSecao} />

      {pilarAtivo ? (
        <PainelDoMetodo
          pilar={pilarAtivo}
          artist={artist}
          podeRefazer={capabilities.manageTasks}
          aoAbrir={() => {
            const rota = pilarAtivo.chave === 'diagnostico'
              ? capabilities.manageTasks ? `/artists/${artist.id}/diagnostico/refazer` : '/planos'
              : pilarAtivo.chave === 'execucao'
                ? `/artists/${artist.id}/action-plan`
                : `/artists/${artist.id}/perfil`;
            navigate(rota);
          }}
        />
      ) : <>

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
          ['Tarefas pendentes', String(journey.tasksPending), `${journey.tasksDone} concluídas`],
        ].map(([label, value, change], index) => (
          <article key={label}>
            <header><i style={{ background: ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] }} /><span>{label}</span></header>
            <strong>{value}</strong>
            <b style={{ color: ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] }}>{change}</b>
            <div className='music-spark' style={{ '--spark': ['#29cc39', '#3361ff', '#8833ff', '#ffcb33'][index] } as CSSProperties} />
          </article>
        ))}
      </section>

      {/* Sem a coluna da direita (a lista do catálogo, que agora só vive em Músicas), a grade de
          duas colunas perdeu a razão: o quadro dos lançamentos ocupa a largura toda. */}
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

      {/* Depois dos números e das músicas, a Nyta ajuda a interpretar o que a pessoa acabou de
          ver. A ordem evita que o chat esconda os dados principais na primeira dobra. */}
      <NytaDashboardHero />

      {/* O rodapé encerra a página com o que é da CONTA, não da carreira. Os três levam a algum
          lugar: antes, dois deles eram cartões informativos que não faziam nada, e a pessoa
          clicava neles à espera de que fizessem. Avaliar e Termos também vivem em Configurações;
          aqui eles fecham a home, lá eles são a lista da conta. */}
      <section className='music-footer'>
        <Atalho
          icone={<FiLifeBuoy />}
          titulo='Suporte'
          texto='Conte com o time Maestra em cada etapa.'
          aoAbrir={() => navigate('/suporte')}
        />
        <Atalho
          icone={<FiStar />}
          titulo='Avalie a Maestra'
          texto='Sua nota ajuda a decidir o que vem depois.'
          aoAbrir={() => setAvaliando(true)}
        />
        <Atalho
          icone={<FiFileText />}
          titulo='Termos de uso'
          texto='Como a Maestra trata seus dados e sua música.'
          aoAbrir={() => navigate('/legal/termos')}
        />
      </section>
      </>}

      <PlatformReviewModal open={avaliando} onClose={() => setAvaliando(false)} />
    </div>
  );
};

export default Dashboard;
