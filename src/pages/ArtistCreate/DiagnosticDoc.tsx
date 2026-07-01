import { FC, ReactNode } from 'react';

import { ReactComponent as MaestraLogo } from '../../assets/maestra-logo.svg';
import type { RealIndex } from '../../interfaces/maestra';
import { v2InputsView, type Chartmetric } from './DiagnosticReport';
import { DIM_META, DIM_PHRASE, PROFILE_MAP, clean, fmtNum, fmtBRL, PREMIOS_LABELS_V3, PAGANTE_LABELS, FREQ_LABELS } from './realCopy';
import styles from './ArtistCreate.module.scss';

interface Props {
  realIndex: RealIndex;
  chartmetric?: Chartmetric | null;
  artistName: string;
  avatarSrc: string;
}

// IMPORTANTE: definida no escopo de módulo (não dentro de DiagnosticDoc). Se ficar dentro do
// componente, vira uma função nova a cada render — React desmonta/remonta todas as páginas e, no
// loop async de captura do PDF, elas ficam 0×0 e saem em branco/minúsculas. `total` vem por prop.
const Page: FC<{ n: number; total: number; kicker?: string; children: ReactNode }> = ({ n, total, kicker, children }) => (
  <div className={styles.docPage} data-docpage>
    <div className={styles.docHeader}>
      <span className={styles.docBrand}><MaestraLogo className={styles.docBrandLogo} /> Maestra Manager</span>
      {kicker && <span className={styles.docHeaderLabel}>{kicker}</span>}
    </div>
    <div className={styles.docBody}>{children}</div>
    <div className={styles.docFooter}><span>maestramanager.com</span><span>{n} / {total}</span></div>
  </div>
);

