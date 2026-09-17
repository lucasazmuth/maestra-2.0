import { FC, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import ReactMarkdown from 'react-markdown';
import { useLocation, useNavigate } from 'react-router-dom';
import { FiArrowRight, FiLifeBuoy, FiStar, FiUsers } from 'react-icons/fi';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { useJourneyState } from '@maestra/core/hooks/useJourneyState';
import { useArtistCapabilities } from '@maestra/core/hooks/useArtistCapabilities';
import { useIsPlatformAdmin } from '@maestra/core/hooks/useIsPlatformAdmin';
import { pilaresDoPainel, type Pilar } from '@maestra/core/nucleo/pilaresDoPainel';
import type { Artist } from '@maestra/core/interfaces/maestra';
import { altasForPattern, tierForAltas } from '@maestra/core/constants/realBadge';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import { Spinner } from '../../components/spinner/spinner';
import { RealBadge } from '../../components/RealBadge';
import { NytaDashboardHero } from '../../components/nyta/NytaDashboardHero';
import { PillarCards, type SecaoDoPainel } from '../../components/dashboard/PillarCards';
import { PlatformReviewModal } from '../../components/PlatformReviewModal';
import ReferenceMindMap from '../../components/ReferenceMindMap';
import { DiagnosticReport, type Chartmetric } from '../ArtistCreate/DiagnosticReport';
import ActionPlan from '../ActionPlan';

// A home do artista, e a porta do método.
//
// Ela abre com os TRÊS PILARES (onde estou, execução, para onde ir) porque Diagnóstico, Plano de
// Ação e Planejamento saíram da navegação: estes cartões são o único caminho até eles. O que vem
// depois é consulta, na ordem em que se consulta: o contexto, a Nyta e o rodapé.
//
// O que saiu daqui, e por quê: o herói da próxima tarefa (virou o cartão de Execução, que diz a
// mesma coisa e leva ao mesmo lugar), os dois cartões promo (um repetia o módulo Músicas, o outro
// virou a linha do cartão de Planejamento) e a lista do catálogo com tocador (ela existe igual,
// com o mesmo tocador global, dentro de Músicas).

const rotuloDoEstagio: Record<string, string> = {
  comecando: 'Começando', lancando: 'Lançando', vivendo: 'Vivendo da música', consolidada: 'Consolidada',
};
const rotuloDoGenero: Record<string, string> = { ele: 'Ele', ela: 'Ela', elu: 'Elu', neutro: 'Neutro' };

const VisaoGeralDoArtista: FC<{
  artist: Artist;
  onSelect: (secao: SecaoDoPainel) => void;
}> = ({ artist, onSelect }) => {
  const content = artist.content || {};
  const realProfile = content.realIndex?.profile;
  const displayName = artist.name.trim();

  return (
    <section className='overview-home' aria-label='Visão geral do artista'>
      <header className='overview-hero'>
        <div className='overview-hero-copy'>
          <span className='overview-kicker'>PAINEL DE COMANDO</span>
          <h1>Olá, {displayName}.</h1>
          <p>Veja o momento da sua carreira e escolha o próximo movimento.</p>
        </div>
        <div className='overview-hero-portrait'>
          <img src={content.spotifyProfile?.image || ARTISTS_DEFAULT_IMAGE} alt='' />
          <span>{realProfile?.name || 'Seu perfil REAL'}</span>
        </div>
        <button type='button' className='overview-hero-action' onClick={() => onSelect('execucao')}>
          Continuar plano <FiArrowRight aria-hidden />
        </button>
      </header>
    </section>
  );
};

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

const CabecalhoDoMetodo: FC<{
  pilar: Pilar;
  aoAbrir: () => void;
  perfilReal?: { name: string; description: string; pattern: Record<'r' | 'e' | 'a' | 'l', boolean> };
  hideAction?: boolean;
}> = ({ pilar, aoAbrir, perfilReal, hideAction = false }) => (
  <header className={`method-view-header ${perfilReal ? 'method-diagnostic-header' : ''}`}>
    {perfilReal ? <>
      <div className='method-diagnostic-header-top'>
        <div className='method-diagnostic-result'>
          <span>SEU PERFIL DE CARREIRA</span>
          <div className='method-diagnostic-result-main'>
            <RealBadge tier={tierForAltas(altasForPattern(perfilReal.pattern))} label={String(altasForPattern(perfilReal.pattern))} size={62} />
            <div>
              <h1 id={`method-${pilar.chave}`}>{perfilReal.name}</h1>
              <p>{perfilReal.description.replace(/\s[—–]\s+(.)/g, (_, first: string) => `. ${first.toUpperCase()}`)}</p>
            </div>
          </div>
        </div>
      </div>
      <div className='method-diagnostic-summary'>
        <div className='method-diagnostic-status'>
          {!hideAction && <button type='button' onClick={aoAbrir}>{pilar.cta}<FiArrowRight aria-hidden /></button>}
        </div>
        <div className='method-diagnostic-pattern' aria-label='Dimensões REAL'>
          <span>Dimensões acesas</span>
          <div>
            {(['r', 'e', 'a', 'l'] as const).map((key) => <i key={key} className={perfilReal.pattern[key] ? 'acesa' : ''}>{key.toUpperCase()}</i>)}
          </div>
        </div>
      </div>
    </> : <>
      <div>
        <span>{pilar.rotulo}</span>
        <h1 id={`method-${pilar.chave}`}>{pilar.titulo}</h1>
        <p>{pilar.linha}</p>
      </div>
      <button type='button' onClick={aoAbrir}>{pilar.cta}<FiArrowRight aria-hidden /></button>
    </>}
  </header>
);

const PainelDoMetodo: FC<{
  pilar: Pilar;
  artist: Artist;
  aoAbrir: () => void;
  aoAbrirPlanoAcao?: () => void;
  podeRefazer: boolean;
}> = ({ pilar, artist, aoAbrir, aoAbrirPlanoAcao, podeRefazer }) => {
  const content = artist.content || {};
  const strategies = content.strategies || [];
  const [strategyFilter, setStrategyFilter] = useState<'chosen' | 'archived'>('chosen');
  const orderedStrategies = [...strategies].sort((a, b) => {
    const aChosen = (a.tasks || []).some((task) => task.status !== 'archived');
    const bChosen = (b.tasks || []).some((task) => task.status !== 'archived');
    return Number(bChosen) - Number(aChosen) || (b.finalScore ?? 0) - (a.finalScore ?? 0);
  });
  const chosenStrategies = orderedStrategies.filter((strategy) => (strategy.tasks || []).some((task) => task.status !== 'archived'));
  const archivedStrategies = orderedStrategies.filter((strategy) => !(strategy.tasks || []).some((task) => task.status !== 'archived'));
  const visibleStrategies = strategyFilter === 'chosen' ? chosenStrategies : archivedStrategies;
  const objectives = content.objectives || [];
  const values = content.identity?.values || [];
  const identity = content.identity || {};
  const profileDetails = [
    ['Gênero musical', identity.genre],
    ['Cidade', [identity.city, identity.state].filter(Boolean).join(' / ')],
    ['Estágio', identity.stage ? rotuloDoEstagio[identity.stage] || identity.stage : undefined],
    ['Gênero', identity.gender ? rotuloDoGenero[identity.gender] || identity.gender : undefined],
  ].filter(([, value]) => value);
  const swot = content.swotAnalysis || { strengths: [], weaknesses: [], opportunities: [], threats: [] };
  const real = content.realIndex;

  if (pilar.chave === 'diagnostico' && real) {
    return (
      <section className='method-view method-view-diagnostico method-view-report' aria-labelledby='method-diagnostico'>
        <CabecalhoDoMetodo
          pilar={pilar}
          aoAbrir={aoAbrir}
          perfilReal={{ name: real.profile.name, description: real.profile.description, pattern: real.pattern }}
        />
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
          hideHero
          hideProfile
          hideLegacyNotice
          onRedo={aoAbrir}
          redoLocked={!podeRefazer}
        />
      </section>
    );
  }

  if (pilar.chave === 'execucao') {
    return <ActionPlan embedded />;
  }

  return (
    <section className={`method-view method-view-${pilar.chave}`} aria-labelledby={`method-${pilar.chave}`}>
      {pilar.chave === 'planejamento' ? (
        <header className='method-planning-header'>
          <div className='method-planning-header-top'>
            <div className='method-planning-result'>
            <span>PARA ONDE IR</span>
            <div className='method-planning-result-main'>
              <div>
                <h1 id='method-planejamento'>Planejamento Estratégico</h1>
                  <p>{content.planMonths ? `Ciclo de ${content.planMonths} meses para transformar prioridades em ações acompanháveis.` : 'Um ciclo para transformar prioridades em ações acompanháveis.'}</p>
                </div>
              </div>
            </div>
          </div>
        </header>
      ) : <CabecalhoDoMetodo pilar={pilar} aoAbrir={aoAbrir} />}

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

      {pilar.chave === 'planejamento' && (
        <div className='method-planning-full'>
          <article className='planning-vision-panel'>
            <div><span>VISÃO DO ARTISTA</span><h2>{content.identity?.vision || 'Defina onde você quer chegar.'}</h2></div>
          </article>

          <div className='planning-foundations'>
            <article><span>MISSÃO</span><h2>{content.identity?.mission || 'Ainda não definida.'}</h2></article>
            <article><span>VALORES</span><div className='planning-value-list'>{values.length ? values.map((value) => <b key={value}>{value}</b>) : <p>Ainda não definidos.</p>}</div></article>
          </div>

          <section className='planning-references planning-reference-panel'>
            <header>
          <div>
            <span>INSPIRAÇÕES QUE GUIAM A CARREIRA</span>
            <h2>Mapa de referências</h2>
          </div>
            </header>
            <div className='reference-scroll'>
              <ReferenceMindMap references={content.identity?.references} />
            </div>
          </section>

          {(content.executiveSummary || profileDetails.length > 0) && (
            <section className='planning-context-panel'>
              <header><div><span>CONTEXTO DO ARTISTA</span><h2>Perfil e resumo executivo</h2></div></header>
              <div className='planning-context-grid'>
                {content.executiveSummary && <article className='planning-summary-card'><span>RESUMO EXECUTIVO</span><div className='planning-summary-markdown'><ReactMarkdown>{content.executiveSummary}</ReactMarkdown></div></article>}
                {profileDetails.length > 0 && <article className='planning-details-card'><span>DADOS DE IDENTIDADE</span><dl>{profileDetails.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl></article>}
              </div>
            </section>
          )}

          <div className='planning-full-grid'>
            <section className='planning-full-section'>
              <header><div><span>FOCOS DO CICLO</span><h2>Objetivos</h2></div><b>{objectives.length}</b></header>
              <div className='planning-objective-list'>
                {(objectives.length ? objectives : ['Nenhum objetivo definido.']).map((objective, index) => (
                  <article key={objective}><i>{String(index + 1).padStart(2, '0')}</i><strong>{objective}</strong></article>
                ))}
              </div>
            </section>

            <section className='planning-full-section planning-strategy-section'>
              <header>
                <div><span>CAMINHOS PARA CHEGAR LÁ</span><h2>Estratégias</h2></div>
                <div className='planning-section-actions'>
                  <div className='planning-strategy-filter' role='group' aria-label='Filtrar estratégias'>
                    <button type='button' className={strategyFilter === 'chosen' ? 'active' : ''} onClick={() => setStrategyFilter('chosen')}>Escolhidas</button>
                    <button type='button' className={strategyFilter === 'archived' ? 'active' : ''} onClick={() => setStrategyFilter('archived')}>Arquivadas</button>
                  </div>
                  <button type='button' onClick={aoAbrirPlanoAcao || aoAbrir}>Gerenciar no plano de ação <FiArrowRight aria-hidden /></button>
                  <b>{visibleStrategies.length}</b>
                </div>
              </header>
              <div className='planning-strategy-list'>
                {(visibleStrategies.length ? visibleStrategies : [{ id: 'empty-strategy', title: strategyFilter === 'chosen' ? 'Nenhuma estratégia escolhida.' : 'Nenhuma estratégia arquivada.', tasks: [] }]).map((strategy, index) => {
                  const strategyTasks = strategy.tasks || [];
                  const done = strategyTasks.filter((task) => task.status === 'done').length;
                  const pct = strategyTasks.length ? Math.round((done / strategyTasks.length) * 100) : 0;
                  return <article key={strategy.id}><div><i>{String(index + 1).padStart(2, '0')}</i><strong>{strategy.title}</strong></div><span>{pct}%</span></article>;
                })}
              </div>
            </section>
          </div>

          <section className='planning-swot-panel'>
            <header><div><span>LEITURA DO CENÁRIO</span><h2>Análise SWOT</h2></div><p>O contexto que orienta as escolhas do planejamento.</p></header>
            <div className='planning-swot-grid'>
              {([['Forças', swot.strengths, 'strength'], ['Fragilidades', swot.weaknesses, 'weakness'], ['Oportunidades', swot.opportunities, 'opportunity'], ['Ameaças', swot.threats, 'threat']] as const).map(([title, items, tone]) => (
                <article className={`planning-swot-${tone}`} key={title}><h3>{title}</h3><ul>{(items.length ? items : ['Nenhum item informado.']).map((item) => <li key={item}>{item}</li>)}</ul></article>
              ))}
            </div>
          </section>
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
  const isPlatformAdmin = useIsPlatformAdmin();
  const canRedoDiagnostic = capabilities.manageTasks || isPlatformAdmin;
  // A avaliação abre daqui, com estado próprio: o `reviewOpen` do Layout é privado dele.
  const [avaliando, setAvaliando] = useState(false);
  const [secao, setSecao] = useState<SecaoDoPainel>(() => secaoDaUrl(location.search));

  useEffect(() => {
    setSecao(secaoDaUrl(location.search));
  }, [location.search]);

  if (loading && !artist) {
    return <Spinner loading>{null as any}</Spinner>;
  }
  if (!artist) {
    return <div className='board-content page-view music-dashboard'>Artista não encontrado.</div>;
  }

  const pilares = pilaresDoPainel(artist, journey, { ...capabilities, manageTasks: canRedoDiagnostic });
  const pilarAtivo = pilares.find((pilar) => pilar.chave === secao);

  return (
    <div className='board-content page-view music-dashboard'>
      <PillarCards artist={artist} ativa={secao} onSelect={setSecao} />

      {pilarAtivo ? (
        <PainelDoMetodo
          pilar={pilarAtivo}
          artist={artist}
          podeRefazer={canRedoDiagnostic}
          aoAbrirPlanoAcao={() => setSecao('execucao')}
          aoAbrir={() => {
            const rota = pilarAtivo.destino === 'refazerDiagnostico'
              ? `/artists/${artist.id}/diagnostico/refazer`
              : pilarAtivo.destino === 'assinatura'
                ? '/planos'
              : pilarAtivo.chave === 'execucao' || pilarAtivo.chave === 'planejamento'
                ? `/artists/${artist.id}/action-plan`
                : `/artists/${artist.id}/perfil`;
            navigate(rota);
          }}
        />
      ) : <>

      {/* A Nyta orienta a próxima ação antes de apresentar o painel de comando. */}
      <NytaDashboardHero artistName={artist.name} />

      {/* Os atalhos de suporte e colaboração vêm logo depois da conversa. */}
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
          icone={<FiUsers />}
          titulo='Convidar membro'
          texto='Adicione alguém para colaborar com este perfil.'
          aoAbrir={() => navigate(`/artists/${artist.id}/team`)}
        />
      </section>

      {/* O painel de comando fecha o fluxo principal, abaixo dos cards de suporte. */}
      <VisaoGeralDoArtista artist={artist} onSelect={setSecao} />
      </>}

      <PlatformReviewModal open={avaliando} onClose={() => setAvaliando(false)} />
    </div>
  );
};

export default Dashboard;
