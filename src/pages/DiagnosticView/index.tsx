import { FC, useEffect, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Spin } from 'antd';

import { useAppDispatch, useAppSelector } from '../../store/store';
import { artistsActions } from '../../store/slices/artists';
import { useEntitlements } from '../../hooks/useEntitlements';
import type { RealIndex } from '../../interfaces/maestra';
import { RealBadge, tierForAltas } from '../../components/RealBadge';
import { PROFILE_BITS, PROFILE_MAP } from '../ArtistCreate/realCopy';
import { dimNarrative } from '../ArtistCreate/realNarrative';

const PROFILE_ORDER = PROFILE_MAP.flatMap((row) => row.names).reverse();
const DIMENSIONS = [
  { letter: 'R', key: 'r', title: 'Reach', label: 'Alcance', metricLabel: 'ouvintes mensais', short: 'Alcance digital ainda em construção.', details: ['Ouvintes Spotify', 'Seguidores Spotify'] },
  { letter: 'E', key: 'e', title: 'Earnings', label: 'Receita', metricLabel: 'receita mapeada', short: 'A receita da música ainda está em construção.', details: ['Receita total', 'Shows / mês'] },
  { letter: 'A', key: 'a', title: 'Audience', label: 'Público real', metricLabel: 'seguidores Spotify', short: 'A audiência real ainda está sendo formada.', details: ['Seguidores Spotify', 'Shows / mês'] },
  { letter: 'L', key: 'l', title: 'Legitimacy', label: 'Legitimação', metricLabel: 'reconhecimento mapeado', short: 'A legitimação ainda está em construção.', details: ['Prêmios', 'Imprensa'] },
] as const;

const number = (value: unknown) => typeof value === 'number' ? value.toLocaleString('pt-BR') : '—';
const scoreOf = (realIndex: RealIndex, key: keyof RealIndex['pattern']) => {
  const boletim = realIndex.boletim?.[key];
  const legacy = realIndex.dimensions?.[key];
  return typeof boletim === 'number' ? Math.round(boletim) : typeof legacy === 'number' ? Math.round(legacy) : realIndex.pattern[key] ? 70 : 0;
};

const DiagnosticScore: FC<{ score: number }> = ({ score }) => (
  <div className='diagnostic-score'><div><span style={{ width: `${score}%` }} /></div><b>{score}/100</b></div>
);

