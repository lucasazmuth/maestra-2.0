import { FC, ReactNode, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, message } from 'antd';
import { FiChevronDown, FiArrowRight, FiShare2, FiHelpCircle, FiRefreshCw, FiLock } from 'react-icons/fi';
import { DownloadIcon, DiagnosticoIcon } from '../../components/Icons/system';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import type { RealIndex } from '../../interfaces/maestra';
import { downloadNodePng, downloadPagesPdf, nodeToPngFile, urlToDataUrl } from '../../utils/exportImage';
import DiagnosticDoc from './DiagnosticDoc';
import { RealBadge, tierForAltas, tierForPattern, TIER_ACCENT, altasForPattern } from '../../components/RealBadge';
import { fmtBRL, fmtPct, PREMIOS_LABELS_V3, PAGANTE_LABELS, FREQ_LABELS, dimStatusText, PROFILE_BITS } from './realCopy';
import { dimNarrative, METODOLOGIA, QUEM_ASSINA } from './realNarrative';
import styles from './ArtistCreate.module.scss';

export interface Chartmetric {
  monthly_listeners?: number | null;
  monthly_listeners_rank?: number | null;
  career_rank?: number | null;
  top_cities?: { name: string; country: string; listeners: number }[];
  // Dados de enriquecimento (pós-pago) — opcionais, exibidos só quando existem.
  audience?: { top_countries?: { name: string; code?: string | null; listeners?: number | null }[] } | null;
  playlists?: { count?: number; reach?: number; top?: { name: string; followers?: number; curator?: string | null; editorial?: boolean }[] } | null;
  similar?: { name: string; image?: string | null }[] | null;
}

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
  { key: 'e', letter: 'E', name: 'Earnings · Receita' },
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

const CTA_TITLE = 'Você sabe onde está. Agora precisa saber para onde ir, e como.';
const CTA_SUB = 'O diagnóstico te mostrou o retrato da sua carreira hoje. O planejamento completo com a Nyta transforma esse retrato em um plano de ação real: estratégias priorizadas, cronograma e modelagem financeira, tudo construído por você, com a orientação da metodologia que já ajudou centenas de artistas.';

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

// ── V3: componentes do boletim (definidos no escopo de módulo p/ não remontar a cada render) ──
type DimK = 'r' | 'e' | 'a' | 'l';
const SRC_LABELS: Record<string, string> = { streaming: 'Streaming', direitos: 'Direitos', publi: 'Publicidade', aulas: 'Aulas', editais: 'Editais', venda: 'Venda / merch', outros: 'Outros' };
const PIE_COLORS = ['#1db954', '#4c7dff', '#e0a13c', '#af2896', '#21b26e', '#9b8cff', '#d65a5a'];

// Pizza de composição da receita (Shows × cachê + cada fonte musical). §5.4 / §9.4.
const RevenuePie: FC<{ revenue: any }> = ({ revenue }) => {
  const segs: { label: string; value: number }[] = [];
  if (Number(revenue?.shows) > 0) segs.push({ label: 'Shows', value: Number(revenue.shows) });
  Object.entries(revenue?.sources || {}).forEach(([k, v]) => { if (Number(v) > 0) segs.push({ label: SRC_LABELS[k] || k, value: Number(v) }); });
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
    </div>
  );
};

