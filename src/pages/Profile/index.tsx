import { FC, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { Spinner } from '../../components/spinner/spinner';
import type { SwotAnalysis } from '@maestra/core/interfaces/maestra';
import { mapaDeReferencias } from '@maestra/core/nucleo/mapaDeReferencias';

const swotColors = ['#3361ff', '#ff6633', '#29cc39', '#e62e7b'] as const;

const Profile: FC = () => {
  const { artist } = useArtist();
  const navigate = useNavigate();

  const content = artist?.content;
  const identity = content?.identity;
  const objectives = content?.objectives || [];
  const strategies = useMemo(
    () => [...(content?.strategies || [])].sort((a, b) => (b.finalScore ?? 0) - (a.finalScore ?? 0)),
    [content?.strategies]
  );
  const swot: Array<[string, string[]]> = useMemo(() => {
    const analysis: SwotAnalysis = content?.swotAnalysis || {
      strengths: [], weaknesses: [], opportunities: [], threats: [],
    };
    return [
      ['Forças', analysis.strengths || []],
      ['Fraquezas', analysis.weaknesses || []],
      ['Oportunidades', analysis.opportunities || []],
      ['Ameaças', analysis.threats || []],
    ];
  }, [content?.swotAnalysis]);

  // A geometria mora no núcleo (`nucleo/mapaDeReferencias`) desde que o app nativo passou a
  // desenhar o mesmo mapa: são coordenadas, não JSX, e duas cópias de trigonometria afinada na
  // tela é como as duas superfícies acabam com diagramas diferentes.
  const referenceOrbits = useMemo(() => mapaDeReferencias(identity), [identity]);

  if (!artist) return <Spinner loading>{null as any}</Spinner>;

  const totalTasks = strategies.reduce((total, strategy) => total + (strategy.tasks?.length || 0), 0);
  const completedTasks = strategies.reduce((total, strategy) => total + (strategy.tasks || []).filter((task) => task.status === 'done').length, 0);
  const capacity = totalTasks ? Math.round((completedTasks / totalTasks) * 100) : 0;
  const nextSteps = strategies.slice(0, 3).map((strategy) => strategy.title);

  return (
    <div className="board-content page-view planning-page">
      <header className="module-page-heading">
        <div>
          <p>PARA ONDE VOCÊ VAI</p>
          <h1>Planejamento estratégico</h1>
          <span>Visão, missão, valores, objetivos e estratégias de {artist.name}.</span>
        </div>
      </header>

      <section className="planning-general">
        <section className="planning-general-grid planning-primary-grid">
          <article className="planning-focus"><p>FOCO DO CICLO</p><h2>Próximos marcos</h2>{/* O resumo vem do LLM em markdown: sem renderizar, os `**títulos**` apareciam com os
                asteriscos crus no meio do texto. */}
            <div className="planning-focus-summary">
              <ReactMarkdown>{content?.executiveSummary || 'Organize as prioridades da carreira para os próximos lançamentos.'}</ReactMarkdown>
            </div><div><i style={{ width: `${capacity}%` }} /></div><small>Atualizado com os dados do planejamento</small></article>
          <article className="planning-next"><header><span>PRÓXIMOS PASSOS</span><button type="button" aria-label="Ir para o plano de ação" onClick={() => navigate(`/artists/${artist.id}/action-plan`)}><FiArrowRight aria-hidden="true" /></button></header>{(nextSteps.length ? nextSteps : ['Definir próximos objetivos', 'Organizar as estratégias', 'Acompanhar as entregas']).map((item, index) => <div key={item}><i>{String(index + 1).padStart(2, '0')}</i><strong>{item}</strong><b>›</b></div>)}</article>
        </section>

        <section className="planning-overview-grid">
          <article><strong>{String(strategies.length).padStart(2, '0')}</strong><span>Frentes estratégicas</span></article>
          <article><strong>{String(totalTasks).padStart(2, '0')}</strong><span>Entregas no ciclo</span></article>
          <article><strong>{capacity}%</strong><span>Capacidade planejada</span></article>
        </section>

      </section>

      <section className="planning-fundamentals">
        <article className="planning-intro-card"><div className="planning-intro-copy"><p>IDENTIDADE ARTÍSTICA</p><h2>Fundamentos que orientam cada decisão.</h2></div><span>Um retrato claro do que o artista representa, para quem cria e onde quer chegar.</span></article>
        <div className="fundamentals-grid">
          <article><span>GÊNERO</span><strong>{identity?.genre || 'Não informado'}</strong></article>
          <article><span>VISÃO</span><strong>{identity?.vision || 'Ainda não definida.'}</strong></article>
          <article><span>MISSÃO</span><strong>{identity?.mission || 'Ainda não definida.'}</strong></article>
          <article><span>VALORES</span><strong>{identity?.values?.join(', ') || 'Ainda não definidos.'}</strong></article>
        </div>
      </section>

      <section className="planning-references"><header><div><p>INSPIRAÇÕES QUE GUIAM A CARREIRA</p><h2>Mapa de referências</h2><span>Conecte influências artísticas, posicionamento e caminhos de comunicação.</span></div></header><div className="reference-scroll"><div className="reference-map" style={referenceOrbits.length ? { minHeight: 680, minWidth: 740 } : undefined}><i className="reference-center">REFERÊNCIAS</i><i className="reference-node node-positioning">POSICIONAMENTO</i><i className="reference-node node-artistic">ARTÍSTICAS</i><i className="reference-node node-communication">COMUNICAÇÃO<br />COM O PÚBLICO</i><i className="reference-node node-career">CARREIRA</i>
          {referenceOrbits.map(({ nome, chave, linha }) => (
            <span
              key={`linha-${chave}-${nome}`}
              className={`reference-link link-${chave}`}
              aria-hidden
              style={{
                left: `calc(50% + ${Math.round(linha.x)}px)`,
                top: `calc(50% + ${Math.round(linha.y)}px)`,
                width: `${Math.round(linha.comprimento)}px`,
                transform: `rotate(${linha.ang.toFixed(1)}deg)`,
              }}
            />
          ))}
          {referenceOrbits.map(({ nome, chave, x, y }) => (
            <small
              key={`${chave}-${nome}`}
              className={`reference-chip chip-${chave}`}
              style={{ left: `calc(50% + ${Math.round(x)}px)`, top: `calc(50% + ${Math.round(y)}px)` }}
              title={nome}
            >
              {nome}
            </small>
          ))}
        </div></div>
      </section>

      <section className="planning-objectives"><header><p>METAS DO CICLO</p><h2>Objetivos</h2><span>Objetivos claros para orientar prioridades, entregas e resultados esperados.</span></header><ol>{(objectives.length ? objectives : ['Objetivos ainda não definidos.']).map((objective, index) => <li key={objective}><b>{String(index + 1).padStart(2, '0')}</b><span>{objective}</span><button type="button" aria-label={`Ver objetivo ${objective}`}>↗</button></li>)}</ol><p className="planning-note">Os objetivos são definidos durante o planejamento estratégico e orientam a priorização das estratégias.</p></section>

      <section className="planning-swot"><header><p>LEITURA DO CENÁRIO</p><h2>Análise SWOT</h2><span>Forças, fragilidades e oportunidades que orientam o posicionamento da carreira.</span></header><div>{swot.map(([title, items], index) => <article key={title} style={{ '--swot-color': swotColors[index] } as CSSProperties}><h3>{title}</h3><ul>{(items.length ? items : ['Nenhum item informado.']).map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>

      <section className="planning-strategies"><header><div><p>PLANO PRIORIZADO</p><h2>Estratégias</h2><span>Prioridades organizadas por impacto para o crescimento sustentável da carreira.</span></div></header><div>{strategies.map((strategy, index) => { const progress = Math.max(0, Math.min(100, strategy.finalScore ? Math.round((strategy.finalScore / 40) * 100) : 0)); return <article key={strategy.id}><b>{String(index + 1).padStart(2, '0')}</b><section><strong>{strategy.title}</strong><i><span style={{ width: `${progress}%` }} /></i></section><em>{progress}%</em></article>; })}</div></section>
    </div>
  );
};

export default Profile;
