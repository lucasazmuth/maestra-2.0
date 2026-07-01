// Verificação do deck V3: narrativa determinística + presença/ordem das 12 páginas do PDF.
// Renderiza o DiagnosticDoc (V3) com um realIndex mockado (perfil Spotlight) e confere as seções.
import { renderToStaticMarkup } from 'react-dom/server';
import { dimNarrative } from './realNarrative';

// RealBadge renderiza SVGs com <use>/gradientes que o mock de SVG do jest não representa bem
// (não é bug de runtime — no browser funciona). Mockamos só para a verificação estrutural do deck.
jest.mock('../../assets/maestra-logo.svg', () => ({ __esModule: true, default: 'logo.svg', ReactComponent: () => null }));
jest.mock('../../components/RealBadge', () => ({
  RealBadge: () => null,
  tierForAltas: () => 'standard',
  altasForPattern: () => 0,
  tierForPattern: () => 'standard',
  TIER_ACCENT: { base: '', standard: '', advance: '', pro: '', premium: '' },
  PROFILE_ABBR: {},
}));

// eslint-disable-next-line import/first
import DiagnosticDoc from './DiagnosticDoc';

const ri: any = {
  version: 3,
  profile: { key: '1101', name: 'Spotlight', description: 'Fatura, tem audiência digital e é reconhecida.', insights: ['Insight um.', 'Insight dois.'] },
  pattern: { r: true, e: true, a: false, l: true },
  dimTopIcon: { r: false, e: false, a: false, l: true },
  boletim: { r: 78, e: 81, a: 52, l: 94 },
  cutLine: { r: 70, e: 70, a: 70, l: 70 },
  topIcon: false,
  components: {
    r: [
      { key: 'listeners', label: '', z: 1.4, high: true, topicon: false, absent: false },
      { key: 'socialFollowers', label: '', z: 0.3, high: false, topicon: false, absent: false },
      { key: 'videoViews', label: '', z: 1.1, high: true, topicon: false, absent: false },
    ],
  },
  revenue: { shows: 5000, foraShows: 21000, total: 26000, sources: { direitos: 12000, streaming: 9000 } },
  engagement: { instagram: { value: 3.1, cut: 2.5, above: true }, tiktok: { value: 4.2, cut: 5, above: false }, youtube: { value: 1.8, cut: 3, above: false } },
  inputs: {
    spotifyListeners: 412000, igFollowers: 680000, tiktokFollowers: 290000, youtubeMonthlyViews: 1100000,
    spotifyFollowers: 32000, deezerFans: 6000, showsPerMonth: 2, cache: 2500,
    premios: 3, imprensaRepercussao: true, imprensaFrequencia: 'perene', editorialPlaylists: 7, radioAirplay: 1,
    temCnpj: true, temEmpresario: true, investimento: 85000, fazBilheteria: true, pagantePct: '51-69',
  },
};

const cm: any = {
  monthly_listeners: 412000,
  top_cities: [
    { name: 'São Paulo', country: 'BR', listeners: 180000 },
    { name: 'Rio de Janeiro', country: 'BR', listeners: 131000 },
  ],
  playlists: { count: 7, top: [{ name: 'MPB Now', followers: 312000, editorial: true }] },
};

describe('dimNarrative (V3)', () => {
  it('Reach: headline "acende" e nomeia os canais que puxam o alcance', () => {
    const n = dimNarrative('r', ri);
    expect(n.headline).toBe('Seu alcance digital acende.');
    expect(n.paras[1].lead).toContain('O Spotify e o YouTube');
    expect(n.paras[1].body).toContain('streaming');
  });
  it('Earnings: receita acende, diversificação e saldo positivo', () => {
    const n = dimNarrative('e', ri);
    expect(n.headline).toBe('A receita acende.');
    expect(n.paras.some((p) => p.lead.includes('mais de uma perna'))).toBe(true);
    expect(n.paras.some((p) => p.lead.includes('se paga, e sobra'))).toBe(true);
  });
  it('Audience: baixo, palco rarefeito e engajamento no Instagram', () => {
    const n = dimNarrative('a', ri);
    expect(n.headline).toContain('em construção');
    expect(n.paras.some((p) => p.lead.includes('quase não está no palco'))).toBe(true);
    expect(n.paras.some((p) => p.lead.includes('engaja no Instagram'))).toBe(true);
  });
  it('Legitimacy: Top Tier + imprensa constante + chancela de plataforma', () => {
    const n = dimNarrative('l', ri);
    expect(n.headline).toContain('Top Tier');
    expect(n.paras.some((p) => p.lead.includes('constante'))).toBe(true);
    expect(n.paras.some((p) => p.lead.includes('chancela de plataforma'))).toBe(true);
  });
});

describe('DiagnosticDoc V3 (deck do PDF)', () => {
  const html = renderToStaticMarkup(
    <DiagnosticDoc realIndex={ri} chartmetric={cm} artistName="Marília Tavares" avatarSrc="data:," />,
  );
  it('gera 12 páginas (capa + perfil + 4 dimensões + cidades + plataformas + 16 perfis + metodologia + quem assina + CTA)', () => {
    expect((html.match(/data-docpage/g) || []).length).toBe(12);
  });
  it('inclui as novas seções', () => {
    expect(html).toContain('O que isso revela');
    expect(html).toContain('Composição da receita');
    expect(html).toContain('Engajamento por rede');
    expect(html).toContain('Sua posição entre os 16 perfis');
    expect(html).toContain('Como nasce o seu diagnóstico');
    expect(html).toContain('Anita Carvalho');
    expect(html).toContain('Top Tier');
  });
});
