// Verificação do deck V3: narrativa determinística + presença/ordem das 12 páginas do PDF.
// Renderiza o DiagnosticDoc (V3) com um realIndex mockado (perfil Spotlight) e confere as seções.
import { renderToStaticMarkup } from 'react-dom/server';
import { dimNarrative } from '@maestra/core/constants/realNarrative';

// SVGs são mockados apenas na verificação estrutural do deck; a renderização vetorial é coberta
// pelos testes dedicados do MaestraBrand e pela validação visual dos arquivos exportados.
jest.mock('../../assets/brand/maestra-symbol.svg', () => ({
  __esModule: true,
  default: 'maestra-symbol.svg',
  ReactComponent: () => <svg data-testid="maestra-symbol" />,
}));
jest.mock('../../assets/brand/maestra-wordmark.svg', () => ({
  __esModule: true,
  default: 'maestra-wordmark.svg',
  ReactComponent: () => <svg data-testid="maestra-wordmark" />,
}));
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
// eslint-disable-next-line import/first
import { computeRealIndexV4, type RealInputsV4 } from '@maestra/core/services/realEngine';

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
  it('Legitimacy: TOP ICON + imprensa constante + chancela de plataforma', () => {
    const n = dimNarrative('l', ri);
    expect(n.headline).toContain('TOP ICON');
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
    expect(html).toContain('TOP ICON');
  });
  it('usa o wordmark vetorial oficial da Maestra', () => {
    expect(html).toContain('data-brand-variant="wordmark"');
    expect(html).toContain('data-testid="maestra-wordmark"');
    expect(html).not.toContain('Maestra Manager');
  });
});

// ─── v4: o MESMO deck, com a página de aprofundamento do E ─────────────────────
//
// Este bloco existe por causa de um defeito que só apareceu rodando o fluxo de ponta a ponta: o
// seletor comparava `version === 3`, então todo diagnóstico v4 caía no layout LEGADO de 8
// páginas. Nada quebrava, nada aparecia no log — o artista só recebia o PDF errado.
describe('DiagnosticDoc v4 (deck do PDF)', () => {
  const entradas: RealInputsV4 = {
    spotifyConnected: true,
    spotifyListeners: 2_900_000, igFollowers: 2_000_000, tiktokFollowers: 290_000,
    youtubeMonthlyViews: 900_000, spotifyFollowers: 678_000, deezerFans: 6_000,
    igEngagement: 2.4, tiktokEngagement: 1.2, youtubeEngagement: 0.4,
    editorialPlaylists: 15, radioAirplay180d: 259,
    igFollowersSelf: null, tiktokFollowersSelf: null, youtubeViews28dSelf: null,
    showsPerYear: 60,
    cacheByType: { corporativos: 15_000, orgaosPublicos: 12_000, produtores: 8_000, casasDeShow: 5_000 },
    revenueSources: { distribuidora: 80_000, editora: 'nao_sei', associacao: 30_000, publi: 50_000 },
    custoPorShow: 4_000, custoFixoMensal: 6_000, investLancamentos12m: 150_000,
    temCnpj: true, aliquota: '6-10', temEmpresario: true,
    fazBilheteria: true, pagantePct: '70-94',
    premios: 4, imprensaRepercussao: true,
    imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }], imprensaFrequencia: 'perene',
  };
  const v4 = computeRealIndexV4(entradas);
  const html = renderToStaticMarkup(
    <DiagnosticDoc realIndex={v4 as never} chartmetric={cm} artistName="Marília Tavares" avatarSrc="data:," />,
  );

  it('usa o deck detalhado, e não o legado', () => {
    // 10 fixas + a leitura de cada dimensão + cidades + plataformas + "Onde a conta fecha".
    expect((html.match(/data-docpage/g) || []).length).toBe(17);
    expect(html).toContain('16 / 17');
  });

  it('dá duas páginas a cada dimensão: os números e a leitura', () => {
    expect((html.match(/· a leitura/g) || []).length).toBe(4);
    // A intro fixa e a frase de leitura moram na segunda; a tabela, na primeira.
    expect(html).toContain('O que é esta frente');
  });

  it('traz a página "Onde a conta fecha" com a conta do E', () => {
    expect(html).toContain('Onde a conta fecha');
    expect(html).toContain('Margem por show e ponto de equilíbrio');
    expect(html).toContain('Composição da receita anual');
    // Cachê médio 10 mil, custo 4 mil por show: margem de 6 mil, e 12 shows cobrem o fixo do ano.
    expect(v4.revenue.margemPorShow).toBe(6_000);
    expect(v4.revenue.pontoEquilibrioShows).toBe(12);
    expect(html).toContain('Shows pra cobrir o fixo do ano');
  });

  // O mesmo parágrafo nas duas páginas é o tipo de erro que ninguém vê revisando o código e todo
  // mundo vê no PDF pronto: a página do E e a do aprofundamento, uma depois da outra.
  // ⚠️ A PÁGINA DAS PLATAFORMAS PAROU DE CONTRADIZER O L (§12, secção 9). O bloco "Imprensa em
  // detalhe" escrevia um veredito sobre a imprensa sem olhar a matriz de veículos, no mesmo
  // documento em que a página do L diz o que a matriz apurou. Este deck é o da WEB, e tinha a
  // mesma prosa que o do núcleo — duas cópias do mesmo erro.
  it('a página das plataformas mostra os sinais, e não um veredito sobre a imprensa', () => {
    expect(html).toContain('Sinais de plataforma');
    expect(html).toContain('Playlists editoriais');
    expect(html).toContain('Execução em rádio · 180 dias');
    expect(html).not.toContain('Imprensa em detalhe');
    expect(html).not.toContain('A imprensa ainda não repercutiu o seu trabalho');
  });

  // §8.5 — o que não entra no índice tem de o dizer. Sem o rótulo, engajamento e Deezer ficavam
  // no mesmo peso de playlist e rádio, que entram.
  // ⚠️ O RÓTULO TEM DE ESTAR NA LINHA, e não em qualquer lugar do documento. A primeira versão
  // desta asserção procurava a frase solta — e ela já existe noutra página, a do engajamento por
  // rede. Tirar o rótulo das linhas desta secção não fazia o teste falhar.
  it('e rotula o engajamento e o Deezer como informativos, na própria linha', () => {
    expect(html).toMatch(/Engajamento no Instagram[\s\S]{0,240}informativo, não entra no diagnóstico/);
    expect(html).toMatch(/Fãs no Deezer[\s\S]{0,240}informativo, não entra no diagnóstico/);
    // E o que ENTRA no índice não leva rótulo nenhum.
    expect(html).not.toMatch(/Playlists editoriais[\s\S]{0,120}informativo, não entra/);
  });

  it('não repete o comentário da conta na página do E', () => {
    const lead = 'Cada show seu deixa';
    expect(html.split(lead).length - 1).toBe(1);
  });

  it('não imprime os bullets do perfil, que a v4 substituiu pelo retrato', () => {
    expect(html).not.toContain('O que o seu diagnóstico revela');
  });
});

