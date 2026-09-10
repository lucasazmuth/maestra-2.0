import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { message } from 'antd';
import { FiChevronDown, FiArrowRight, FiShare2, FiRefreshCw, FiLock } from 'react-icons/fi';
import { DownloadIcon } from '../../components/Icons/system';

import { MaestraBrand } from '../../components/MaestraBrand';
import { ARTISTS_DEFAULT_IMAGE } from '@maestra/core/constants/spotify';
import type { RealIndex } from '@maestra/core/interfaces/maestra';
import { downloadNodePng, downloadPagesPdf, nodeToPngFile, urlToDataUrl } from '../../utils/exportImage';
import DiagnosticDoc from './DiagnosticDoc';
// O tipo vem do NÚCLEO, e não do componente: reexportar através da fronteira do pacote é o
// caminho que o webpack não segue.
import { autoriaDoDocumento, type Autoria } from '@maestra/core/documentos/diagnostico';
import { useAppSelector } from '@maestra/core/store/store';
import { RealBadge } from '../../components/RealBadge';
import {
  TIER_ACCENT, altasForPattern, tierForAltas, tierForPattern,
} from '@maestra/core/constants/realBadge';
import { CABECALHO_DA_ENTREGA, dinheiroDoRelatorio, fmtBRL, fmtPct, PREMIOS_LABELS_V3, PAGANTE_LABELS, FREQ_LABELS, PROFILE_BITS } from '@maestra/core/constants/realCopy';
import { FIXOS, INTRO_DA_DIMENSAO, LEITURA_DA_DIMENSAO, LEITURAS_CURTAS } from '@maestra/core/constants/realTextos';
import {
  comentariosDaDimensao, retratoDoPerfil, seloDaDimensao, statusDaBarra,
} from '@maestra/core/services/realEngine/comentarios';
import {
  AVISOS, avisosSemLugarProprio, ehLegado, linhasDaDimensao, resumoDoE, SIIC_MENSAL,
} from '@maestra/core/services/realEngine/relatorio';
import {
  CHAMADA_DO_PLANEJAMENTO, dimNarrative, LEVAR_O_DIAGNOSTICO, METODOLOGIA, QUEM_ASSINA,
  VIDEO_DO_PLANEJAMENTO,
} from '@maestra/core/constants/realNarrative';
import { v2InputsView, type Chartmetric } from './diagnosticShared';
import styles from './ArtistCreate.module.scss';

export type { Chartmetric } from './diagnosticShared';

