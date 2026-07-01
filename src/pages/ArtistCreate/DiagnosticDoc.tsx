import { FC, ReactNode } from 'react';

import { Wordmark } from '../../components/Wordmark';
import type { RealIndex } from '../../interfaces/maestra';
import { RealBadge, tierForAltas } from '../../components/RealBadge';
import { v2InputsView, type Chartmetric } from './DiagnosticReport';
import {
  DIM_META, DIM_PHRASE, PROFILE_MAP, PROFILE_BITS, clean, fmtNum, fmtBRL, fmtPct,
  PREMIOS_LABELS_V3, PAGANTE_LABELS, FREQ_LABELS, dimStatusText,
} from './realCopy';
import { dimNarrative, METODOLOGIA, QUEM_ASSINA } from './realNarrative';
import styles from './ArtistCreate.module.scss';

interface Props {
  realIndex: RealIndex;
  chartmetric?: Chartmetric | null;
  artistName: string;
  avatarSrc: string;
}

// IMPORTANTE: componentes de página no escopo de MÓDULO (não dentro do doc). Se ficarem dentro do
// componente, viram função nova a cada render — React remonta as páginas e, no loop async da captura
// do PDF, elas saem 0×0 (branco). `total` e `n` vêm por prop.
const Page: FC<{ n: number; total: number; kicker?: string; children: ReactNode }> = ({ n, total, kicker, children }) => (
  <div className={styles.docPage} data-docpage>
    <div className={styles.docHeader}>
      <span className={styles.docBrand}><Wordmark /></span>
      {kicker && <span className={styles.docHeaderLabel}>{kicker}</span>}
    </div>
    <div className={styles.docBody}>{children}</div>
    <div className={styles.docFooter}><span>maestramanager.com</span><span>{n} / {total}</span></div>
  </div>
);

// ─── Helpers de dados V3 ───────────────────────────────────────────────────────
const SRC_DISPLAY: Record<string, string> = {
  streaming: 'Streaming', direitos: 'Direitos', publi: 'Publicidade', aulas: 'Aulas',
  editais: 'Editais', venda: 'Venda / merch', outros: 'Outros',
};
const money = (n: number) => `R$ ${fmtNum(Math.abs(Math.round(n)))}`;

const DIM_TAGLINE: Record<'r' | 'e' | 'a' | 'l', string> = {
  r: 'O quanto a sua música alcança gente no digital.',
  e: 'O quanto a sua carreira fatura com música.',
  a: 'O público que aparece, paga ingresso e se conecta de verdade.',
  l: 'O reconhecimento do setor: imprensa, prêmios, plataformas.',
};

// Cor da nota/régua por estado (verde acende, âmbar baixo, dourado top tier).
const dimColor = (high: boolean, top: boolean) => (top ? '#f5c451' : high ? '#21b26e' : '#e0a13c');

type Row = { label: string; value: string };
function v3DimRows(dk: 'r' | 'e' | 'a' | 'l', ri: any, cm: Chartmetric | null): Row[] {
  const inp = ri.inputs || {};
  const rev = ri.revenue || {};
  const numOr = (n: number | null | undefined) => (n != null ? fmtNum(Number(n)) : null);
  const rows: (Row | null)[] =
    dk === 'r' ? [
      { label: 'Ouvintes Spotify', value: numOr(cm?.monthly_listeners ?? inp.spotifyListeners) ?? '–' },
      inp.igFollowers != null ? { label: 'Instagram', value: fmtNum(inp.igFollowers) } : null,
      inp.tiktokFollowers != null ? { label: 'TikTok', value: fmtNum(inp.tiktokFollowers) } : null,
      inp.youtubeMonthlyViews != null ? { label: 'YouTube mensal', value: fmtNum(inp.youtubeMonthlyViews) } : null,
    ] : dk === 'e' ? [
      { label: 'Receita mensal', value: fmtBRL(Number(rev.total ?? 0)) },
      { label: 'Shows / mês', value: String(inp.showsPerMonth ?? 0) },
      { label: 'Cachê médio', value: fmtBRL(Number(inp.cache ?? 0)) },
    ] : dk === 'a' ? [
      { label: 'Shows / mês', value: String(inp.showsPerMonth ?? 0) },
      { label: '% público pagante', value: inp.fazBilheteria ? (PAGANTE_LABELS[inp.pagantePct] ?? '–') : 'Não faz bilheteria' },
      inp.spotifyFollowers != null ? { label: 'Seguidores Spotify', value: fmtNum(inp.spotifyFollowers) } : null,
      inp.deezerFans != null ? { label: 'Fãs Deezer', value: fmtNum(inp.deezerFans) } : null,
    ] : [
      { label: 'Prêmios', value: PREMIOS_LABELS_V3[Number(inp.premios ?? 0)] ?? '–' },
      { label: 'Imprensa', value: inp.imprensaRepercussao ? (FREQ_LABELS[inp.imprensaFrequencia] ?? 'Sim') : 'Não' },
      { label: 'Playlists editoriais', value: String(inp.editorialPlaylists ?? cm?.playlists?.count ?? 0) },
      { label: 'Execução em rádio', value: Number(inp.radioAirplay) > 0 ? 'Sim' : 'Não' },
    ];
  return rows.filter((r): r is Row => r != null);
}