// ════════ v4.5 · o PDF no caminho direto ════════
//
// Quem respondeu o saldo numa faixa nunca informou receita, custo por show nem cachê por
// contratante. A página "Onde a conta fecha" é feita dessas três coisas: ela sairia com zeros de
// ponta a ponta, e o número de páginas do documento não pode mentir sobre isso.
describe('DiagnosticDoc v4.5 · o caminho direto', () => {
  const direto: RealInputsV4 = {
    spotifyConnected: true,
    spotifyListeners: 2_900_000, igFollowers: 2_000_000, tiktokFollowers: 290_000,
    youtubeMonthlyViews: 900_000, spotifyFollowers: 678_000, deezerFans: 6_000,
    igEngagement: 2.4, tiktokEngagement: 1.2, youtubeEngagement: 0.4,
    editorialPlaylists: 15, radioAirplay180d: 259,
    igFollowersSelf: null, tiktokFollowersSelf: null, youtubeViews28dSelf: null,
    showsPerYear: 60,
    saldoFaixa: 6,
    // Com detalhe por cima da faixa: sem ele, os blocos que este teste diz não existirem já não
    // existiriam por falta de dado, e as asserções ficavam vazias.
    cacheByType: { corporativos: 15_000, produtores: 8_000 },
    revenueSources: { distribuidora: 80_000 },
    custoPorShow: 4_000, custoFixoMensal: 6_000, investLancamentos12m: 150_000,
    temCnpj: true, aliquota: null, temEmpresario: false,
    fazBilheteria: true, pagantePct: '70-94',
    premios: 4, imprensaRepercussao: true,
    imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }], imprensaFrequencia: 'perene',
  };
  const html = renderToStaticMarkup(
    <DiagnosticDoc
      realIndex={computeRealIndexV4(direto) as never}
      chartmetric={cm} artistName="Marília Tavares" avatarSrc="data:,"
    />,
  );

  it('a página "Onde a conta fecha" não existe, e a contagem acompanha', () => {
    expect(html).not.toContain('Onde a conta fecha');
    // Uma página a menos do que o detalhado, e a numeração impressa tem de dizer o mesmo.
    expect((html.match(/data-docpage/g) || []).length).toBe(16);
    expect(html).toContain('15 / 16');
  });

  it('nem a margem por show, nem o ponto de equilíbrio, nem o cachê por contratante', () => {
    expect(html).not.toContain('Margem por show');
    expect(html).not.toContain('Cachê médio por tipo de contratante');
    expect(html).not.toContain('Composição da receita');
  });

  // ⚠️ OS CHIPS MORAVAM NAQUELA PÁGINA, e tinham sumido com ela. O §3 manda-os aparecer nos dois
  // caminhos: são o que o artista respondeu, e o que dá o bônus de estrutura que decide a nota.
  it('mas os chips de estrutura continuam, com o convite a detalhar', () => {
    expect(html).toContain('Com CNPJ');
    expect(html).toContain('Sem empresário');
    expect(html).toContain('detalhe receitas e custos');
  });

  it('a tabela do E mostra a faixa, mensal e anual, e nenhum valor inventado', () => {
    expect(html).toContain('De R$ 10 mil a R$ 25 mil por mês');
    expect(html).toContain('de R$ 120 mil a R$ 300 mil por ano');
    expect(html).not.toContain('Custo médio por show');
  });
});