// Formata números grandes em PT-BR (ex.: 2465588 → "2,5 mi").
export const fmtNum = (n: number): string => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace('.', ',')} mi`;
  if (n >= 1_000) return `${Math.round(n / 1000)} mil`;
  return String(n);
};

// Remove travessões dos textos vindos do banco (descrição/insights) — leitura mais humana.
const clean = (s: string) => s.replace(/\s*—\s*/g, ', ');

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Contador animado (números "sobem" de 0 ao valor na entrega).
const CountUp: FC<{ value: number }> = ({ value }) => {
  const [n, setN] = useState(REDUCE_MOTION ? value : 0);
  useEffect(() => {
    if (REDUCE_MOTION) { setN(value); return; }
    let raf = 0;
    const start = performance.now();
    const dur = 950;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(value * (1 - Math.pow(1 - p, 3)));
      if (p < 1) raf = requestAnimationFrame(tick);
      else setN(value);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{fmtNum(Math.round(n))}</>;
};

// Frases de interpretação por dimensão (alto/baixo) — texto fixo do doc de conteúdo §3.
const DIM_PHRASE: Record<'r' | 'e' | 'a' | 'l', { high: string; low: string }> = {
  r: {
    high: 'Sua música alcança gente além da sua bolha. O algoritmo e as playlists estão trabalhando por você.',
    low: 'Seu alcance digital ainda está abaixo do típico do mercado. Esse costuma ser o ponto de partida de quem quer crescer.',
  },
  e: {
    high: 'Sua carreira já gera receita acima do típico. A música está pagando as contas, e mais.',
    low: 'Sua carreira ainda não se sustenta financeiramente. Isso é mais comum do que parece, e tem solução estratégica.',
  },
  a: {
    high: 'Você tem público de verdade: gente que aparece, compra ingresso e segue a música. Isso é difícil de construir e vale muito.',
    low: 'Seu público comprometido ainda está em construção. A diferença entre quem te alcança e quem realmente te escolhe ainda é grande.',
  },
  l: {
    high: 'Prêmios e imprensa já validam o seu trabalho. O mercado e a crítica reconhecem o que você faz.',
    low: 'Seu trabalho ainda não foi validado por prêmios ou imprensa de expressão. Esse reconhecimento costuma vir com estratégia, não só com talento.',
  },
};

const DIM_META: { key: 'r' | 'e' | 'a' | 'l'; letter: string; name: string }[] = [
  { key: 'r', letter: 'R', name: 'Reach · Alcance' },
  { key: 'e', letter: 'E', name: 'Earnings · Ganhos' },
  { key: 'a', letter: 'A', name: 'Audience · Público real' },
  { key: 'l', letter: 'L', name: 'Legitimacy · Legitimação' },
];

// Mapa dos 16 perfis por "andar" (nº de dimensões altas), do Icon (4) ao Beginner (0).
const PROFILE_MAP: { altas: number; tier: string; names: string[] }[] = [
  { altas: 4, tier: '4 altas', names: ['Icon'] },
  { altas: 3, tier: '3 altas', names: ['Hit', 'Spotlight', 'Underpaid', 'Analog'] },
  { altas: 2, tier: '2 altas', names: ['Digital', 'Potential', 'Hype', 'Rising', 'Outlier', 'Bet'] },
  { altas: 1, tier: '1 alta', names: ['Influencer', 'Moneymaker', 'Paradox', 'Cult'] },
  { altas: 0, tier: '0 altas', names: ['Beginner'] },
];

// O id e a URL do vídeo vivem no núcleo: é o MESMO vídeo no app. Ver `VIDEO_DO_PLANEJAMENTO`.
// A copy vive no núcleo: o app entrega a MESMA chamada, no mesmo ponto da jornada.
const CTA_TITLE = CHAMADA_DO_PLANEJAMENTO.titulo;
const CTA_SUB = CHAMADA_DO_PLANEJAMENTO.apoio;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Efeito "digitando": revela o texto caractere a caractere quando `active` vira true. Um "fantasma"
// invisível reserva o espaço final (layout estável, sem reflow). Definido no escopo de módulo para
// não remontar a cada render. Respeita prefers-reduced-motion (mostra tudo de uma vez).
const Typewriter: FC<{ text: string; active: boolean; speed?: number; onDone?: () => void }> = ({
  text, active, speed = 24, onDone,
}) => {
  const [n, setN] = useState(0);
  const done = useRef(false);
  useEffect(() => {
    if (!active) return;
    if (prefersReducedMotion()) { setN(text.length); return; }
    if (n >= text.length) return;
    const t = setTimeout(() => setN((v) => v + 1), speed);
    return () => clearTimeout(t);
  }, [active, n, text.length, speed]);
  useEffect(() => {
    if (active && n >= text.length && !done.current) { done.current = true; onDone?.(); }
  }, [active, n, text.length, onDone]);
  const typing = active && n < text.length;
  // Empilhamento via CSS grid (não position:absolute): o "fantasma" reserva o espaço do texto
  // completo e o texto visível ocupa a MESMA célula — sem estourar/cortar em telas estreitas.
  return (
    <span className={styles.twWrap}>
      <span className={styles.twGhost} aria-hidden>{text}</span>
      <span className={styles.twVisible}>
        {active ? text.slice(0, n) : ''}
        {typing && <span className={styles.twCaret} />}
      </span>
    </span>
  );
};

/** O padrão de bits R E A L de um perfil, que é a chave dos textos (§5.2, §5.3). */
const chaveDoPerfil = (bits: Record<string, boolean>) =>
  `${bits.r ? 1 : 0}${bits.e ? 1 : 0}${bits.a ? 1 : 0}${bits.l ? 1 : 0}`;

// ── V3: componentes do boletim (definidos no escopo de módulo p/ não remontar a cada render) ──
type DimK = 'r' | 'e' | 'a' | 'l';
const SRC_LABELS: Record<string, string> = { streaming: 'Streaming', direitos: 'Direitos', publi: 'Publicidade', aulas: 'Aulas', editais: 'Editais', venda: 'Venda / merch', outros: 'Outros' };
const PIE_COLORS = ['#1db954', '#4c7dff', '#e0a13c', '#9A4FD1', '#21b26e', '#9b8cff', '#d65a5a'];

// Pizza de composição da receita anual: shows + cada uma das nove fontes (§7.5).
const RevenuePie: FC<{ ri: any }> = ({ ri }) => {
  const revenue = ri.revenue || {};
  const resumo = resumoDoE(ri);
  const segs: { label: string; value: number }[] = [];
  if (resumo) {
    if (resumo.receitaShows > 0) segs.push({ label: 'Shows', value: resumo.receitaShows });
    resumo.fontes.forEach((f) => { if (f.valor > 0) segs.push({ label: f.rotulo, value: f.valor }); });
  } else {
    if (Number(revenue?.shows) > 0) segs.push({ label: 'Shows', value: Number(revenue.shows) });
    Object.entries(revenue?.sources || {}).forEach(([k, v]) => { if (Number(v) > 0) segs.push({ label: SRC_LABELS[k] || k, value: Number(v) }); });
  }
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) return <div className={styles.pieEmpty}>Composição da receita: sem dados informados.</div>;
  let acc = 0;
  const stops = segs.map((s, i) => {
    const from = (acc / total) * 100; acc += s.value; const to = (acc / total) * 100;
    return `${PIE_COLORS[i % PIE_COLORS.length]} ${from}% ${to}%`;
  }).join(', ');
  return (
    <div className={styles.pieBlock}>
      <div className={styles.pieBlockTitle}>Composição da receita</div>
      <div className={styles.pieWrap}>
        <div className={styles.pieDisc} style={{ background: `conic-gradient(${stops})` }} />
        <div className={styles.pieLegend}>
          {segs.map((s, i) => (
            <div key={s.label} className={styles.pieLegendRow}>
              <span className={styles.pieDot} style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
              <span className={styles.pieLegendLabel}>{s.label}</span>
              <span className={styles.pieLegendVal}>{Math.round((s.value / total) * 100)}%</span>
            </div>
          ))}
        </div>
      </div>
      {/*
        §11.3.4 — a fonte marcada "não sei" precisa aparecer. Somem-la no zero contaria uma receita
        menor sem dizer por quê, e é justamente aí que mora a recomendação de gestão.
      */}
      {!!resumo?.fontes.some((f) => f.naoSei) && (
        <div className={styles.pieNaoSei}>
          <strong>Não informado:</strong>{' '}
          {resumo.fontes.filter((f) => f.naoSei).map((f) => f.rotulo).join(', ')}. {AVISOS.naoSei}
        </div>
      )}
    </div>
  );
};

// Engajamento por rede (mostra as 3, com a leitura do corte). §6.3 / §9.4.
const EngagementGrid: FC<{ engagement: any; deezerFans?: number | null; informativo?: boolean }> = ({ engagement, deezerFans, informativo }) => {
  const nets: [string, string][] = [['Instagram', 'instagram'], ['TikTok', 'tiktok'], ['YouTube', 'youtube']];
  return (
    <div className={styles.engGrid}>
      <div className={styles.engGridTitle}>
        Engajamento por rede
        {/*
          §8.2 e §11.3.5 — o engajamento está SUSPENSO do cálculo (a API entrega em 21% a 35% dos
          casos, e a taxa não é autodeclarável). Mostrar sem dizer isso faria o artista atribuir a
          nota dele a um número que não a moveu.
        */}
        {informativo && <span className={styles.engInfo}>{AVISOS.informativo}</span>}
      </div>
      {nets.map(([label, key]) => {
        const e = engagement?.[key];
        return (
          <div key={key} className={styles.engRow}>
            <span className={styles.engNet}>{label}</span>
            {/*
              §13.6 — sai o "abaixo do corte de X%". O engajamento está SUSPENSO do índice, e
              comparar com um corte que não move nota fazia o artista atribuir o resultado dele a
              um número que não participou da conta. Fica só a taxa.
            */}
            {/*
              ⚠️ AUSÊNCIA NUNCA É ZERO (§8.5 e §12). O travessão dizia "não há nada aqui" com a
              mesma cara com que um "0,0%" diria "o vínculo é nulo", e as duas coisas são
              diferentes: uma é a API que não entregou, a outra é a rede que de facto não
              engaja. "0,0%" só aparece quando a API devolveu zero.
            */}
            <span className={styles.engVal}>{e ? fmtPct(e.value) : 'sem dado'}</span>
          </div>
        );
      })}
      {deezerFans != null && (
        <div className={styles.engRow}>
          <span className={styles.engNet}>Fãs no Deezer</span>
          <span className={styles.engVal}>{fmtNum(Math.round(deezerFans))}</span>
        </div>
      )}
    </div>
  );
};

// Card de dimensão V3: régua acende/top-tier + nota 0–100 + sub-métricas + narrativa "o que isso revela".
const DimCardV3: FC<{ dk: DimK; ri: any; cm: Chartmetric | null }> = ({ dk, ri, cm }) => {
  const meta = DIM_META.find((m) => m.key === dk)!;
  const [title, sub] = meta.name.split(' · ');
  const high = !!ri.pattern[dk];
  const top = !!ri.dimTopIcon?.[dk];
  const score = Math.max(0, Math.min(100, Math.round(Number(ri.boletim?.[dk] ?? 0))));
  const inputs = ri.inputs || {};
  const rev = ri.revenue || {};
  // Mesma procedência do PDF (ver `decl` em DiagnosticDoc): o que vem de API fica sem marca, o que
  // é autorrelato do questionário leva †. Tela e documento precisam contar a mesma história.
  const rows: { label: string; num?: number | null; value?: string; declarado?: boolean }[] =
    // Na v4 as linhas vêm do núcleo, que é a mesma fonte da tela nativa e do PDF. O legado (v2/v3)
    // mantém as suas: aquelas entradas são números crus, sem proveniência, e a base é mensal.
    !ehLegado(ri) ? linhasDaDimensao(ri, dk, cm).map((l) => ({
      label: l.rotulo, num: l.num, value: l.valor, declarado: l.fonte === 'self',
    })) :
    dk === 'r' ? [
      { label: 'Ouvintes Spotify', num: cm?.monthly_listeners ?? inputs.spotifyListeners ?? null },
      { label: 'Instagram', num: inputs.igFollowers ?? null },
      { label: 'TikTok', num: inputs.tiktokFollowers ?? null },
      { label: 'YouTube mensal', num: inputs.youtubeMonthlyViews ?? null },
    ] : dk === 'e' ? [
      { label: 'Receita mensal', value: fmtBRL(Number(rev.total ?? 0)), declarado: true },
      { label: 'Shows / mês', value: String(inputs.showsPerMonth ?? 0), declarado: true },
      { label: 'Cachê médio', value: fmtBRL(Number(inputs.cache ?? 0)), declarado: true },
    ] : dk === 'a' ? [
      { label: 'Shows / mês', value: String(inputs.showsPerMonth ?? 0), declarado: true },
      { label: '% público pagante', value: inputs.fazBilheteria ? (PAGANTE_LABELS[inputs.pagantePct] ?? '—') : 'Não faz bilheteria', declarado: true },
      { label: 'Seguidores Spotify', num: inputs.spotifyFollowers ?? null },
      { label: 'Fãs Deezer', num: inputs.deezerFans ?? null },
    ] : [
      { label: 'Prêmios', value: PREMIOS_LABELS_V3[Number(inputs.premios ?? 0)] ?? '—', declarado: true },
      { label: 'Imprensa', value: inputs.imprensaRepercussao ? (FREQ_LABELS[inputs.imprensaFrequencia] ?? 'Sim') : 'Não', declarado: true },
      { label: 'Playlists editoriais', value: String(inputs.editorialPlaylists ?? cm?.playlists?.count ?? 0) },
      // Sem dado ≠ "não toca": o airplay pode não ter vindo da Chartmetric (o motor ignora e
      // renormaliza nesse caso), e dizer "Não" afirmaria algo que não se sabe.
      // Com dado, mostra o NÚMERO de execuções, não "Sim": o motor usa como binário, mas para
      // quem lê "17.272 execuções" diz o tamanho da presença — do mesmo jeito que a linha das
      // playlists mostra a contagem em vez de "tem".
      {
        label: 'Execução em rádio',
        value: inputs.radioAirplay == null
          ? 'Sem dado'
          : Number(inputs.radioAirplay) > 0
          ? `${fmtNum(Math.round(Number(inputs.radioAirplay)))} execuções`
          : 'Não',
      },
    ];
  return (
    <div className={`${styles.dimCard} ${high ? styles.stHigh : styles.stLow}`}>
      <div className={styles.dimTop}>
        <span className={styles.dimMono}>{meta.letter}</span>
        <div className={styles.dimTitleWrap}>
          <div className={styles.dimTitle}>{title}</div>
          <div className={styles.dimSub}>{sub}</div>
        </div>
        <div className={styles.dimScoreWrap}>
          {/* §3 — "Top Tier" é o patamar desta DIMENSÃO; "TOP ICON" é o perfil, e só aparece
              junto do nome dele. */}
          <span className={`${styles.dimBadge} ${top ? styles.dimBadgeTop : high ? styles.dimBadgeHigh : styles.dimBadgeLow}`}>{seloDaDimensao(ri, dk).rotulo}</span>
          <span className={styles.dimScore}>{score}<span className={styles.dimScoreMax}>/100</span></span>
        </div>
      </div>
      <div className={styles.ruler}>
        {/* TOP ICON (flag do motor): a barra enche até o selo em dourado, pra não contradizer o selo. */}
        <div className={styles.rulerFill} style={top ? { width: '100%', background: 'linear-gradient(90deg,#f5c451,#e0a13c)' } : { width: `${score}%` }} />
        <span className={styles.rulerMark} style={{ left: '70%' }} data-label="acende" />
        <span className={styles.rulerMark} style={{ left: '100%' }} data-label="TOP ICON" />
      </div>
      {/* F3, F4 ou F5, conforme o estado (§10). */}
      <div className={styles.dimStatusLine}>{statusDaBarra(ri, dk)}</div>

      {!ehLegado(ri) && (
        <>
          {/*
            A intro da frente, recolhida na tela e aberta no PDF (§2). É longa de propósito: quem
            já entendeu não precisa reler a cada visita, e quem chegou agora precisa dela inteira.
          */}
          {/* Nasce ABERTA: é o texto que explica o que a dimensão mede, e um artista que abre o
              diagnóstico pela primeira vez precisa dele antes dos números. O acordeão fica para
              quem já leu e quer recolher. */}
          <details className={styles.dimIntro} open>
            <summary className={styles.dimIntroLabel}>{FIXOS.F21}</summary>
            <p className={styles.dimIntroText}>{INTRO_DA_DIMENSAO[dk]}</p>
          </details>

          {/* A frase de leitura: uma só, pelo estado. */}
          <p className={styles.dimLeitura}>{LEITURA_DA_DIMENSAO[dk][high ? 'alto' : 'baixo']}</p>
        </>
      )}
      <div className={styles.dimStats}>
        {rows.map((l) => (
          <div key={l.label} className={styles.dimStatRow}>
            <span className={styles.dimStatLabel}>
              {l.label}
              {l.declarado && <span className={styles.statDagger} title="Informado por quem preencheu o diagnóstico">†</span>}
            </span>
            <span className={styles.dimStatValue}>{l.num != null ? <CountUp value={l.num} /> : (l.value ?? '—')}</span>
          </div>
        ))}
      </div>
      {rows.some((l) => l.declarado) && (
        <div className={styles.statFonteNota}>† Informado por quem preencheu o diagnóstico. A Maestra não verifica estes dados.</div>
      )}
      {dk === 'e' && <RevenuePie ri={ri} />}
      {/*
        §3 — os chips de estrutura aparecem SEMPRE os dois, positivo ou negativo. Mostrar só a
        ausência transformava um dado neutro em repreensão, e escondia de quem tem os dois que
        eles contam a favor.
      */}
      {dk === 'e' && (() => {
        const resumo = resumoDoE(ri);
        const comCnpj = resumo ? ri.raw?.temCnpj === true : !!inputs.temCnpj;
        const comEmpresario = resumo ? ri.raw?.temEmpresario === true : !!inputs.temEmpresario;
        return (
          <div className={styles.eBadges}>
            <span className={`${styles.eBadge} ${comCnpj ? styles.eBadgeOk : ''}`}>
              {comCnpj ? 'Com CNPJ' : 'Sem CNPJ'}
            </span>
            <span className={`${styles.eBadge} ${comEmpresario ? styles.eBadgeOk : ''}`}>
              {comEmpresario ? 'Com empresário' : 'Sem empresário'}
            </span>
          </div>
        );
      })()}
      {/*
        Cachê médio por tipo de contratante (§7.5). O gráfico não é enfeite: a receita de shows
        assume distribuição igual entre os tipos informados, e ver quais são deixa a aproximação à
        vista de quem lê, em vez de escondida na conta.
      */}
      {dk === 'e' && (() => {
        const resumo = resumoDoE(ri);
        if (!resumo?.cache.length) return null;
        const teto = Math.max(...resumo.cache.map((c) => c.valor));
        return (
          <div className={styles.cacheBlock}>
            <div className={styles.pieBlockTitle}>Cachê médio por tipo de contratante</div>
            {resumo.cache.map((c) => (
              <div key={c.tipo} className={styles.cacheRow}>
                <span className={styles.cacheLabel}>{c.rotulo}</span>
                <span className={styles.cacheBarWrap}>
                  <span className={styles.cacheBar} style={{ width: `${Math.round((c.valor / teto) * 100)}%` }} />
                </span>
                <span className={styles.cacheVal}>{fmtBRL(c.valor)}</span>
              </div>
            ))}
          </div>
        );
      })()}
      {dk === 'e' && (() => {
        const resumo = resumoDoE(ri);
        // Legado (v2/v3): base mensal, sem saldo ajustado nem alíquota.
        if (!resumo) {
          const fat = Math.round(Number(rev.total ?? 0) * 12);
          const inv = Math.round(Number(inputs.investimento ?? 0));
          const saldo = fat - inv;
          // §11: abrevia só acima de dez mil. Pelo `fmtNum`, R$ 1.200 saía como "R$ 1 mil".
          const money = (n: number) => dinheiroDoRelatorio(Math.abs(n));
          return (
            <div className={styles.healthBlock}>
              <div className={styles.healthTitle}>Saúde financeira · 12 meses</div>
              <div className={styles.healthGrid}>
                <div className={styles.healthItem}><span className={styles.healthLabel}>Faturamento</span><span className={styles.healthVal}>{money(fat)}</span></div>
                <div className={styles.healthItem}><span className={styles.healthLabel}>Investimento</span><span className={styles.healthVal}>{money(inv)}</span></div>
                <div className={styles.healthItem}><span className={styles.healthLabel}>Saldo</span><span className={`${styles.healthVal} ${saldo >= 0 ? styles.healthPos : styles.healthNeg}`}>{saldo >= 0 ? '+' : '−'}{money(saldo)}</span></div>
              </div>
            </div>
          );
        }
        // §11: abrevia só acima de dez mil. Pelo `fmtNum`, R$ 1.200 saía como "R$ 1 mil".
        const money = (n: number) => dinheiroDoRelatorio(Math.abs(n));
        return (
          <div className={styles.healthBlock}>
            <div className={styles.healthTitle}>Saúde financeira · 12 meses</div>
            <div className={styles.healthGrid}>
              <div className={styles.healthItem}><span className={styles.healthLabel}>Receita</span><span className={styles.healthVal}>{money(resumo.receitaAnual)}</span></div>
              <div className={styles.healthItem}><span className={styles.healthLabel}>Custos e investimento</span><span className={styles.healthVal}>{money(resumo.investimentoAnual)}</span></div>
              <div className={styles.healthItem}>
                <span className={styles.healthLabel}>Saldo</span>
                <span className={`${styles.healthVal} ${resumo.saldo >= 0 ? styles.healthPos : styles.healthNeg}`}>
                  {resumo.saldo >= 0 ? '+' : '−'}{money(resumo.saldo)}
                </span>
              </div>
              {/* ⚠️ O SALDO AJUSTADO NÃO APARECE AQUI (v4.4, §1.3, §12 e §13 item 15).
                  Ter CNPJ e ter empresário valem um bônus sobre o saldo positivo, e esse bônus
                  decide a nota. Mas ele é PONTUAÇÃO, e estava a ser exibido como DINHEIRO, com o
                  percentual ao lado: o artista via um valor que não existe na conta dele, e via
                  um número proprietário do método, que este relatório não expõe por princípio. */}
              {resumo.receitaLiquidaEstimada != null && (
                <div className={styles.healthItem}>
                  <span className={styles.healthLabel}>Receita líquida estimada ({resumo.aliquotaRotulo})</span>
                  <span className={styles.healthVal}>{money(resumo.receitaLiquidaEstimada)}</span>
                </div>
              )}
            </div>
            {resumo.saldo < 0 && <div className={styles.healthAviso}>{AVISOS.saldoNegativo}</div>}
            {/*
              Comparação com o setor cultural formal (SIIC/IBGE), §7.3. É exibição: a régua do E vem
              da PNAD (P95 da renda individual), e trocar uma pela outra mudaria o método.

              ⚠️ A FRASE FALA DO SALDO, e não da receita (v4.4, §7.10). O número já era o do saldo
              desde que a comparação foi corrigida; a frase tinha ficado para trás e passava a
              dizer uma coisa enquanto mostrava outra. É o mesmo texto do card do PDF.
            */}
            <div className={styles.healthNota}>
              A média mensal do setor cultural formal é {fmtBRL(SIIC_MENSAL)} (SIIC/IBGE). Este saldo
              equivale a {resumo.vezesOSetor.toFixed(1).replace('.', ',')}× esse patamar.
            </div>
            {resumo.recomendarEmpresariamento && (
              <div className={styles.healthNota}>
                Artistas com empresariamento faturam mais na Pesquisa Empresariamento 2025. É a
                estrutura que mais muda esta dimensão.
              </div>
            )}
          </div>
        );
      })()}
      {/* §11.3.2 — os campos que aceitam autodeclaração são todos do R, então é aqui que o
          convite para conectar as redes faz sentido: ao lado das linhas marcadas com †. */}
      {dk === 'r' && !ehLegado(ri) && !!ri.flags?.autodeclarados?.length && (
        <div className={styles.dimAviso}>{AVISOS.autodeclarado}</div>
      )}
      {dk === 'a' && !ehLegado(ri) && ri.flags?.aSemBilheteria && (
        <div className={styles.dimAviso}>{AVISOS.semBilheteria}</div>
      )}
      {dk === 'l' && !ehLegado(ri) && ri.flags?.travaL && (
        <div className={styles.dimAviso}>{AVISOS.travaL}</div>
      )}
      {dk === 'a' && (
        <EngagementGrid
          engagement={ri.engagement}
          deezerFans={ehLegado(ri) ? (ri.inputs?.deezerFans ?? null) : ri.deezerFans}
          informativo={!ehLegado(ri)}
        />
      )}
      {(() => {
        // O legado (v2/v3) segue na narrativa antiga: os gatilhos novos leem estado que aquele
        // cálculo não produzia, e comentar sobre dado que não existe seria inventar.
        if (ehLegado(ri)) {
          const nar = dimNarrative(dk, ri);
          return (
            <div className={styles.dimReveal}>
              <div className={styles.dimRevealHead}>O que isso revela</div>
              <div className={styles.dimRevealLead}>{nar.headline}</div>
              {nar.paras.map((p, i) => (
                <p key={i} className={styles.dimRevealPara}><strong>{p.lead}</strong> {p.body}</p>
              ))}
            </div>
          );
        }
        const comentarios = comentariosDaDimensao(ri, dk, { superficie: 'tela', chartmetric: cm });
        if (!comentarios.length) return null;
        return (
          <div className={styles.dimReveal}>
            <div className={styles.dimRevealHead}>O que isso revela</div>
            {/* Cada comentário abre com a primeira frase em negrito, como na maquete. O corte é
                feito no núcleo, para as três superfícies não inventarem regras diferentes. */}
            {comentarios.map((c) => (
              <p key={c.id} className={styles.dimRevealPara}>
                <strong>{c.lead}</strong>{c.corpo ? ` ${c.corpo}` : ''}
              </p>
            ))}
          </div>
        );
      })()}
    </div>
  );
};

interface Props {
  realIndex: RealIndex;
  chartmetric?: Chartmetric | null;
  artistName?: string;
  artistImage?: string | null;
  // Perfil criado sem Spotify (artista iniciante): ajusta a copy (sem prometer dados de plataforma).
  noSpotify?: boolean;
  onContinue?: () => void;
  // CTA flutuante (sticky) ao rolar — só na criação; na tela /diagnostico fica desligado.
  enableStickyCta?: boolean;
  // Mostra o CTA "Começar planejamento" + a copy. Some quando o artista já tem plano (só PDF/share).
  showPlanningCta?: boolean;
  // "Refazer diagnóstico" (só na /diagnostico): quando passado, vira um botão no cabeçalho. Se
  // redoLocked, mostra cadeado (recurso PRO). Na criação fica undefined (botão não aparece).
  onRedo?: () => void;
  redoLocked?: boolean;
  // Cabeçalho: na CRIAÇÃO é a copy de "está pronto" (entrega); na tela /diagnostico (revisita) o
  // DiagnosticView passa um título de página próprio ("Diagnóstico REAL"), pra não parecer a criação.
  heroTitle?: string;
  heroSub?: string;
  // Esconde o hero interno (avatar + título + refazer) — a /diagnostico usa o PageHeader padrão.
  hideHero?: boolean;
  // Conteúdo opcional renderizado logo ABAIXO do card "Seu perfil de carreira" (ex.: banner de refazer).
  belowProfile?: ReactNode;
  // Só para compor o identificador do documento exportado (ver `docId`). Sem ele o id cai no
  // fallback por data, que ainda identifica a entrega mas não aponta o perfil.
  artistId?: string;
  // Vínculo declarado com o artista (content.titularidade.vinculo). Sai na capa do PDF.
  vinculo?: string;
}

// Página de diagnóstico REAL (free tier) — entregue ao artista antes do pagamento.
// Determinística: consome o realIndex calculado no backend (sem IA). Suporta v1 (antigo) e v2.
export const DiagnosticReport: FC<Props> = ({ realIndex, chartmetric, artistName, artistImage, noSpotify = false, onContinue, enableStickyCta = true, showPlanningCta = true, onRedo, redoLocked = false, heroTitle, heroSub, hideHero = false, belowProfile, artistId, vinculo }) => {
  const authUser = useAppSelector((s) => s.auth.user);
  const [methodOpen, setMethodOpen] = useState(false);
  // v2 (motor REAL Consolidado) tem `version: 2` + `boletim`; v1 mantém o shape antigo.
  const riAny = realIndex as any;
  const isV2 = riAny.version === 2;
  // O motor com boletim e componentes: v3 e v4. A v2 e a v1 caem no cartão antigo.
  const isV3 = riAny.version === 3 || riAny.version === 4;
  // Só o que não tem cartão para chamar de seu — hoje, o aviso de versão. Os outros quatro do
  // §11.3 são impressos dentro da dimensão a que pertencem, onde dizem de qual fonte ou de qual
  // campo se trata; aqui em cima eles eram a mesma frase sem a informação que a torna útil.
  const avisos = avisosSemLugarProprio(riAny);
  const { profile, pattern } = realIndex;
  // Acento da página segue a fase REAL (tier da placa) — coerente com a identidade de gamificação.
  const realTier = tierForPattern(pattern);
  const realAccent = TIER_ACCENT[realTier];
  const boletim: Record<'r' | 'e' | 'a' | 'l', number> | null = isV2 ? riAny.boletim : null;
  const earningsUnknown: boolean = isV2 ? false : riAny.earningsUnknown;
  const inputs = isV2 ? v2InputsView(riAny.inputs) : riAny.inputs;
  const name = artistName || 'seu artista';
  const cities = chartmetric?.top_cities;

  // Compartilhar / baixar.
  const docRef = useRef<HTMLDivElement>(null);
  const shareRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const [avatarData, setAvatarData] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showSticky, setShowSticky] = useState(false);
  // Sequência do CTA "digitando": dispara ao rolar até o bloco; título → subtítulo → botão surge.
  const [ctaInView, setCtaInView] = useState(false);
  const [titleDone, setTitleDone] = useState(false);
  const [, setSubDone] = useState(false);

  // Embute a foto do Spotify como dataURL (evita canvas "tainted" por CORS na captura).
  useEffect(() => {
    let active = true;
    if (artistImage) urlToDataUrl(artistImage).then((d) => { if (active) setAvatarData(d); });
    return () => { active = false; };
  }, [artistImage]);

  // CTA fixo aparece só depois que o card do perfil sai da tela (já teve o "uau"),
  // e some quando o CTA inline está visível (sem duplicar).
  useEffect(() => {
    const prof = profileRef.current;
    if (!prof) return;
    let passed = false;
    let ctaVis = false;
    const update = () => setShowSticky(passed && !ctaVis);
    const o1 = new IntersectionObserver(([e]) => { passed = !e.isIntersecting && e.boundingClientRect.top < 0; update(); });
    o1.observe(prof);
    const cta = ctaRef.current;
    const o2 = cta ? new IntersectionObserver(([e]) => { ctaVis = e.isIntersecting; update(); }, { threshold: 0.15 }) : undefined;
    if (cta && o2) o2.observe(cta);
    return () => { o1.disconnect(); o2?.disconnect(); };
  }, []);

  // Dispara a animação de digitação quando o bloco do CTA entra na viewport (uma vez).
  useEffect(() => {
    const el = ctaRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setCtaInView(true); obs.disconnect(); }
    }, { threshold: 0.35 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const avatarSrc = avatarData || ARTISTS_DEFAULT_IMAGE;
  const fileName = `diagnostico-${(name || 'artista').toLowerCase().replace(/\s+/g, '-')}.png`;

  // AUTORIA DO DOCUMENTO — ver `Autoria` em DiagnosticDoc para o porquê.
  //
  // O `docId` é DETERMINÍSTICO: sai do perfil + do instante em que o diagnóstico foi calculado, que
  // já está salvo. Duas exportações da mesma entrega geram o mesmo id, então ele serve de referência
  // estável quando alguém trouxer um PDF para o suporte conferir. Não usa a hora do download, que
  // mudaria a cada clique, nem inventa estado novo no banco.
  const autoria: Autoria | undefined = (() => {
    const meta = (authUser?.user_metadata ?? {}) as { full_name?: string; name?: string };
    return autoriaDoDocumento({
      email: authUser?.email,
      nome: meta.full_name || meta.name,
      artistId,
      calculadoEm: String(riAny.computedAt ?? ''),
      vinculo,
    });
  })();

  // Entrega completa: deck de apresentação multipágina em PDF.
  const handleDownloadPdf = async () => {
    if (!docRef.current) return;
    const pages = Array.from(docRef.current.querySelectorAll<HTMLElement>('[data-docpage]'));
    if (!pages.length) return;
    setBusy(true);
    try {
      await downloadPagesPdf(
        pages,
        `diagnostico-${(name || 'artista').toLowerCase().replace(/\s+/g, '-')}.pdf`,
        autoria && {
          title: `Diagnóstico REAL · ${name}`,
          author: `${autoria.nome} (${autoria.email})`,
          subject: `Documento ${autoria.docId}. Receita, agenda e reconhecimento informados pelo usuário e não verificados pela Maestra.`,
        },
      );
    } catch (e) {
      console.error('[PDF] export failed', e);
      message.error('Não foi possível gerar o PDF agora. Tente novamente.');
    } finally {
      setBusy(false);
    }
  };
  const handleShare = async () => {
    if (!shareRef.current) return;
    setBusy(true);
    try {
      const file = await nodeToPngFile(shareRef.current, fileName);
      const nav = navigator as Navigator & { canShare?: (d: unknown) => boolean; share?: (d: unknown) => Promise<void> };
      if (file && nav.canShare?.({ files: [file] }) && nav.share) {
        await nav.share({ files: [file], title: `Meu diagnóstico REAL: ${profile.name}` });
      } else {
        await downloadNodePng(shareRef.current, fileName);
      }
    } catch { /* cancelado */ } finally { setBusy(false); }
  };

  // Linhas de dados ("o espelho") por dimensão. `num` ativa o contador animado.
  const dataLines: Record<'r' | 'e' | 'a' | 'l', { label: string; value?: string; num?: number | null }[]> = {
    r: [
      { label: 'Ouvintes mensais no Spotify', num: chartmetric?.monthly_listeners ?? inputs.monthly_listeners ?? null },
      ...(inputs.social?.instagram != null ? [{ label: 'Instagram', num: inputs.social.instagram }] : []),
      ...(inputs.social?.tiktok != null ? [{ label: 'TikTok', num: inputs.social.tiktok }] : []),
      ...(inputs.social?.youtube != null ? [{ label: 'YouTube', num: inputs.social.youtube }] : []),
    ],
    e: [{ label: 'Faturamento mensal médio', value: earningsUnknown ? 'Não informado' : inputs.faturamento }],
    a: [
      { label: isV2 ? 'Shows por mês' : 'Shows pagos (12 meses)', value: inputs.shows_pagos },
      { label: isV2 ? 'Público médio por show' : 'Maior público ao vivo', value: inputs.maior_publico },
      { label: 'Seguidores no Spotify', num: inputs.sp_followers ?? null },
    ],
    l: [
      { label: 'Prêmios', value: inputs.premios },
      { label: 'Imprensa / mídia', value: inputs.imprensa },
    ],
  };

  const renderValue = (row: { value?: string; num?: number | null }) =>
    row.num != null ? <CountUp value={row.num} /> : (row.value ?? '–');

  return (
    <div className={styles.realWrap} style={{ ['--real-accent' as string]: realAccent } as React.CSSProperties}>
      {/* SEÇÃO 1 — Hero (oculto na /diagnostico, que usa o PageHeader padrão) */}
      {!hideHero && (
        <div className={`${styles.realHero} ${styles.reveal}`} style={{ animationDelay: '0s' }}>
          <img className={styles.realHeroAvatar} src={artistImage || ARTISTS_DEFAULT_IMAGE} alt={name} />
          <div>
            <h2 className={styles.realHeroTitle}>{heroTitle || CABECALHO_DA_ENTREGA.titulo(name)}</h2>
            <p className={styles.realHeroSub}>
              {heroSub || (noSpotify ? CABECALHO_DA_ENTREGA.apoioSemSpotify : CABECALHO_DA_ENTREGA.apoio)}
            </p>
          </div>
          {onRedo && (
            <button
              className={styles.heroRedoBtn}
              onClick={onRedo}
              title={redoLocked ? 'Recurso PRO — assine para refazer' : 'Refaça o quiz e atualize seu perfil REAL'}
              data-noexport="1"
            >
              {redoLocked ? <FiLock size={15} /> : <FiRefreshCw size={15} />} Refazer diagnóstico
            </button>
          )}
        </div>
      )}

      {/* SEÇÃO 2 — O perfil REAL */}
      <div ref={profileRef} className={`${styles.realProfileCard} ${styles.reveal}`} style={{ animationDelay: '0.1s' }}>
        {/* Refazer diagnóstico: sutil, no canto do card (não exportado no PDF/share). */}
        {onRedo && !hideHero && (
          <button
            onClick={onRedo}
            data-noexport="1"
            title={redoLocked ? 'Recurso PRO — assine para refazer' : 'Refaça o quiz e atualize seu perfil REAL'}
            style={{ position: 'absolute', top: 18, right: 18, zIndex: 2, display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)', color: '#b3b3b3', padding: '7px 14px', borderRadius: 9999, cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}
          >
            {redoLocked ? <FiLock size={13} /> : <FiRefreshCw size={13} />} Refazer
          </button>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <RealBadge tier={realTier} label={String(altasForPattern(pattern))} size={72} />
          <div>
            <span className={styles.realProfileKicker}>Seu perfil de carreira</span>
            <h3 className={`${styles.realProfileName} ${styles.stamp}`} style={{ margin: 0 }}>{profile.name}</h3>
          </div>
        </div>
        {/*
          O RETRATO do perfil (§5.2), e não mais a descrição de uma linha. São textos definitivos
          da autora, um por perfil, com o Beginner em três estágios que o artista não vê. O legado
          cai na descrição antiga: os retratos descrevem a leitura da v4.
        */}
        <p className={styles.realProfileDesc}>{retratoDoPerfil(riAny)?.texto ?? clean(profile.description)}</p>
        {/*
          O R·E·A·L é a assinatura da entrega: quatro letras em serifa itálica sobre a palavra.

          O rótulo "Índice REAL" saiu, com a dica que vinha nele: o cabeçalho da página já diz
          "Diagnóstico REAL", e a dica explicava justamente o que as quatro palavras logo abaixo
          dizem por extenso. Era a terceira caixa-alta do mesmo bloco.
        */}
        <div className={styles.realPattern}>
          <div className={styles.realPatternRow}>
            {DIM_META.map((d, i) => {
              const high = pattern[d.key];
              const word = d.name.split(' · ')[0];
              return (
                <div key={d.key} className={`${styles.realPatternItem} ${high ? styles.realPatternItemHigh : styles.realPatternItemLow}`}>
                  <span
                    className={`${styles.realPatternLetter} ${high ? styles.realPatternLetterHigh : styles.realPatternLetterLow} ${styles.dotPop}`}
                    style={{ animationDelay: `${0.5 + i * 0.14}s` }}
                  >{d.letter}</span>
                  <span className={styles.realPatternWord}>{word}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {belowProfile}

      {/*
        O aviso de VERSÃO (§13.2), que fala do documento inteiro e não cabe em cartão nenhum.

        Os outros quatro textos obrigatórios do §11.3 saíram daqui: cada um vive dentro da
        dimensão a que pertence — ver `avisosSemLugarProprio`.
      */}
      {avisos.length > 0 && (
        <div className={`${styles.avisosBloco} ${styles.reveal}`} style={{ animationDelay: '0.14s' }}>
          {avisos.map((av) => (
            <div key={av.chave} className={`${styles.avisoLinha} ${av.chave === 'legado' ? styles.avisoLegado : ''}`}>
              {av.texto}
              {av.chave === 'legado' && onRedo && (
                <button type="button" className={styles.avisoAcao} onClick={onRedo}>Refazer o diagnóstico</button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* SEÇÃO 3 — As 4 dimensões em detalhe */}
      <div className={`${styles.dimGrid} ${styles.reveal}`} style={{ animationDelay: '0.18s' }}>
        {/*
          O ramo de baixo é só para diagnósticos da versão 2. A v3 e a v4 caem no `DimCardV3`,
          que é o card da spec do relatório (selo, barra, intro, leitura e comentários).

          Aqui o vocabulário foi alinhado ("Acesa" e "Apagada", §1.7 e §3), porque nomenclatura
          não é método: o estado sempre se chamou assim, só era exibido com outra palavra.

          O TEXTO, não. As frases da v4 descrevem uma leitura que a v2 não calculou, e colá-las
          sobre um resultado antigo seria dizer da carreira algo que aquele diagnóstico nunca
          mediu. É a mesma razão pela qual `retratoDoPerfil` devolve `null` no legado. Quem avisa
          que o retrato é de outra régua é o F17.
        */}
        {isV3
          ? DIM_META.map((d) => <DimCardV3 key={d.key} dk={d.key} ri={riAny} cm={chartmetric ?? null} />)
          : DIM_META.map((d) => {
              const high = pattern[d.key];
              const neutral = d.key === 'e' && earningsUnknown;
              const stateClass = neutral ? styles.stNeutral : high ? styles.stHigh : styles.stLow;
              const [title, sub] = d.name.split(' · ');
              return (
                <div key={d.key} className={`${styles.dimCard} ${stateClass}`}>
                  <div className={styles.dimTop}>
                    <span className={styles.dimMono}>{d.letter}</span>
                    <div className={styles.dimTitleWrap}>
                      <div className={styles.dimTitle}>{title}</div>
                      <div className={styles.dimSub}>{sub}</div>
                    </div>
                    <span className={styles.dimStatus}>{neutral ? 'Não informado' : high ? 'Acesa' : 'Apagada'}{isV2 && boletim ? ` · ${boletim[d.key]}/100` : ''}</span>
                  </div>
                  <div className={styles.dimLevel}>
                    <div className={styles.dimLevelFill} style={{ width: isV2 && boletim ? `${boletim[d.key]}%` : (high && !neutral ? '100%' : '34%') }} />
                  </div>
                  <div className={styles.dimStats}>
                    {dataLines[d.key].map((l) => (
                      <div key={l.label} className={styles.dimStatRow}>
                        <span className={styles.dimStatLabel}>{l.label}</span>
                        <span className={styles.dimStatValue}>{renderValue(l)}</span>
                      </div>
                    ))}
                  </div>
                  <p className={styles.dimPhrase}>
                    {neutral
                      ? 'Você não informou o faturamento. Sem esse dado, consideramos E como baixo para o cálculo.'
                      : high ? DIM_PHRASE[d.key].high : DIM_PHRASE[d.key].low}
                  </p>
                </div>
              );
            })}
      </div>

      {/* SEÇÃO EXTRA — Onde seus ouvintes estão (dado real do Chartmetric) */}
      {!!cities?.length && (
        <div className={`${styles.cityChart} ${styles.reveal}`} style={{ animationDelay: '0.24s', marginBottom: 28 }}>
          <div className={styles.cityChartLabel}>Onde seus ouvintes estão</div>
          {cities.slice(0, 5).map((c) => {
            const max = cities[0].listeners || 1;
            const pct = Math.max(6, Math.round((c.listeners / max) * 100));
            return (
              <div className={styles.cityRow} key={`${c.name}-${c.country}`}>
                <span className={styles.cityName}>{c.name}</span>
                <div className={styles.cityBarTrack}><div className={styles.cityBar} style={{ width: `${pct}%` }} /></div>
                <span className={styles.cityVal}>{fmtNum(c.listeners)}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* SEÇÃO EXTRA — Presença nas plataformas (enriquecimento Chartmetric, só pós-pago) */}
      {(!!chartmetric?.playlists?.top?.length || !!chartmetric?.audience?.top_countries?.length) && (
        <div className={`${styles.platformPresence} ${styles.reveal}`} style={{ animationDelay: '0.27s', marginBottom: 28 }}>
          <div className={styles.cityChartLabel}>Sua presença nas plataformas</div>

          {!!chartmetric?.playlists?.top?.length && (
            <div className={styles.platformSection}>
              <div className={styles.platformSectionTitle}>
                Playlists onde sua música está{chartmetric.playlists.count ? ` · ${chartmetric.playlists.count} no total` : ''}
              </div>
              <div className={styles.platformList}>
                {chartmetric.playlists.top.slice(0, 10).map((p, i) => (
                  <div key={`${p.name}-${i}`} className={styles.platformPlaylistRow}>
                    <span className={styles.platformRank}>{i + 1}</span>
                    <span className={styles.platformName}>{p.name}</span>
                    {p.editorial && <span className={styles.platformEditorial}>Editorial</span>}
                    {p.followers != null && <span className={styles.platformFollowers}>{fmtNum(p.followers)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!chartmetric?.audience?.top_countries?.length && (
            <div className={styles.platformSection}>
              <div className={styles.platformSectionTitle}>Principais países</div>
              {chartmetric.audience.top_countries.slice(0, 6).map((c) => {
                const max = chartmetric!.audience!.top_countries![0].listeners || 1;
                const pct = Math.max(6, Math.round(((c.listeners || 0) / max) * 100));
                return (
                  <div className={styles.cityRow} key={c.name}>
                    <span className={styles.cityName}>{c.name}</span>
                    <div className={styles.cityBarTrack}><div className={styles.cityBar} style={{ width: `${pct}%` }} /></div>
                    <span className={styles.cityVal}>{c.listeners != null ? fmtNum(c.listeners) : '–'}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* SEÇÃO EXTRA — Mapa dos 16 perfis (onde você está) */}
      <div className={`${styles.profileMap} ${styles.reveal}`} style={{ animationDelay: '0.3s' }}>
        <div className={styles.profileMapTitle}>Sua posição entre os 16 perfis</div>
        {PROFILE_MAP.map((row) => (
          <div key={row.tier} className={styles.mapRow}>
            <RealBadge tier={tierForAltas(row.altas)} label={String(row.altas)} size={38} />
            <span className={styles.mapTier}>{row.tier}</span>
            <div className={styles.mapChips}>
              {row.names.map((nm) => {
                const bits = PROFILE_BITS[nm];
                return (
                  <span key={nm} className={`${styles.mapChip} ${nm === profile.name ? styles.mapChipOn : ''}`}>
                    <span className={styles.mapChipName}>{nm}</span>
                    {bits && (
                      <span className={styles.mapChipDots}>
                        {(['r', 'e', 'a', 'l'] as const).map((k) => (
                          <span key={k} className={`${styles.mapDot} ${bits[k] ? styles.mapDotOn : ''}`}>{k.toUpperCase()}</span>
                        ))}
                      </span>
                    )}
                    {/* §5.3 — a leitura curta explica o perfil sem abrir nada. */}
                    {!!bits && !!LEITURAS_CURTAS[chaveDoPerfil(bits)] && (
                      <span className={styles.mapChipLeitura}>{LEITURAS_CURTAS[chaveDoPerfil(bits)]}</span>
                    )}
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/*
        SEÇÃO 4 — o bloco "O que o seu diagnóstico revela" SAIU (§13.3): eram dois bullets por
        perfil, e o conteúdo deles agora está no retrato acima e nos comentários de cada dimensão.
        Mantê-lo seria dizer a mesma coisa três vezes.

        O legado continua com os bullets: lá não há retrato nem comentários que os substituam.
      */}
      {ehLegado(riAny) && !!profile.insights?.length && (
        <div className={`${styles.insightsBlock} ${styles.reveal}`} style={{ animationDelay: '0.36s' }}>
          <div className={styles.insightsTitle}>O que o seu diagnóstico revela</div>
          <ul className={styles.insightsList}>
            {profile.insights.map((it, i) => (
              <li key={i}><span className={styles.insightDot}>▸</span><span>{clean(it)}</span></li>
            ))}
          </ul>
        </div>
      )}

      {/* SEÇÃO 5 — Call to action */}
      <div ref={ctaRef} className={`${styles.ctaBlock} ${styles.reveal}`} style={{ animationDelay: '0.42s' }}>
        {showPlanningCta ? (
          <>
            <h3 className={styles.ctaTitle}>
              <Typewriter text={CTA_TITLE} active={ctaInView} speed={26} onDone={() => setTitleDone(true)} />
            </h3>
            <p className={styles.ctaParagraph}>
              <Typewriter text={CTA_SUB} active={titleDone} speed={9} onDone={() => setSubDone(true)} />
            </p>
            {/* data-noexport: o PDF é uma captura estática — um iframe sairia como retângulo
                vazio. O vídeo é da tela, não do documento. */}
            <div className={styles.ctaVideo} data-noexport="1">
              <iframe
                className={styles.ctaVideoPlayer}
                src={VIDEO_DO_PLANEJAMENTO.url(VIDEO_DO_PLANEJAMENTO.id)}
                title={VIDEO_DO_PLANEJAMENTO.titulo}
                allow='accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share'
                allowFullScreen
                loading='lazy'
              />
            </div>
            <button className={`${styles.cta} ${styles.ctaReveal} ${ctaInView ? styles.ctaRevealOn : ''}`} onClick={onContinue}>
              Começar meu planejamento com a Nyta <FiArrowRight />
            </button>
          </>
        ) : (
          <h3 className={styles.ctaTitle}>{LEVAR_O_DIAGNOSTICO.titulo}</h3>
        )}
        <div className={styles.shareActions} data-noexport="1">
          <button className={styles.shareBtn} onClick={handleDownloadPdf} disabled={busy}><DownloadIcon size={18} /> {busy ? LEVAR_O_DIAGNOSTICO.baixando : LEVAR_O_DIAGNOSTICO.baixar}</button>
          <button className={styles.shareBtn} onClick={handleShare} disabled={busy} aria-label="Compartilhar diagnóstico"><FiShare2 size={15} /> {LEVAR_O_DIAGNOSTICO.compartilhar}</button>
        </div>
        {showPlanningCta && <p className={styles.ctaMicrocopy}>{CHAMADA_DO_PLANEJAMENTO.nota}</p>}
      </div>

      {/* SEÇÃO 6 — Quem assina (autoria da metodologia) */}
      <div className={`${styles.signBlock} ${styles.reveal}`} style={{ animationDelay: '0.46s' }}>
        <div className={styles.signKicker}>Quem assina</div>
        <div className={styles.signName}>{QUEM_ASSINA.name}</div>
        <div className={styles.signRole}>{QUEM_ASSINA.role}</div>
        {QUEM_ASSINA.paras.map((p, i) => <p key={i} className={styles.signPara}>{p}</p>)}
        <p className={styles.signHighlight}>{QUEM_ASSINA.highlight}</p>
      </div>

      {/* SEÇÃO 7 — Rodapé colapsável: como nasce o diagnóstico */}
      <div className={styles.methodBlock}>
        <button className={styles.methodToggle} onClick={() => setMethodOpen((v) => !v)}>
          {METODOLOGIA.title}
          <FiChevronDown className={methodOpen ? styles.methodChevronOpen : styles.methodChevron} />
        </button>
        {methodOpen && (
          <div className={styles.methodBody}>
            {METODOLOGIA.intro.map((p, i) => <p key={i}>{p}</p>)}
            <div className={styles.methodDims}>
              {METODOLOGIA.dims.map((d) => (
                <div key={d.l} className={styles.methodDim}>
                  <span className={styles.methodDimLetter}>{d.l}</span>
                  <div>
                    <div className={styles.methodDimName}>{d.t}</div>
                    <div className={styles.methodDimDesc}>{d.d}</div>
                  </div>
                </div>
              ))}
            </div>
            <p>{METODOLOGIA.outro}</p>
          </div>
        )}
      </div>

      {/* CTA fixo no rodapé (aparece ao rolar além do perfil). Portal no body para
          escapar do transform residual de .interaction (que quebra position:fixed).
          Só na criação (enableStickyCta) e quando há CTA de planejamento — na /diagnostico fica off. */}
      {enableStickyCta && showPlanningCta && showSticky && createPortal(
        <div className={styles.stickyCta}>
          <button className={styles.cta} onClick={onContinue}>
            {CHAMADA_DO_PLANEJAMENTO.botao} <FiArrowRight />
          </button>
        </div>,
        document.body
      )}

      {/* Deck de apresentação — fora da tela, capturado em PDF multipágina */}
      <div ref={docRef} className={styles.shareStage} aria-hidden data-noexport="1">
        <DiagnosticDoc realIndex={realIndex} chartmetric={chartmetric} artistName={name} avatarSrc={avatarSrc} autoria={autoria} />
      </div>

      {/* Cartão de compartilhamento — fora da tela, capturado como PNG */}
      <div className={styles.shareStage} aria-hidden data-noexport="1">
        <div ref={shareRef} className={styles.shareCard}>
          <div className={styles.shareBrand}>
            <MaestraBrand variant='wordmark' tone='light' />
          </div>
          <img className={styles.shareAvatar} src={avatarSrc} alt="" crossOrigin="anonymous" />
          <div className={styles.shareKicker}>Diagnóstico de carreira</div>
          <div className={styles.shareName}>{profile.name}</div>
          <div className={styles.shareTagline}>{clean(profile.description)}</div>
          <div className={styles.sharePattern}>
            {DIM_META.map((d) => (
              <div key={d.key} className={styles.sharePatternItem}>
                <span className={styles.sharePatternLetter}>{d.letter}</span>
                <span className={styles.sharePatternDot} style={{ background: pattern[d.key] ? '#9A4FD1' : '#5a5a64' }} />
              </div>
            ))}
          </div>
          <div className={styles.shareFooter}>maestramanager.com</div>
        </div>
      </div>
    </div>
  );
};

export default DiagnosticReport;