function revComposition(ri: any): { label: string; pct: number }[] {
  const rev = ri.revenue || {};
  const segs: { label: string; value: number }[] = [];
  if (Number(rev.shows) > 0) segs.push({ label: 'Shows', value: Number(rev.shows) });
  Object.entries(rev.sources || {}).forEach(([k, v]) => { if (Number(v) > 0) segs.push({ label: SRC_DISPLAY[k] || k, value: Number(v) }); });
  const total = segs.reduce((s, x) => s + x.value, 0);
  if (!total) return [];
  return segs.sort((a, b) => b.value - a.value).map((s) => ({ label: s.label, pct: Math.round((s.value / total) * 100) }));
}

// ─── Página de uma dimensão (V3) ───────────────────────────────────────────────
const DocDimPage: FC<{ dk: 'r' | 'e' | 'a' | 'l'; n: number; total: number; ri: any; cm: Chartmetric | null }> = ({ dk, n, total, ri, cm }) => {
  const meta = DIM_META.find((m) => m.key === dk)!;
  const high = !!ri.pattern?.[dk];
  const top = !!ri.dimTopIcon?.[dk];
  const score = Math.max(0, Math.min(100, Math.round(Number(ri.boletim?.[dk] ?? 0))));
  const color = dimColor(high, top);
  const rows = v3DimRows(dk, ri, cm);
  const nar = dimNarrative(dk, ri);
  const inp = ri.inputs || {};
  const rev = ri.revenue || {};
  const comp = dk === 'e' ? revComposition(ri) : [];
  const fat = Math.round(Number(rev.total ?? 0) * 12);
  const inv = Math.round(Number(inp.investimento ?? 0));
  const saldo = fat - inv;
  const eng = ri.engagement || {};

  return (
    <Page n={n} total={total} kicker={`${meta.full} · ${meta.sub}`}>
      <div className={styles.docDimHead2}>
        <span className={styles.docDimLetter2} style={{ color }}>{meta.letter}</span>
        <div className={styles.docDimTitleWrap2}>
          <div className={styles.docDimTitle2}>{meta.full} <span className={styles.docDimTitleSub2}>· {meta.sub}</span></div>
          <div className={styles.docDimTag2}>{DIM_TAGLINE[dk]}</div>
        </div>
        <div className={styles.docDimScoreWrap2}>
          <span className={styles.docDimBadge2} style={top ? { background: 'linear-gradient(120deg,#f5c451,#e0a13c)', color: '#1a1206' } : high ? { background: color, color: '#04140c' } : { background: 'rgba(255,255,255,0.08)', color: '#cfcfd4' }}>{top ? 'Top Tier' : high ? 'Alto' : 'Baixo'}</span>
          <span className={styles.docDimScore2}>{score}<span className={styles.docDimScoreMax2}>/100</span></span>
        </div>
      </div>

      <div className={styles.docRuler2}>
        {/* Top Tier: a barra enche até o selo (dourado), coerente com o selo do motor. */}
        <div className={styles.docRulerFill2} style={top ? { width: '100%', background: 'linear-gradient(90deg,#f5c451,#e0a13c)' } : { width: `${score}%`, background: color }} />
        <span className={styles.docRulerMark2} style={{ left: '70%' }} data-label="acende" />
        <span className={styles.docRulerMark2} style={{ left: '100%' }} data-label="top tier" />
      </div>
      <div className={styles.docDimStatus2}>{dimStatusText(score, high, top)}</div>

      <div className={styles.docDimMetrics2}>
        {rows.map((r) => (
          <div key={r.label} className={styles.docDimMetric2}><span>{r.label}</span><strong>{r.value}</strong></div>
        ))}
      </div>

      {dk === 'e' && comp.length > 0 && (
        <div className={styles.docSubBlock2}>
          <div className={styles.docSubTitle2}>Composição da receita</div>
          <div className={styles.docCompRow2}>
            {comp.map((s) => (
              <div key={s.label} className={styles.docCompItem2}><span className={styles.docCompPct2}>{s.pct}%</span><span className={styles.docCompLabel2}>{s.label}</span></div>
            ))}
          </div>
        </div>
      )}
      {dk === 'e' && (fat > 0 || inv > 0) && (
        <div className={styles.docSubBlock2}>
          <div className={styles.docSubTitle2}>Saúde financeira · 12 meses</div>
          <div className={styles.docHealthRow2}>
            <div className={styles.docHealthItem2}><span>Faturamento</span><strong>{money(fat)}</strong></div>
            <div className={styles.docHealthItem2}><span>Investimento</span><strong>{money(inv)}</strong></div>
            <div className={styles.docHealthItem2}><span>Saldo</span><strong style={{ color: saldo >= 0 ? '#21b26e' : '#e06666' }}>{saldo >= 0 ? '+' : '−'}{money(saldo)}</strong></div>
          </div>
          <div className={styles.docPills2}>
            <span className={inp.temCnpj ? styles.docPillOn2 : styles.docPillOff2}>{inp.temCnpj ? 'Com CNPJ' : 'Sem CNPJ'}</span>
            <span className={inp.temEmpresario ? styles.docPillOn2 : styles.docPillOff2}>{inp.temEmpresario ? 'Com empresário' : 'Sem empresário'}</span>
          </div>
        </div>
      )}
      {dk === 'a' && (['instagram', 'tiktok', 'youtube'] as const).some((k) => eng[k]) && (
        <div className={styles.docSubBlock2}>
          <div className={styles.docSubTitle2}>Engajamento por rede</div>
          {(['instagram', 'tiktok', 'youtube'] as const).map((k) => {
            const e = eng[k];
            const label = k === 'instagram' ? 'Instagram' : k === 'tiktok' ? 'TikTok' : 'YouTube';
            if (!e) return null;
            return (
              <div key={k} className={styles.docEngRow2}><span>{label}</span><strong style={{ color: e.above ? '#21b26e' : '#9a9aa3' }}>{fmtPct(e.value)} {e.above ? 'acima' : 'abaixo'} do corte</strong></div>
            );
          })}
        </div>
      )}

      <div className={styles.docReveal2}>
        <div className={styles.docRevealTitle2}>O que isso revela</div>
        <div className={styles.docRevealLead2}>{nar.headline}</div>
        {nar.paras.map((p, i) => (
          <p key={i} className={styles.docRevealPara2}><strong>{p.lead}</strong> {p.body}</p>
        ))}
      </div>
    </Page>
  );
};

