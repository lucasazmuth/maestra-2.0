import { FC, useMemo, type CSSProperties } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';
import ReactMarkdown from 'react-markdown';

import { useArtist } from '@maestra/core/hooks/useArtist';
import { Spinner } from '../../components/spinner/spinner';
import type { SwotAnalysis } from '@maestra/core/interfaces/maestra';

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
  // Um circulo por NOME (um por CAMPO vazava: oito nomes nao cabem num circulo de 63px), e cada
  // grupo ocupa o SETOR do seu no — artisticas em cima a direita, gestao embaixo a direita,
  // comunicacao embaixo a esquerda. O quadrante de POSICIONAMENTO fica livre porque nao existe
  // campo de referencia para ele.
  //
  // Cada setor usa DUAS FILEIRAS. Com uma so, oito nomes num arco de 80 graus se sobrepunham —
  // medido na tela. Duas fileiras dobram a capacidade sem alargar o setor e sem invadir o
  // quadrante vizinho.
  const referenceOrbits = useMemo(() => {
    const refs = identity?.references;
    const partir = (t?: string) => (t || '').split(/[,;\n·]+/).map((x) => x.trim()).filter(Boolean);
    const RAIO_NO = 58;    // metade do no grande
    const RAIO_CHIP = 27;  // metade da bolha

    // Centro de cada no, em px a partir do centro do mapa. Bate com o CSS dos `.reference-node`.
    const grupos = [
      { chave: 'artistica', nome: 'artisticas', graus: -45, no: { x: 92, y: -88 }, nomes: partir(refs?.artisticas) },
      { chave: 'career', nome: 'gestao', graus: 45, no: { x: 92, y: 88 }, nomes: partir(refs?.gestao) },
      { chave: 'communication', nome: 'comunicacao', graus: 135, no: { x: -92, y: 88 }, nomes: partir(refs?.comunicacao) },
    ].filter((g) => g.nomes.length > 0);

    // Duas elipses. A de dentro passa longe dos nos (raio diagonal ~221 contra 185 de alcance do
    // no); a de fora cabe no container sem vazar nas pontas do setor.
    // Duas elipses. As duas restricoes que definem os raios, ambas medidas na tela: a de dentro
    // precisa passar longe dos nos, e a distancia ENTRE as duas precisa caber um diametro de
    // bolha inteiro — aproximar a de dentro so troca uma colisao pela outra.
    // A de dentro fica quase circular: com ela achatada (ry bem menor que rx), a ponta "de pe" do
    // setor descia sobre o no — 4px de folga, medido. A de fora usa a altura extra do container.
    const anel = (fora: boolean) => (fora ? { rx: 330, ry: 310 } : { rx: 245, ry: 235 });

    return grupos.flatMap(({ chave, graus, no, nomes }) => {
      // A fileira de fora leva mais, porque tem mais arco disponivel.
      const qtdFora = nomes.length <= 4 ? nomes.length : Math.ceil(nomes.length * 0.6);
      const fileiras = [
        { fora: true, itens: nomes.slice(0, qtdFora) },
        { fora: false, itens: nomes.slice(qtdFora) },
      ].filter((f) => f.itens.length > 0);

      return fileiras.flatMap(({ fora, itens }) => {
        const { rx, ry } = anel(fora);
        // 70 graus e o setor util, deixando 20 graus de vao entre um grupo e o seguinte. Com 80
        // as bolhas das pontas de setores vizinhos se encostavam: medido, 6px de sobreposicao
        // entre a ultima artistica e a primeira de gestao.
        const abertura = Math.min(26 * (itens.length - 1), 70);
        return itens.map((nomeRef, i) => {
          const desvio = itens.length === 1 ? 0 : (i / (itens.length - 1) - 0.5) * abertura;
          const rad = ((graus + desvio) * Math.PI) / 180;
          const x = rx * Math.cos(rad);
          const y = ry * Math.sin(rad);

          // Linha do no ate a bolha, aparada nas duas pontas para nao cruzar por dentro dos
          // circulos. E ela que mostra a que categoria cada nome pertence.
          const dx = x - no.x;
          const dy = y - no.y;
          const dist = Math.hypot(dx, dy);
          const ang = (Math.atan2(dy, dx) * 180) / Math.PI;
          const cos = dx / dist;
          const sen = dy / dist;

          return {
            nome: nomeRef,
            chave,
            x,
            y,
            linha: {
              x: no.x + RAIO_NO * cos,
              y: no.y + RAIO_NO * sen,
              comprimento: Math.max(0, dist - RAIO_NO - RAIO_CHIP),
              ang,
            },
          };
        });
      });
    });
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