const DiagnosticView: FC = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { id } = useParams();
  const user = useAppSelector((s) => s.auth.user);
  const artist = useAppSelector((s) => s.artists.items.find((a) => a.id === id));
  const loaded = useAppSelector((s) => s.artists.loaded);
  const { isPro } = useEntitlements();

  useEffect(() => {
    if (!loaded && user?.id) dispatch(artistsActions.fetchArtists(user.id));
  }, [loaded, user?.id, dispatch]);

  useEffect(() => {
    const previousTitle = document.title;
    document.title = 'Diagnóstico REAL · Maestra';
    return () => { document.title = previousTitle; };
  }, []);

  const realIndex = artist?.content?.realIndex;
  const chartmetric = artist?.content?.chartmetricProfile as any;
  const dimensions = useMemo(() => {
    if (!realIndex) return [];
    const inputs = realIndex.inputs as any;
    const scores = DIMENSIONS.map((dimension) => {
      const score = scoreOf(realIndex, dimension.key);
      const high = realIndex.pattern[dimension.key];
      const top = !!realIndex.dimTopIcon?.[dimension.key];
      return {
        ...dimension,
        score,
        status: top ? 'Top Tier' : high ? 'Alto' : 'Baixo',
        statusText: top ? 'Top Tier · nível de excelência desta dimensão' : high ? `Aceso · faltam ${Math.max(0, 100 - score)} pts para Top Tier` : `Faltam ${Math.max(0, 70 - score)} pts para acender · ${Math.max(0, 100 - score)} pts para Top Tier`,
        narrative: dimNarrative(dimension.key, realIndex),
      };
    });
    const values: Record<string, string> = {
      'Ouvintes Spotify': number(chartmetric?.monthly_listeners ?? inputs?.monthly_listeners ?? inputs?.spotifyListeners),
      Instagram: number(inputs?.igFollowers ?? inputs?.instagramFollowers),
      TikTok: number(inputs?.tiktokFollowers),
      'YouTube mensal': number(inputs?.youtubeMonthlyViews),
      'Seguidores Spotify': number(inputs?.sp_followers ?? inputs?.spotifyFollowers),
      'Receita mensal': realIndex.revenue?.total != null ? `R$ ${number(realIndex.revenue.total)}` : '—',
      'Shows / mês': number(inputs?.shows_pagos ?? inputs?.showsPerMonth),
      'Cachê médio': inputs?.cache != null ? `R$ ${number(inputs.cache)}` : '—',
      '% público pagante': inputs?.fazBilheteria ? (inputs?.pagantePct || '—') : 'Não faz bilheteria',
      'Fãs Deezer': number(inputs?.deezerFans),
      'Prêmios': ['Nenhum', 'Local / regional', 'Indicação nacional', 'Prêmio nacional', 'Indicação internacional', 'Prêmio internacional'][Number(inputs?.premios)] || '—',
      'Imprensa': inputs?.imprensaRepercussao ? (inputs?.imprensaFrequencia === 'perene' ? 'Perene' : 'Em lançamentos') : 'Não',
      'Playlists editoriais': number(inputs?.editorialPlaylists ?? chartmetric?.playlists?.count),
      'Execução em rádio': Number(inputs?.radioAirplay) > 0 ? 'Sim' : 'Não',
    };
    return scores.map((dimension) => ({
      ...dimension,
      metric: dimension.key === 'r' ? values['Ouvintes Spotify'] : dimension.key === 'e' ? values['Receita mensal'] : dimension.key === 'a' ? values['Shows / mês'] : values.Imprensa,
      detailValues: dimension.key === 'r'
        ? ['Ouvintes Spotify', 'Instagram', 'TikTok', 'YouTube mensal'].map((label) => [label, values[label] || '—'])
        : dimension.key === 'e'
          ? ['Receita mensal', 'Shows / mês', 'Cachê médio'].map((label) => [label, values[label] || '—'])
          : dimension.key === 'a'
            ? ['Shows / mês', '% público pagante', 'Seguidores Spotify', 'Fãs Deezer'].map((label) => [label, values[label] || '—'])
            : ['Prêmios', 'Imprensa', 'Playlists editoriais', 'Execução em rádio'].map((label) => [label, values[label] || '—']),
      insights: realIndex.profile.insights.slice(0, 3),
    }));
  }, [chartmetric, realIndex]);

  if (!loaded) return <div style={{ padding: 24 }}><div className='analyzing'><Spin /> Carregando…</div></div>;
  if (!artist || !realIndex) return <div className='board-content page-view workspace-view diagnostic-page'><section className='diagnostic-panel'><h2>Diagnóstico REAL</h2><p>Este perfil ainda não tem um diagnóstico REAL salvo.</p></section></div>;

  const currentIndex = Math.max(0, PROFILE_ORDER.indexOf(realIndex.profile.name));
  const nextProfile = PROFILE_ORDER[Math.min(currentIndex + 1, PROFILE_ORDER.length - 1)];
  const totalScore = dimensions.reduce((sum, dimension) => sum + dimension.score, 0);
  const critical = dimensions.reduce((lowest, dimension) => dimension.score < lowest.score ? dimension : lowest, dimensions[0]);
  const cities = (chartmetric?.top_cities || []).slice(0, 5) as { name: string; listeners: number }[];
  const similar = ((chartmetric?.similar || []) as { name: string }[]).slice(0, 8);

  return (
    <div className='board-content page-view workspace-view diagnostic-page'>
      <header className='module-page-heading'>
        <div><p>ONDE VOCÊ ESTÁ</p><h1>Diagnóstico Real</h1><span>Sua fase de carreira atual, com base nos seus dados reais.</span></div>
        <button type='button' onClick={() => isPro ? navigate(`/artists/${id}/diagnostico/refazer`) : navigate('/assinatura')}>{isPro ? 'Refazer diagnóstico' : 'Refazer diagnóstico'}</button>
      </header>

      <section className='diagnostic-hero-card'>
        <div>
          <p>Seu perfil de carreira</p>
          <h2>{realIndex.profile.name}</h2>
          <span>{realIndex.profile.description}</span>
          <div className='diagnostic-snapshot' aria-label='Resumo do diagnóstico REAL'>
            <strong><small>Índice REAL</small>{totalScore}/400</strong>
            <strong><small>Próximo perfil</small>{nextProfile}</strong>
            <strong><small>Frente crítica</small>{critical.label}</strong>
            <strong><small>Ação recomendada</small>Crescer descoberta</strong>
          </div>
          <div className='diagnostic-real-index' aria-label='Índice REAL'>
            {dimensions.map((dimension) => <b key={dimension.letter}><i>{dimension.letter}</i>{dimension.title}</b>)}
          </div>
        </div>
      </section>

      <section className='diagnostic-refresh-card'><span>↻ Executou o plano e cresceu? <b>Refaça o REAL</b> para ver sua fase subir.</span><button type='button' onClick={() => isPro ? navigate(`/artists/${id}/diagnostico/refazer`) : navigate('/assinatura')}>Refazer diagnóstico</button></section>

      <section className='diagnostic-dimensions' aria-label='Dimensões REAL'>
        {dimensions.map((dimension) => (
          <article className='diagnostic-dimension-card' key={dimension.letter}>
            <header><i>{dimension.letter}</i><div><p>{dimension.title}</p><h2>{dimension.label}</h2></div><em>{dimension.status}</em></header>
            <DiagnosticScore score={dimension.score} />
            <p className='diagnostic-gap'>{dimension.statusText}</p>
            <div className='diagnostic-dimension-metric'><strong>{dimension.metric}</strong><span>{dimension.metricLabel}</span></div>
            <div className='diagnostic-detail-list'>{dimension.detailValues.map(([label, value]) => <span key={label}><b>{label}</b><strong>{value}</strong></span>)}</div>
            <div className='diagnostic-reveal-block'>
              <b>O que isso revela</b>
              <strong>{dimension.narrative.headline}</strong>
              {dimension.narrative.paras[0] && <p><b>{dimension.narrative.paras[0].lead}</b> {dimension.narrative.paras[0].body}</p>}
            </div>
            <ul>{dimension.narrative.paras.slice(1).map((paragraph) => <li key={paragraph.lead}><b>{paragraph.lead}</b> {paragraph.body}</li>)}</ul>
          </article>
        ))}
      </section>

      <section className='diagnostic-grid'>
        <article className='diagnostic-panel diagnostic-cities'><header><p>Onde seus ouvintes estão</p></header><div>{cities.map((city, index) => <span key={city.name}><b>{city.name}</b><i style={{ width: `${Math.max(18, 100 - index * 17)}%` }} /><strong>{number(city.listeners)}</strong></span>)}</div></article>
        <article className='diagnostic-panel diagnostic-next'><header><p>Sua presença nas plataformas</p><h2>Principais sinais de referência</h2></header><div className='diagnostic-platform-row'><span>Spotify</span><i /><strong>{number(chartmetric?.monthly_listeners)}</strong></div><h3>Artistas de referência</h3><div className='diagnostic-artist-tags'>{similar.map((item) => <span key={item.name}>{item.name}</span>)}</div></article>
      </section>

      <section className='diagnostic-profile-map' aria-label='Mapa de perfis'>
        <header><p>Sua posição entre os 16 perfis</p></header>
        <div className='diagnostic-profile-ladder'>
          {PROFILE_MAP.map((row) => (
            <div className='diagnostic-profile-row' key={row.tier}>
              <RealBadge tier={tierForAltas(Number(row.tier[0]))} label={row.tier[0]} size={34} />
              <b>{row.tier}</b>
              <div>
                {row.names.map((profile) => {
                  const bits = PROFILE_BITS[profile];
                  return (
                    <span className={profile === realIndex.profile.name ? 'active' : ''} key={profile}>
                      <strong>{profile}</strong>
                      <small>{(['r', 'e', 'a', 'l'] as const).map((key) => <i className={bits?.[key] ? 'on' : ''} key={key}>{key.toUpperCase()}</i>)}</small>
                    </span>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className='diagnostic-reveal'><header><p>O que o seu diagnóstico revela</p></header><div>{realIndex.profile.insights.map((note) => <p key={note}>› {note}</p>)}</div></section>
      <section className='diagnostic-method'><header><p>Como nasce o seu diagnóstico</p><span>O Índice REAL cruza dados de alcance, receita, público real e legitimação para mostrar onde a carreira está hoje e o que precisa crescer.</span></header><div>{dimensions.map((dimension) => <article key={dimension.title}><strong>{dimension.letter}</strong><span>{dimension.title} · {dimension.label}</span><p>{dimension.short}</p></article>)}</div></section>
    </div>
  );
};

export default DiagnosticView;