// ─── Deck V3 (12 páginas) ──────────────────────────────────────────────────────
const V3Doc: FC<Props> = ({ realIndex, chartmetric, artistName, avatarSrc }) => {
  const ri = realIndex as any;
  const { profile } = realIndex;
  const cities = chartmetric?.top_cities;
  const playlists = chartmetric?.playlists;
  const similar = chartmetric?.similar;
  const inp = ri.inputs || {};
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  const hasCities = !!cities?.length;
  const hasPlatform = !!(playlists?.top?.length || similar?.length);
  const total = 10 + (hasCities ? 1 : 0) + (hasPlatform ? 1 : 0);
  let c = 1; // capa = 1 (sem número)
  const next = () => ++c;

  return (
    <div className={styles.docRoot}>
      {/* 1 — CAPA */}
      <div className={`${styles.docPage} ${styles.docCover}`} data-docpage>
        <div className={styles.docCoverBrand}><Wordmark /></div>
        <div className={styles.docCoverCenter}>
          <img className={styles.docCoverAvatar} src={avatarSrc} alt="" crossOrigin="anonymous" />
          <div className={styles.docCoverKicker}>Diagnóstico de carreira</div>
          <div className={styles.docCoverName}>{artistName}</div>
          <div className={styles.docCoverProfile}>Perfil <strong>{profile.name}</strong></div>
        </div>
        <div className={styles.docCoverFoot}>Índice REAL · metodologia Anita Carvalho · {today}</div>
      </div>

      {/* 2 — O PERFIL */}
      <Page n={next()} total={total} kicker="O seu perfil">
        <div className={styles.docProfileKicker}>Seu perfil de carreira</div>
        <div className={styles.docProfileName}>{profile.name}</div>
        <p className={styles.docProfileDesc}>{clean(profile.description)}</p>
        <div className={styles.docPattern}>
          {DIM_META.map((d) => (
            <div key={d.key} className={styles.docPatternItem}>
              <span className={styles.docPatternLetter} style={{ color: ri.pattern?.[d.key] ? '#af2896' : '#71717a' }}>{d.letter}</span>
              <span className={styles.docPatternWord}>{d.full}</span>
              <span className={styles.docPatternSub}>{d.sub}</span>
            </div>
          ))}
        </div>
        <div className={styles.docInsightsTitle}>O que o seu diagnóstico revela</div>
        <ul className={styles.docInsights}>
          {profile.insights.map((it, i) => <li key={i}>{clean(it)}</li>)}
        </ul>
      </Page>

      {/* 3–6 — DIMENSÕES */}
      {DIM_META.map((d) => <DocDimPage key={d.key} dk={d.key} n={next()} total={total} ri={ri} cm={chartmetric ?? null} />)}

      {/* AUDIÊNCIA & ALCANCE (cidades) — condicional */}
      {hasCities && (
        <Page n={next()} total={total} kicker="Audiência & alcance">
          <div className={styles.docSectionTitle}>Onde seus ouvintes estão</div>
          <div className={styles.docCities}>
            {cities!.slice(0, 5).map((ct) => {
              const max = cities![0].listeners || 1;
              const pct = Math.max(8, Math.round((ct.listeners / max) * 100));
              return (
                <div key={`${ct.name}-${ct.country}`} className={styles.docCityRow}>
                  <span className={styles.docCityName}>{ct.name}</span>
                  <div className={styles.docCityTrack}><div className={styles.docCityBar} style={{ width: `${pct}%` }} /></div>
                  <span className={styles.docCityVal}>{fmtNum(ct.listeners)}</span>
                </div>
              );
            })}
          </div>
          <p className={styles.docNote}>Compare onde te ouvem com onde você toca: as praças com ouvintes mas sem show são público presencial já aquecido.</p>
        </Page>
      )}

      {/* PLATAFORMAS (playlists + imprensa) — condicional a enriquecimento */}
      {hasPlatform && (
        <Page n={next()} total={total} kicker="Plataformas">
          <div className={styles.docSectionTitle}>Sua presença nas plataformas</div>
          {!!playlists?.top?.length && (
            <div style={{ marginBottom: 26 }}>
              <div className={styles.docSubTitle2} style={{ marginBottom: 12 }}>Playlists onde sua música está{playlists.count ? ` · ${playlists.count} no total` : ''}</div>
              {playlists.top.slice(0, 8).map((p, i) => (
                <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  {p.editorial && <span style={{ fontSize: 10, fontWeight: 800, color: '#af2896', letterSpacing: '0.06em' }}>EDITORIAL</span>}
                  <span style={{ color: '#fff', flex: 1, fontSize: 16, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  {p.followers != null && <span style={{ color: '#9a9aa3', fontSize: 14, fontWeight: 700 }}>{fmtNum(p.followers)}</span>}
                </div>
              ))}
            </div>
          )}
          <div>
            <div className={styles.docSubTitle2} style={{ marginBottom: 10 }}>Imprensa em detalhe</div>
            {inp.imprensaRepercussao ? (
              <>
                <p className={styles.docRevealPara2}><strong>Você já apareceu na imprensa.</strong> Esse tipo de cobertura é difícil de conseguir e pesa muito na legitimação: mostra que a sua história interessa além do nicho.</p>
                <p className={styles.docRevealPara2}>
                  {inp.imprensaFrequencia === 'perene'
                    ? <><strong>Sua presença na mídia é constante.</strong> Você aparece de forma perene, não só em lançamentos. Consistência é o que transforma imprensa em legitimação sustentada.</>
                    : <><strong>Sua imprensa ainda é pontual.</strong> Concentrada em lançamentos, ela vira legitimação sustentada quando ganha constância ao longo do ano.</>}
                </p>
              </>
            ) : (
              <p className={styles.docRevealPara2}><strong>A imprensa ainda não repercutiu o seu trabalho.</strong> Presença em veículos é um capital que abre portas que números sozinhos não abrem, e costuma vir com estratégia de posicionamento.</p>
            )}
          </div>
        </Page>
      )}

      {/* OS 16 PERFIS */}
      <Page n={next()} total={total} kicker="Os 16 perfis">
        <div className={styles.docSectionTitle}>Sua posição entre os 16 perfis</div>
        <p className={styles.docNote} style={{ margin: '0 0 16px' }}>Cada perfil é uma combinação das quatro dimensões. O seu está destacado.</p>
        <div className={styles.docMap2}>
          {PROFILE_MAP.map((row, i) => {
            const altas = 4 - i;
            return (
              <div key={row.tier} className={styles.docMap2Row}>
                <div className={styles.docMap2Tier}>
                  <RealBadge tier={tierForAltas(altas)} label={String(altas)} size={30} />
                  <span>{altas} {altas === 1 ? 'alta' : 'altas'}</span>
                </div>
                <div className={styles.docMap2Chips}>
                  {row.names.map((nm) => {
                    const bits = PROFILE_BITS[nm];
                    return (
                      <div key={nm} className={`${styles.docMap2Chip} ${nm === profile.name ? styles.docMap2ChipOn : ''}`}>
                        <span className={styles.docMap2Name}>{nm}</span>
                        <span className={styles.docMap2Dots}>
                          {(['r', 'e', 'a', 'l'] as const).map((k) => (
                            <span key={k} className={`${styles.docMap2Dot} ${bits?.[k] ? styles.docMap2DotOn : ''}`}>{k.toUpperCase()}</span>
                          ))}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
        <div className={styles.docTopTierNote}>
          <span className={styles.docTopTierSeal}>TOP</span>
          <div><strong>Top Tier.</strong> Quando uma dimensão atinge o nível de excelência (o topo absoluto da escala), ela ganha o selo Top Tier no seu diagnóstico. Vale para qualquer perfil e qualquer das quatro dimensões.</div>
        </div>
      </Page>

      {/* METODOLOGIA */}
      <Page n={next()} total={total} kicker="Metodologia">
        <div className={styles.docSectionTitle}>{METODOLOGIA.title}</div>
        {METODOLOGIA.intro.map((p, i) => <p key={i} className={styles.docMethodIntro}>{p}</p>)}
        <div className={styles.docMethodGrid}>
          {METODOLOGIA.dims.map((m) => (
            <div key={m.l} className={styles.docMethodCard}>
              <span className={styles.docMethodLetter}>{m.l}</span>
              <div className={styles.docMethodName}>{m.t}</div>
              <div className={styles.docMethodDesc}>{m.d}</div>
            </div>
          ))}
        </div>
        <p className={styles.docNote}>{METODOLOGIA.outro}</p>
      </Page>

      {/* QUEM ASSINA */}
      <Page n={next()} total={total} kicker="Quem assina">
        <div className={styles.docSignName}>{QUEM_ASSINA.name}</div>
        <div className={styles.docSignRole}>{QUEM_ASSINA.role}</div>
        {QUEM_ASSINA.paras.map((p, i) => <p key={i} className={styles.docSignPara}>{p}</p>)}
        <p className={styles.docSignHighlight}>{QUEM_ASSINA.highlight}</p>
      </Page>

      {/* O PRÓXIMO PASSO (CTA) */}
      <div className={`${styles.docPage} ${styles.docCta}`} data-docpage>
        <div className={styles.docCoverBrand}><Wordmark /></div>
        <div className={styles.docCtaCenter}>
          <div className={styles.docCtaKicker}>O próximo passo</div>
          <div className={styles.docCtaTitle}>Você sabe onde está. Agora, para onde ir.</div>
          <p className={styles.docCtaText}>
            O diagnóstico é o retrato da sua carreira hoje. O planejamento completo com a Nyta transforma esse retrato em um plano de ação real: objetivos, estratégias priorizadas, cronograma e modelagem financeira, construídos com a metodologia que já orientou centenas de artistas.
          </p>
          <div className={styles.docCtaButton}>Comece seu planejamento com a Nyta</div>
        </div>
        <div className={styles.docCoverFoot}>maestramanager.com</div>
      </div>
    </div>
  );
};

// ─── Deck legado (v1/v2) — mantém o layout anterior ────────────────────────────
const LegacyDoc: FC<Props> = ({ realIndex, chartmetric, artistName, avatarSrc }) => {
  const riAny = realIndex as any;
  const isV2 = riAny.version === 2;
  const { profile, pattern } = realIndex;
  const earningsUnknown: boolean = isV2 ? false : riAny.earningsUnknown;
  const inputs = isV2 ? v2InputsView(riAny.inputs) : riAny.inputs;
  const cities = chartmetric?.top_cities;
  const countries = chartmetric?.audience?.top_countries;
  const playlists = chartmetric?.playlists;
  const similar = chartmetric?.similar;
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  const hasPlatform = !!(playlists?.top?.length || countries?.length || similar?.length);
  const TOTAL = hasPlatform ? 8 : 7;

  const dimData: Record<string, { label: string; value: string }[]> = {
    r: [
      { label: 'Ouvintes mensais', value: chartmetric?.monthly_listeners != null ? fmtNum(chartmetric.monthly_listeners) : (inputs.monthly_listeners != null ? fmtNum(inputs.monthly_listeners) : '–') },
      ...(inputs.social?.instagram != null ? [{ label: 'Instagram', value: fmtNum(inputs.social.instagram) }] : []),
      ...(inputs.social?.tiktok != null ? [{ label: 'TikTok', value: fmtNum(inputs.social.tiktok) }] : []),
      ...(inputs.social?.youtube != null ? [{ label: 'YouTube', value: fmtNum(inputs.social.youtube) }] : []),
    ],
    e: [{ label: 'Faturamento mensal', value: earningsUnknown ? 'Não informado' : inputs.faturamento }],
    a: [
      { label: isV2 ? 'Shows por mês' : 'Shows pagos (12m)', value: inputs.shows_pagos },
      { label: isV2 ? 'Público médio/show' : 'Maior público', value: inputs.maior_publico },
      { label: 'Seguidores Spotify', value: inputs.sp_followers != null ? fmtNum(inputs.sp_followers) : '–' },
    ],
    l: [
      { label: 'Prêmios', value: inputs.premios },
      { label: 'Imprensa', value: inputs.imprensa },
    ],
  };

  return (
    <div className={styles.docRoot}>
      <div className={`${styles.docPage} ${styles.docCover}`} data-docpage>
        <div className={styles.docCoverBrand}><Wordmark /></div>
        <div className={styles.docCoverCenter}>
          <img className={styles.docCoverAvatar} src={avatarSrc} alt="" crossOrigin="anonymous" />
          <div className={styles.docCoverKicker}>Diagnóstico de carreira</div>
          <div className={styles.docCoverName}>{artistName}</div>
          <div className={styles.docCoverProfile}>Perfil <strong>{profile.name}</strong></div>
        </div>
        <div className={styles.docCoverFoot}>Índice REAL · metodologia Anita Carvalho · {today}</div>
      </div>

      <Page n={2} total={TOTAL} kicker="O seu perfil">
        <div className={styles.docProfileKicker}>Seu perfil de carreira</div>
        <div className={styles.docProfileName}>{profile.name}</div>
        <p className={styles.docProfileDesc}>{clean(profile.description)}</p>
        <div className={styles.docPattern}>
          {DIM_META.map((d) => (
            <div key={d.key} className={styles.docPatternItem}>
              <span className={styles.docPatternLetter} style={{ color: pattern[d.key] ? '#af2896' : '#71717a' }}>{d.letter}</span>
              <span className={styles.docPatternWord}>{d.full}</span>
            </div>
          ))}
        </div>
        <div className={styles.docInsightsTitle}>O que o seu diagnóstico revela</div>
        <ul className={styles.docInsights}>
          {profile.insights.map((it, i) => <li key={i}>{clean(it)}</li>)}
        </ul>
      </Page>

      <Page n={3} total={TOTAL} kicker="As 4 dimensões">
        <div className={styles.docSectionTitle}>As quatro dimensões da sua carreira</div>
        <div className={styles.docDimGrid}>
          {DIM_META.map((d) => {
            const high = pattern[d.key];
            const neutral = d.key === 'e' && earningsUnknown;
            const color = neutral ? '#8a8a92' : high ? '#af2896' : '#e0a13c';
            return (
              <div key={d.key} className={styles.docDimCard}>
                <div className={styles.docDimHead}>
                  <span className={styles.docDimMono}>{d.letter}</span>
                  <div>
                    <div className={styles.docDimName}>{d.full}</div>
                    <div className={styles.docDimSub}>{d.sub}</div>
                  </div>
                  <span className={styles.docDimStatus} style={{ color }}>{neutral ? 'Não inf.' : high ? 'Alto' : 'Baixo'}</span>
                </div>
                <div className={styles.docDimStats}>
                  {dimData[d.key].map((l) => (
                    <div key={l.label} className={styles.docDimRow}><span>{l.label}</span><strong>{l.value}</strong></div>
                  ))}
                </div>
                <p className={styles.docDimPhrase} style={{ borderColor: color }}>
                  {neutral ? 'Faturamento não informado: consideramos Earnings como baixo no cálculo.' : high ? DIM_PHRASE[d.key].high : DIM_PHRASE[d.key].low}
                </p>
              </div>
            );
          })}
        </div>
      </Page>

      <Page n={4} total={TOTAL} kicker="Audiência & alcance">
        <div className={styles.docSectionTitle}>Onde seus ouvintes estão</div>
        {!!cities?.length ? (
          <div className={styles.docCities}>
            {cities.slice(0, 5).map((ct) => {
              const max = cities[0].listeners || 1;
              const pct = Math.max(8, Math.round((ct.listeners / max) * 100));
              return (
                <div key={`${ct.name}-${ct.country}`} className={styles.docCityRow}>
                  <span className={styles.docCityName}>{ct.name}</span>
                  <div className={styles.docCityTrack}><div className={styles.docCityBar} style={{ width: `${pct}%` }} /></div>
                  <span className={styles.docCityVal}>{fmtNum(ct.listeners)}</span>
                </div>
              );
            })}
          </div>
        ) : <p className={styles.docProfileDesc}>Dados de audiência indisponíveis.</p>}
        <p className={styles.docNote}>Os dados de plataforma são lidos diretamente do seu Spotify e das suas redes sociais.</p>
      </Page>

      <Page n={5} total={TOTAL} kicker="Os 16 perfis">
        <div className={styles.docSectionTitle}>Sua posição entre os 16 perfis</div>
        <div className={styles.docMap}>
          {PROFILE_MAP.map((row) => (
            <div key={row.tier} className={styles.docMapRow}>
              <span className={styles.docMapTier}>{row.tier}</span>
              <div className={styles.docMapChips}>
                {row.names.map((nm) => (
                  <span key={nm} className={`${styles.docMapChip} ${nm === profile.name ? styles.docMapChipOn : ''}`}>{nm}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className={styles.docNote}>Do Beginner (começo da jornada) ao Icon (as quatro frentes altas). Cada perfil tem sua própria leitura estratégica.</p>
      </Page>

      <Page n={6} total={TOTAL} kicker="Metodologia">
        <div className={styles.docSectionTitle}>Como calculamos o seu diagnóstico</div>
        <p className={styles.docMethodIntro}>
          O Índice REAL foi criado por Anita Carvalho a partir de mais de 30 anos de gestão de carreiras musicais e da análise de 313 planejamentos estratégicos reais. Ele cruza dados de plataforma (Spotify e redes) com o que você nos contou sobre shows, faturamento e reconhecimento, e classifica a carreira em 1 de 16 perfis.
        </p>
        <div className={styles.docMethodGrid}>
          {METODOLOGIA.dims.map((m) => (
            <div key={m.l} className={styles.docMethodCard}>
              <span className={styles.docMethodLetter}>{m.l}</span>
              <div className={styles.docMethodName}>{m.t}</div>
              <div className={styles.docMethodDesc}>{m.d}</div>
            </div>
          ))}
        </div>
        <p className={styles.docNote}>
          Cada indicador vira uma pontuação calibrada e cada dimensão é classificada em alta ou baixa. O padrão das quatro letras (R·E·A·L) define o seu perfil entre os 16 possíveis.
        </p>
      </Page>

      {hasPlatform && (
        <Page n={7} total={TOTAL} kicker="Plataformas">
          <div className={styles.docSectionTitle}>Sua presença nas plataformas</div>
          {!!playlists?.top?.length && (
            <div style={{ marginBottom: 28 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#cfcfd4', marginBottom: 14 }}>
                Playlists onde sua música está{playlists.count ? ` · ${playlists.count} no total` : ''}
              </div>
              {playlists.top.slice(0, 10).map((p, i) => (
                <div key={`${p.name}-${i}`} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '8px 0', borderTop: i ? '1px solid rgba(255,255,255,0.06)' : 'none' }}>
                  <span style={{ color: '#6f6f78', width: 24, textAlign: 'right', fontSize: 16, fontWeight: 700 }}>{i + 1}</span>
                  <span style={{ color: '#fff', flex: 1, fontSize: 17, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</span>
                  {p.editorial && <span style={{ fontSize: 12, fontWeight: 800, color: '#af2896', letterSpacing: '0.04em' }}>EDITORIAL</span>}
                  {p.followers != null && <span style={{ color: '#9a9aa3', fontSize: 15, fontWeight: 700, minWidth: 70, textAlign: 'right' }}>{fmtNum(p.followers)}</span>}
                </div>
              ))}
            </div>
          )}
          {!!similar?.length && (
            <div>
              <div style={{ fontSize: 17, fontWeight: 800, color: '#cfcfd4', marginBottom: 14 }}>Artistas de referência</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {similar.filter((a) => a.name?.toLowerCase() !== (artistName || '').toLowerCase()).slice(0, 12).map((a) => (
                  <span key={a.name} style={{ fontSize: 16, fontWeight: 700, color: '#e0e0e0', padding: '8px 18px', borderRadius: 9999, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.07)' }}>{a.name}</span>
                ))}
              </div>
            </div>
          )}
          <p className={styles.docNote}>Playlists e referências lidas do seu perfil no Chartmetric.</p>
        </Page>
      )}

      <div className={`${styles.docPage} ${styles.docCta}`} data-docpage>
        <div className={styles.docCoverBrand}><Wordmark /></div>
        <div className={styles.docCtaCenter}>
          <div className={styles.docCtaKicker}>O próximo passo</div>
          <div className={styles.docCtaTitle}>Você sabe onde está. Agora, para onde ir.</div>
          <p className={styles.docCtaText}>
            O diagnóstico é o retrato da sua carreira hoje. O planejamento completo com a Nyta transforma esse retrato em um plano de ação real: objetivos, estratégias priorizadas, cronograma e modelagem financeira, construídos com a metodologia que já orientou centenas de artistas.
          </p>
          <div className={styles.docCtaButton}>Comece seu planejamento com a Nyta</div>
        </div>
        <div className={styles.docCoverFoot}>maestramanager.com</div>
      </div>
    </div>
  );
};

// Documento de apresentação (deck multipágina) do diagnóstico REAL — capturado em PDF.
// V3 usa o deck detalhado (páginas por dimensão + narrativa); v1/v2 caem no layout legado.
export const DiagnosticDoc: FC<Props> = (props) => {
  const isV3 = (props.realIndex as any).version === 3;
  return isV3 ? <V3Doc {...props} /> : <LegacyDoc {...props} />;
};

export default DiagnosticDoc;