// Documento de apresentação (deck multipágina) do diagnóstico REAL — capturado em PDF.
export const DiagnosticDoc: FC<Props> = ({ realIndex, chartmetric, artistName, avatarSrc }) => {
  const riAny = realIndex as any;
  const isV2 = riAny.version === 2;
  const isV3 = riAny.version === 3;
  const { profile, pattern } = realIndex;
  const earningsUnknown: boolean = (isV2 || isV3) ? false : riAny.earningsUnknown;
  const inputs = isV2 ? v2InputsView(riAny.inputs) : riAny.inputs;
  const v3 = isV3 ? (riAny.inputs || {}) : {};
  const v3rev = isV3 ? (riAny.revenue || {}) : {};
  const cities = chartmetric?.top_cities;
  const countries = chartmetric?.audience?.top_countries;
  const playlists = chartmetric?.playlists;
  const similar = chartmetric?.similar;
  const today = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

  // Página de plataformas só entra quando há dado enriquecido (pós-pago). Numeração dinâmica.
  const hasPlatform = !!(playlists?.top?.length || countries?.length || similar?.length);
  const TOTAL = hasPlatform ? 8 : 7;

  const dimData: Record<string, { label: string; value: string }[]> = isV3 ? {
    r: [
      { label: 'Ouvintes mensais', value: chartmetric?.monthly_listeners != null ? fmtNum(chartmetric.monthly_listeners) : (v3.spotifyListeners != null ? fmtNum(v3.spotifyListeners) : '–') },
      ...(v3.igFollowers != null ? [{ label: 'Instagram', value: fmtNum(v3.igFollowers) }] : []),
      ...(v3.tiktokFollowers != null ? [{ label: 'TikTok', value: fmtNum(v3.tiktokFollowers) }] : []),
      ...(v3.youtubeMonthlyViews != null ? [{ label: 'YouTube mensal', value: fmtNum(v3.youtubeMonthlyViews) }] : []),
    ],
    e: (() => {
      const fat = Math.round(Number(v3rev.total ?? 0) * 12);
      const inv = Math.round(Number(v3.investimento ?? 0));
      const saldo = fat - inv;
      const money = (n: number) => `R$ ${fmtNum(Math.abs(n))}`;
      return [
        { label: 'Receita mensal', value: fmtBRL(Number(v3rev.total ?? 0)) },
        { label: 'Shows por mês', value: String(v3.showsPerMonth ?? 0) },
        { label: 'Cachê médio', value: fmtBRL(Number(v3.cache ?? 0)) },
        { label: 'Faturamento (12m)', value: money(fat) },
        { label: 'Investimento (12m)', value: money(inv) },
        { label: 'Saldo (12m)', value: `${saldo >= 0 ? '+' : '−'}${money(saldo)}` },
      ];
    })(),
    a: [
      { label: 'Shows por mês', value: String(v3.showsPerMonth ?? 0) },
      { label: '% público pagante', value: v3.fazBilheteria ? (PAGANTE_LABELS[v3.pagantePct] ?? '–') : 'Não faz bilheteria' },
      { label: 'Seguidores Spotify', value: v3.spotifyFollowers != null ? fmtNum(v3.spotifyFollowers) : '–' },
    ],
    l: [
      { label: 'Prêmios', value: PREMIOS_LABELS_V3[Number(v3.premios ?? 0)] ?? '–' },
      { label: 'Imprensa', value: v3.imprensaRepercussao ? (FREQ_LABELS[v3.imprensaFrequencia] ?? 'Sim') : 'Não' },
    ],
  } : {
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
      {/* 1 — CAPA */}
      <div className={`${styles.docPage} ${styles.docCover}`} data-docpage>
        <div className={styles.docCoverBrand}><MaestraLogo className={styles.docBrandLogo} /> Maestra Manager</div>
        <div className={styles.docCoverCenter}>
          <img className={styles.docCoverAvatar} src={avatarSrc} alt="" crossOrigin="anonymous" />
          <div className={styles.docCoverKicker}>Diagnóstico de carreira</div>
          <div className={styles.docCoverName}>{artistName}</div>
          <div className={styles.docCoverProfile}>Perfil <strong>{profile.name}</strong></div>
        </div>
        <div className={styles.docCoverFoot}>Índice REAL · metodologia Anita Carvalho · {today}</div>
      </div>

      {/* 2 — O PERFIL */}
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

      {/* 3 — AS 4 DIMENSÕES */}
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

      {/* 4 — AUDIÊNCIA */}
      <Page n={4} total={TOTAL} kicker="Audiência & alcance">
        <div className={styles.docSectionTitle}>Onde seus ouvintes estão</div>
        {!!cities?.length ? (
          <div className={styles.docCities}>
            {cities.slice(0, 5).map((c) => {
              const max = cities[0].listeners || 1;
              const pct = Math.max(8, Math.round((c.listeners / max) * 100));
              return (
                <div key={`${c.name}-${c.country}`} className={styles.docCityRow}>
                  <span className={styles.docCityName}>{c.name}</span>
                  <div className={styles.docCityTrack}><div className={styles.docCityBar} style={{ width: `${pct}%` }} /></div>
                  <span className={styles.docCityVal}>{fmtNum(c.listeners)}</span>
                </div>
              );
            })}
          </div>
        ) : <p className={styles.docProfileDesc}>Dados de audiência indisponíveis.</p>}
        {!!countries?.length && (
          <>
            <div className={styles.docSectionTitle} style={{ marginTop: 18 }}>Principais países</div>
            <div className={styles.docCities}>
              {countries.slice(0, 5).map((c) => {
                const max = countries[0].listeners || 1;
                const pct = Math.max(8, Math.round(((c.listeners || 0) / max) * 100));
                return (
                  <div key={c.name} className={styles.docCityRow}>
                    <span className={styles.docCityName}>{c.name}</span>
                    <div className={styles.docCityTrack}><div className={styles.docCityBar} style={{ width: `${pct}%` }} /></div>
                    <span className={styles.docCityVal}>{c.listeners != null ? fmtNum(c.listeners) : '–'}</span>
                  </div>
                );
              })}
            </div>
          </>
        )}
        <p className={styles.docNote}>Os dados de plataforma são lidos diretamente do seu Spotify e das suas redes sociais.</p>
      </Page>

      {/* 5 — MAPA DOS 16 PERFIS */}
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

      {/* 6 — COMO CALCULAMOS */}
      <Page n={6} total={TOTAL} kicker="Metodologia">
        <div className={styles.docSectionTitle}>Como calculamos o seu diagnóstico</div>
        <p className={styles.docMethodIntro}>
          O Índice REAL foi criado por Anita Carvalho a partir de mais de 30 anos de gestão de carreiras musicais e da análise de 313 planejamentos estratégicos reais. Ele cruza dados de plataforma (Spotify e redes) com o que você nos contou sobre shows, faturamento e reconhecimento, e classifica a carreira em 1 de 16 perfis.
        </p>
        <div className={styles.docMethodGrid}>
          {[
            { l: 'R', t: 'Reach · Alcance', d: 'Quanta gente é alcançada: ouvintes no Spotify e seguidores nas redes.' },
            { l: 'E', t: 'Earnings · Receita', d: 'Quanto a carreira fatura por mês com música (autorrelato).' },
            { l: 'A', t: 'Audience · Público real', d: 'Público comprometido: shows, tamanho de plateia e seguidores.' },
            { l: 'L', t: 'Legitimacy · Legitimação', d: 'Validação externa: prêmios e presença na imprensa.' },
          ].map((m) => (
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

      {/* 7 — PLATAFORMAS (só quando há enriquecimento Chartmetric) */}
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

      {/* 8 — CTA */}
      <div className={`${styles.docPage} ${styles.docCta}`} data-docpage>
        <div className={styles.docCoverBrand}><MaestraLogo className={styles.docBrandLogo} /> Maestra Manager</div>
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

export default DiagnosticDoc;