// Engajamento por rede (mostra as 3, com a leitura do corte). §6.3 / §9.4.
const EngagementGrid: FC<{ engagement: any }> = ({ engagement }) => {
  const nets: [string, string][] = [['Instagram', 'instagram'], ['TikTok', 'tiktok'], ['YouTube', 'youtube']];
  return (
    <div className={styles.engGrid}>
      <div className={styles.engGridTitle}>Engajamento por rede</div>
      {nets.map(([label, key]) => {
        const e = engagement?.[key];
        return (
          <div key={key} className={styles.engRow}>
            <span className={styles.engNet}>{label}</span>
            {e
              ? <span className={`${styles.engVal} ${e.above ? styles.engAbove : styles.engBelow}`}>{fmtPct(e.value)} {e.above ? 'acima' : 'abaixo'} do corte ({fmtPct(e.cut)})</span>
              : <span className={styles.engVal}>—</span>}
          </div>
        );
      })}
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
  const rows: { label: string; num?: number | null; value?: string }[] =
    dk === 'r' ? [
      { label: 'Ouvintes Spotify', num: cm?.monthly_listeners ?? inputs.spotifyListeners ?? null },
      { label: 'Instagram', num: inputs.igFollowers ?? null },
      { label: 'TikTok', num: inputs.tiktokFollowers ?? null },
      { label: 'YouTube mensal', num: inputs.youtubeMonthlyViews ?? null },
    ] : dk === 'e' ? [
      { label: 'Receita mensal', value: fmtBRL(Number(rev.total ?? 0)) },
      { label: 'Shows / mês', value: String(inputs.showsPerMonth ?? 0) },
      { label: 'Cachê médio', value: fmtBRL(Number(inputs.cache ?? 0)) },
    ] : dk === 'a' ? [
      { label: 'Shows / mês', value: String(inputs.showsPerMonth ?? 0) },
      { label: '% público pagante', value: inputs.fazBilheteria ? (PAGANTE_LABELS[inputs.pagantePct] ?? '—') : 'Não faz bilheteria' },
      { label: 'Seguidores Spotify', num: inputs.spotifyFollowers ?? null },
      { label: 'Fãs Deezer', num: inputs.deezerFans ?? null },
    ] : [
      { label: 'Prêmios', value: PREMIOS_LABELS_V3[Number(inputs.premios ?? 0)] ?? '—' },
      { label: 'Imprensa', value: inputs.imprensaRepercussao ? (FREQ_LABELS[inputs.imprensaFrequencia] ?? 'Sim') : 'Não' },
      { label: 'Playlists editoriais', value: String(inputs.editorialPlaylists ?? cm?.playlists?.count ?? 0) },
      { label: 'Execução em rádio', value: Number(inputs.radioAirplay) > 0 ? 'Sim' : 'Não' },
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
          <span className={`${styles.dimBadge} ${top ? styles.dimBadgeTop : high ? styles.dimBadgeHigh : styles.dimBadgeLow}`}>{top ? 'Top Tier' : high ? 'Alto' : 'Baixo'}</span>
          <span className={styles.dimScore}>{score}<span className={styles.dimScoreMax}>/100</span></span>
        </div>
      </div>
      <div className={styles.ruler}>
        {/* Top Tier (flag do motor): a barra enche até o selo em dourado, pra não contradizer o selo. */}
        <div className={styles.rulerFill} style={top ? { width: '100%', background: 'linear-gradient(90deg,#f5c451,#e0a13c)' } : { width: `${score}%` }} />
        <span className={styles.rulerMark} style={{ left: '70%' }} data-label="acende" />
        <span className={styles.rulerMark} style={{ left: '100%' }} data-label="top tier" />
      </div>
      <div className={styles.dimStatusLine}>{dimStatusText(score, high, top)}</div>
      <div className={styles.dimStats}>
        {rows.map((l) => (
          <div key={l.label} className={styles.dimStatRow}>
            <span className={styles.dimStatLabel}>{l.label}</span>
            <span className={styles.dimStatValue}>{l.num != null ? <CountUp value={l.num} /> : (l.value ?? '—')}</span>
          </div>
        ))}
      </div>
      {dk === 'e' && <RevenuePie revenue={rev} />}
      {dk === 'e' && (!inputs.temCnpj || !inputs.temEmpresario) && (
        <div className={styles.eBadges}>
          {!inputs.temCnpj && <span className={styles.eBadge}>Sem CNPJ</span>}
          {!inputs.temEmpresario && <span className={styles.eBadge}>Sem empresário</span>}
        </div>
      )}
      {dk === 'e' && (() => {
        // Saúde financeira (12 meses): faturamento bruto anual × investimento informado → saldo.
        // Investimento é exibição/diagnóstico (§5.4) — não entra no índice.
        const fat = Math.round(Number(rev.total ?? 0) * 12);
        const inv = Math.round(Number(inputs.investimento ?? 0));
        const saldo = fat - inv;
        const money = (n: number) => `R$ ${fmtNum(Math.abs(n))}`;
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
      })()}
      {dk === 'a' && <EngagementGrid engagement={ri.engagement} />}
      {(() => {
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
}

// Rótulos dos níveis de prêmios/imprensa do motor v2 (índice → texto p/ a exibição).
const PREMIO_LABELS = ['Nunca fui indicada nem premiada', 'Já fui indicada (sem ganhar)', 'Prêmio local/regional', 'Prêmio nacional', 'Prêmio internacional'];
const IMPRENSA_LABELS = ['Nunca apareci na mídia', 'Repercussão local/regional', 'Repercussão nacional', 'Repercussão internacional'];

// Normaliza os `inputs` do motor v2 (números/enums) para o shape que a tela já consome (v1).
// Reutilizado pelo PDF (DiagnosticDoc). eslint-disable-next-line @typescript-eslint/no-explicit-any
export const v2InputsView = (ri: any) => ({
  monthly_listeners: ri?.spotifyListeners ?? null,
  sp_followers: ri?.spotifyFollowers ?? null,
  social: { instagram: ri?.igFollowers ?? null, tiktok: ri?.tiktokFollowers ?? null, youtube: ri?.youtubeMonthlyViews ?? null },
  faturamento: fmtBRL(Number(ri?.showsPerMonth ?? 0) * Number(ri?.cache ?? 0) + Number(ri?.faturamentoForaShows ?? 0)),
  shows_pagos: String(ri?.showsPerMonth ?? 0),
  maior_publico: String(ri?.avgAudience ?? 0),
  premios: PREMIO_LABELS[ri?.premios] ?? '—',
  imprensa: IMPRENSA_LABELS[ri?.imprensa] ?? '—',
});

// Página de diagnóstico REAL (free tier) — entregue ao artista antes do pagamento.
// Determinística: consome o realIndex calculado no backend (sem IA). Suporta v1 (antigo) e v2.
export const DiagnosticReport: FC<Props> = ({ realIndex, chartmetric, artistName, artistImage, noSpotify = false, onContinue, enableStickyCta = true, showPlanningCta = true, onRedo, redoLocked = false, heroTitle, heroSub, hideHero = false, belowProfile }) => {
  const [methodOpen, setMethodOpen] = useState(false);
  // v2 (motor REAL Consolidado) tem `version: 2` + `boletim`; v1 mantém o shape antigo.
  const riAny = realIndex as any;
  const isV2 = riAny.version === 2;
  const isV3 = riAny.version === 3;
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

  // Entrega completa: deck de apresentação multipágina em PDF.
  const handleDownloadPdf = async () => {
    if (!docRef.current) return;
    const pages = Array.from(docRef.current.querySelectorAll<HTMLElement>('[data-docpage]'));
    if (!pages.length) return;
    setBusy(true);
    try {
      await downloadPagesPdf(pages, `diagnostico-${(name || 'artista').toLowerCase().replace(/\s+/g, '-')}.pdf`);
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
            <h2 className={styles.realHeroTitle}>{heroTitle || `Seu diagnóstico de carreira está pronto, ${name}.`}</h2>
            <p className={styles.realHeroSub}>
              {heroSub
                || (noSpotify
                  ? 'Baseado no que você nos contou. Quando você conectar o Spotify, a gente atualiza com seus números de plataforma.'
                  : 'Baseado nos seus dados reais: Spotify, redes sociais e o que você nos contou.')}
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
        {/* Ícone decorativo do REAL, grande e translúcido no canto (segue a cor do tier). */}
        <span data-noexport="1" aria-hidden style={{ position: 'absolute', right: -14, bottom: -20, color: 'rgb(var(--real-accent, 175, 40, 150))', opacity: 0.08, pointerEvents: 'none', lineHeight: 0 }}>
          <span style={{ display: 'block', width: 170, height: 170 }}><DiagnosticoIcon size={170} /></span>
        </span>
        {/* Refazer diagnóstico: sutil, no canto do card (não exportado no PDF/share). */}
        {onRedo && (
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
        <p className={styles.realProfileDesc}>{clean(profile.description)}</p>
        <div className={styles.realPattern}>
          <div className={styles.realPatternHead}>
            <span className={styles.realPatternHeadLabel}>Índice REAL</span>
            <Tooltip
              title="REAL = Reach (alcance), Earnings (receita), Audience (público real) e Legitimacy (legitimação): as quatro dimensões que definem onde a sua carreira está hoje. O ponto verde marca uma dimensão alta."
              placement="top"
            >
              <span className={styles.realPatternInfo} tabIndex={0} role="button" aria-label="O que é o Índice REAL">
                <FiHelpCircle size={15} />
              </span>
            </Tooltip>
          </div>
          <div className={styles.realPatternRow}>
            {DIM_META.map((d, i) => {
              const high = pattern[d.key];
              const word = d.name.split(' · ')[0];
              return (
                <div key={d.key} className={styles.realPatternItem}>
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

      {/* SEÇÃO 3 — As 4 dimensões em detalhe */}
      <div className={`${styles.dimGrid} ${styles.reveal}`} style={{ animationDelay: '0.18s' }}>
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
                    <span className={styles.dimStatus}>{neutral ? 'Não informado' : high ? 'Alto' : 'Baixo'}{isV2 && boletim ? ` · ${boletim[d.key]}/100` : ''}</span>
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
      {(!!chartmetric?.playlists?.top?.length || !!chartmetric?.audience?.top_countries?.length || !!chartmetric?.similar?.length) && (
        <div className={styles.reveal} style={{ animationDelay: '0.27s', marginBottom: 28, background: '#181818', borderRadius: 14, padding: 20, border: '1px solid #282828' }}>
          <div className={styles.cityChartLabel} style={{ marginBottom: 16 }}>Sua presença nas plataformas</div>

          {!!chartmetric?.playlists?.top?.length && (
            <div style={{ marginBottom: (chartmetric?.audience?.top_countries?.length || chartmetric?.similar?.length) ? 22 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b3b3b3', marginBottom: 10 }}>
                Playlists onde sua música está{chartmetric.playlists.count ? ` · ${chartmetric.playlists.count} no total` : ''}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {chartmetric.playlists.top.slice(0, 10).map((p, i) => (
                  <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                    <span style={{ color: '#71717a', width: 18, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{i + 1}</span>
                    <span style={{ color: '#fff', flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                    {p.editorial && <span style={{ fontSize: 10, fontWeight: 700, color: 'rgb(var(--real-accent, 175, 40, 150))', border: '1px solid rgba(var(--real-accent, 175, 40, 150), 0.4)', borderRadius: 4, padding: '1px 5px' }}>Editorial</span>}
                    {p.followers != null && <span style={{ color: '#8a8a92', fontVariantNumeric: 'tabular-nums' }}>{fmtNum(p.followers)}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {!!chartmetric?.audience?.top_countries?.length && (
            <div style={{ marginBottom: chartmetric?.similar?.length ? 22 : 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b3b3b3', marginBottom: 10 }}>Principais países</div>
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

          {!!chartmetric?.similar?.length && (
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#b3b3b3', marginBottom: 10 }}>Artistas de referência</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {chartmetric.similar.filter((a) => a.name?.toLowerCase() !== (name || '').toLowerCase()).slice(0, 12).map((a) => (
                  <span key={a.name} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: '#222', borderRadius: 9999, padding: '4px 12px 4px 4px', fontSize: 12, fontWeight: 600, color: '#e0e0e0' }}>
                    {a.image
                      ? <img src={a.image} alt="" crossOrigin="anonymous" style={{ width: 20, height: 20, borderRadius: '50%', objectFit: 'cover' }} />
                      : <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#333', display: 'inline-block' }} />}
                    {a.name}
                  </span>
                ))}
              </div>
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
                  </span>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* SEÇÃO 4 — Insights do perfil */}
      {!!profile.insights?.length && (
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
            <button className={`${styles.cta} ${styles.ctaReveal} ${ctaInView ? styles.ctaRevealOn : ''}`} onClick={onContinue}>
              Começar meu planejamento com a Nyta <FiArrowRight />
            </button>
          </>
        ) : (
          <h3 className={styles.ctaTitle}>Baixe ou compartilhe seu diagnóstico</h3>
        )}
        <div className={styles.shareActions} data-noexport="1">
          <button className={styles.shareBtn} onClick={handleDownloadPdf} disabled={busy}><DownloadIcon size={18} /> {busy ? 'Gerando…' : 'Baixar diagnóstico (PDF)'}</button>
          <button className={styles.shareBtn} onClick={handleShare} disabled={busy} aria-label="Compartilhar diagnóstico"><FiShare2 size={15} /> Compartilhar</button>
        </div>
        {showPlanningCta && <p className={styles.ctaMicrocopy}>Seu diagnóstico REAL fica salvo. Você pode refazê-lo a qualquer momento para acompanhar a evolução da carreira.</p>}
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
            Começar meu planejamento com a Nyta <FiArrowRight />
          </button>
        </div>,
        document.body
      )}

      {/* Deck de apresentação — fora da tela, capturado em PDF multipágina */}
      <div ref={docRef} className={styles.shareStage} aria-hidden data-noexport="1">
        <DiagnosticDoc realIndex={realIndex} chartmetric={chartmetric} artistName={name} avatarSrc={avatarSrc} />
      </div>

      {/* Cartão de compartilhamento — fora da tela, capturado como PNG */}
      <div className={styles.shareStage} aria-hidden data-noexport="1">
        <div ref={shareRef} className={styles.shareCard}>
          <div className={styles.shareBrand}><MaestraLogo className={styles.shareBrandLogo} /> Maestra Manager</div>
          <img className={styles.shareAvatar} src={avatarSrc} alt="" crossOrigin="anonymous" />
          <div className={styles.shareKicker}>Diagnóstico de carreira</div>
          <div className={styles.shareName}>{profile.name}</div>
          <div className={styles.shareTagline}>{clean(profile.description)}</div>
          <div className={styles.sharePattern}>
            {DIM_META.map((d) => (
              <div key={d.key} className={styles.sharePatternItem}>
                <span className={styles.sharePatternLetter}>{d.letter}</span>
                <span className={styles.sharePatternDot} style={{ background: pattern[d.key] ? '#af2896' : '#5a5a64' }} />
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
