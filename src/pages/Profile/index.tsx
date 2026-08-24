import { FC, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

import { useArtist } from '../../hooks/useArtist';
import { Spinner } from '../../components/spinner/spinner';
import type { SwotAnalysis } from '../../interfaces/maestra';

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

  // As referencias sao texto livre: o artista escreve quantos nomes quiser, separados por virgula.
  // A versao anterior punha o CAMPO INTEIRO dentro de um circulo de 63px — com oito nomes o texto
  // vazava por todos os lados, cobria os nos e as bolhas se sobrepunham. Um circulo por CAMPO
  // nunca ia caber; agora e um circulo por NOME.
  //
  // Cada grupo orbita o no da sua categoria, em vez de flutuar solto num canto: as artisticas em
  // volta de ARTISTICAS, as de comunicacao em volta de COMUNICACAO, as de gestao em volta de
  // CARREIRA. E a conexao que o mapa promete no subtitulo e que antes nao existia — as bolhas
  // ficavam todas amontoadas a esquerda, sem relacao com nenhum no.
  const referenceOrbits = useMemo(() => {
    const refs = identity?.references;
    const partir = (t?: string) => (t || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);
    // Ordem dos grupos no anel. A cor amarra cada bolha a categoria; com muitos nomes um grupo
    // acaba dando meia volta no mapa, entao encostar cada um no seu no vira promessa impossivel —
    // o que da para garantir e que o grupo fique CONTIGUO e reconhecivel pela cor.
    const grupos = [
      { chave: 'artistica', nomes: partir(refs?.artisticas) },
      { chave: 'career', nomes: partir(refs?.gestao) },
      { chave: 'communication', nomes: partir(refs?.comunicacao) },
    ].filter((g) => g.nomes.length > 0);

    const total = grupos.reduce((n, g) => n + g.nomes.length, 0);
    if (!total) return [];

    // Espacamento igual em volta de toda a elipse. Distribuir por setor (um arco por categoria)
    // foi a primeira tentativa e nao funcionou: com oito nomes num arco de 110 graus as bolhas se
    // sobrepunham entre si e cobriam os nos — medido na tela, 14 pares sobrepostos.
    const passo = 360 / total;
    // Comeco escolhido para o primeiro grupo nascer no alto a direita, perto de ARTISTICAS.
    let i = -total / 4;

    return grupos.flatMap(({ chave, nomes }) =>
      nomes.map((nome) => {
        const rad = (i++ * passo * Math.PI) / 180;
        return {
          nome,
          chave,
          // Percentuais: o anel acompanha o container em vez de quebrar num tamanho fixo.
          left: 50 + 44 * Math.cos(rad),
          top: 50 + 43 * Math.sin(rad),
        };
      }),
    );
  }, [identity?.references]);

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

      <section className="planning-references"><header><div><p>INSPIRAÇÕES QUE GUIAM A CARREIRA</p><h2>Mapa de referências</h2><span>Conecte influências artísticas, posicionamento e caminhos de comunicação.</span></div></header><div className="reference-map"><i className="reference-center">REFERÊNCIAS</i><i className="reference-node node-positioning">POSICIONAMENTO</i><i className="reference-node node-artistic">ARTÍSTICAS</i><i className="reference-node node-communication">COMUNICAÇÃO<br />COM O PÚBLICO</i><i className="reference-node node-career">CARREIRA</i>
          {referenceOrbits.map(({ nome, chave, left, top }) => (
            <small
              key={`${chave}-${nome}`}
              className={`reference-chip chip-${chave}`}
              style={{ left: `${left}%`, top: `${top}%` }}
              title={nome}
            >
              {nome}
            </small>
          ))}
        </div>
      </section>

      <section className="planning-objectives"><header><p>METAS DO CICLO</p><h2>Objetivos</h2><span>Objetivos claros para orientar prioridades, entregas e resultados esperados.</span></header><ol>{(objectives.length ? objectives : ['Objetivos ainda não definidos.']).map((objective, index) => <li key={objective}><b>{String(index + 1).padStart(2, '0')}</b><span>{objective}</span><button type="button" aria-label={`Ver objetivo ${objective}`}>↗</button></li>)}</ol><p className="planning-note">Os objetivos são definidos durante o planejamento estratégico e orientam a priorização das estratégias.</p></section>

      <section className="planning-swot"><header><p>LEITURA DO CENÁRIO</p><h2>Análise SWOT</h2><span>Forças, fragilidades e oportunidades que orientam o posicionamento da carreira.</span></header><div>{swot.map(([title, items], index) => <article key={title} style={{ '--swot-color': swotColors[index] } as CSSProperties}><h3>{title}</h3><ul>{(items.length ? items : ['Nenhum item informado.']).map((item) => <li key={item}>{item}</li>)}</ul></article>)}</div></section>

      <section className="planning-strategies"><header><div><p>PLANO PRIORIZADO</p><h2>Estratégias</h2><span>Prioridades organizadas por impacto para o crescimento sustentável da carreira.</span></div></header><div>{strategies.map((strategy, index) => { const progress = Math.max(0, Math.min(100, strategy.finalScore ? Math.round((strategy.finalScore / 40) * 100) : 0)); return <article key={strategy.id}><b>{String(index + 1).padStart(2, '0')}</b><section><strong>{strategy.title}</strong><i><span style={{ width: `${progress}%` }} /></i></section><em>{progress}%</em></article>; })}</div></section>
    </div>
  );
};

export default Profile;
