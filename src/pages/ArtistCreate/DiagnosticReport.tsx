import { FC, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Tooltip, message } from 'antd';
import { FiChevronDown, FiArrowRight, FiDownload, FiShare2, FiHelpCircle } from 'react-icons/fi';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import { ARTISTS_DEFAULT_IMAGE } from '../../constants/spotify';
import type { RealIndex } from '../../interfaces/maestra';
import { downloadNodePng, downloadPagesPdf, nodeToPngFile, urlToDataUrl } from '../../utils/exportImage';
import DiagnosticDoc from './DiagnosticDoc';
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
const PROFILE_MAP: { tier: string; names: string[] }[] = [
  { tier: '4 altas', names: ['Icon'] },
  { tier: '3 altas', names: ['Hit', 'Spotlight', 'Underpaid', 'Analog'] },
  { tier: '2 altas', names: ['Digital', 'Potential', 'Hype', 'Rising', 'Outlier', 'Bet'] },
  { tier: '1 alta', names: ['Influencer', 'Moneymaker', 'Paradox', 'Cult'] },
  { tier: '0 altas', names: ['Beginner'] },
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

interface Props {
  realIndex: RealIndex;
  chartmetric?: Chartmetric | null;
  artistName?: string;
  artistImage?: string | null;
  onContinue?: () => void;
  // CTA flutuante (sticky) ao rolar — só na criação; na tela /diagnostico fica desligado.
  enableStickyCta?: boolean;
  // Mostra o CTA "Começar planejamento" + a copy. Some quando o artista já tem plano (só PDF/share).
  showPlanningCta?: boolean;
}

// Página de diagnóstico REAL (free tier) — entregue ao artista antes do pagamento.
// Determinística: consome o realIndex calculado no backend (sem IA).
export const DiagnosticReport: FC<Props> = ({ realIndex, chartmetric, artistName, artistImage, onContinue, enableStickyCta = true, showPlanningCta = true }) => {
  const [methodOpen, setMethodOpen] = useState(false);
  const { profile, pattern, inputs, earningsUnknown } = realIndex;
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
  const [subDone, setSubDone] = useState(false);

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
      { label: 'Shows pagos (12 meses)', value: inputs.shows_pagos },
      { label: 'Maior público ao vivo', value: inputs.maior_publico },
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
    <div className={styles.realWrap}>
      {/* SEÇÃO 1 — Hero */}
      <div className={`${styles.realHero} ${styles.reveal}`} style={{ animationDelay: '0s' }}>
        <img className={styles.realHeroAvatar} src={artistImage || ARTISTS_DEFAULT_IMAGE} alt={name} />
        <div>
          <h2 className={styles.realHeroTitle}>Seu diagnóstico de carreira está pronto, {name}.</h2>
          <p className={styles.realHeroSub}>Baseado nos seus dados reais: Spotify, redes sociais e o que você nos contou.</p>
        </div>
        <button
          className={styles.heroShareBtn}
          onClick={handleShare}
          disabled={busy}
          aria-label="Compartilhar diagnóstico"
          title="Compartilhar"
          data-noexport="1"
        >
          <FiShare2 size={18} />
        </button>
      </div>

      {/* SEÇÃO 2 — O perfil REAL */}
      <div ref={profileRef} className={`${styles.realProfileCard} ${styles.reveal}`} style={{ animationDelay: '0.1s' }}>
        <span className={styles.realProfileKicker}>Seu perfil de carreira</span>
        <h3 className={`${styles.realProfileName} ${styles.stamp}`}>{profile.name}</h3>
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

      {/* SEÇÃO 3 — As 4 dimensões em detalhe */}
      <div className={`${styles.dimGrid} ${styles.reveal}`} style={{ animationDelay: '0.18s' }}>
        {DIM_META.map((d) => {
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
                <span className={styles.dimStatus}>{neutral ? 'Não informado' : high ? 'Alto' : 'Baixo'}</span>
              </div>
              <div className={styles.dimLevel}>
                <div className={styles.dimLevelFill} style={{ width: high && !neutral ? '100%' : '34%' }} />
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
                    {p.editorial && <span style={{ fontSize: 10, fontWeight: 700, color: '#af2896', border: '1px solid rgba(175,40,150,0.4)', borderRadius: 4, padding: '1px 5px' }}>Editorial</span>}
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
            <span className={styles.mapTier}>{row.tier}</span>
            <div className={styles.mapChips}>
              {row.names.map((nm) => (
                <span key={nm} className={`${styles.mapChip} ${nm === profile.name ? styles.mapChipOn : ''}`}>{nm}</span>
              ))}
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
            <button className={`${styles.cta} ${styles.ctaReveal} ${subDone ? styles.ctaRevealOn : ''}`} onClick={onContinue}>
              Começar meu planejamento com a Nyta <FiArrowRight />
            </button>
          </>
        ) : (
          <h3 className={styles.ctaTitle}>Baixe ou compartilhe seu diagnóstico</h3>
        )}
        <div className={styles.shareActions} data-noexport="1">
          <button className={styles.shareBtn} onClick={handleDownloadPdf} disabled={busy}><FiDownload size={15} /> {busy ? 'Gerando…' : 'Baixar diagnóstico (PDF)'}</button>
        </div>
        {showPlanningCta && <p className={styles.ctaMicrocopy}>Seu diagnóstico REAL fica salvo. Você pode refazê-lo a qualquer momento para acompanhar a evolução da carreira.</p>}
      </div>

      {/* SEÇÃO 6 — Rodapé colapsável */}
      <div className={styles.methodBlock}>
        <button className={styles.methodToggle} onClick={() => setMethodOpen((v) => !v)}>
          Como calculamos o seu diagnóstico
          <FiChevronDown className={methodOpen ? styles.methodChevronOpen : styles.methodChevron} />
        </button>
        {methodOpen && (
          <p className={styles.methodBody}>
            O índice REAL foi criado por Anita Carvalho a partir de mais de 30 anos de experiência em gestão de carreiras musicais e da análise de 313 planejamentos estratégicos reais. Ele mede quatro dimensões (Reach, Earnings, Audience e Legitimacy), combinando dados reais do Spotify e das suas redes sociais com o que você nos contou sobre shows, faturamento e reconhecimento. O resultado é um dos 16 perfis de carreira possíveis, cada um com sua própria leitura estratégica.
          </p>
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
