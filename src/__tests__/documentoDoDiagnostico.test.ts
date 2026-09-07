import fs from 'fs';
import path from 'path';

import { montarDocumentoDoDiagnostico } from '@maestra/core/documentos/diagnosticoHtml';
import { autoriaDoDocumento, linhasDaDimensao } from '@maestra/core/documentos/diagnostico';
import { computeRealIndexV4 } from '@maestra/core/services/realEngine';
import type { RealInputsV4 } from '@maestra/core/services/realEngine';

// O PDF do diagnóstico existe nas DUAS superfícies, e é o mesmo documento.
//
// A web captura o deck em React (`DiagnosticDoc.tsx`) página a página; o app imprime o HTML do
// núcleo. Os NÚMEROS e os RÓTULOS já são os mesmos (as tabelas moram em `documentos/diagnostico`,
// e as duas leem de lá). O que este teste protege é o resto: as PÁGINAS.
//
// Uma página que exista de um lado e não do outro é o mesmo documento contando duas histórias —
// e ninguém percebe até alguém comparar dois PDFs do mesmo artista.

const raiz = path.join(__dirname, '..', '..');
const deckDaWeb = fs.readFileSync(
  path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticDoc.tsx'), 'utf8',
);

/** Um diagnóstico mínimo, mas com tudo que muda o número de páginas. */
const real = {
  version: 3,
  computedAt: '2026-08-01T12:00:00.000Z',
  profile: {
    name: 'Artesão Invisível',
    description: 'Você fatura com música, mas sem palco expressivo.',
    insights: ['Primeiro insight.', 'Segundo insight.'],
  },
  pattern: { r: false, e: true, a: false, l: false },
  dimTopIcon: { e: false },
  boletim: { r: 40, e: 72, a: 31, l: 12 },
  revenue: { total: 12000, shows: 8000, sources: { streaming: 4000 } },
  inputs: {
    showsPerMonth: 4, cache: 3000, custoPorShow: 0, custoFixoMensal: 0, investLancamentos12m: 20000, temCnpj: true, temEmpresario: false,
    premios: 1, imprensaRepercussao: true, imprensaFrequencia: 'perene', editorialPlaylists: 3,
    radioAirplay: 120, fazBilheteria: true, pagantePct: '70_94',
  },
  engagement: { instagram: { value: 0.006, cut: 0.028, above: false } },
} as never;

const chartmetric = {
  monthly_listeners: 1914986,
  top_cities: [{ name: 'São Paulo', country: 'BR', listeners: 120000 }],
  playlists: { count: 12, top: [{ name: 'Novidades', followers: 4000, editorial: true }] },
};

const html = montarDocumentoDoDiagnostico({
  realIndex: real,
  chartmetric,
  artistName: 'AZMUTH BEATS',
  avatarSrc: 'https://exemplo.invalid/foto.jpg',
  autoria: autoriaDoDocumento({
    email: 'artista@exemplo.com', nome: 'Lucas', artistId: '61803333-1bdd',
    calculadoEm: '2026-08-01T12:00:00.000Z', vinculo: 'sou_artista',
  }),
  agora: new Date('2026-08-30T12:00:00.000Z'),
});

describe('o documento do diagnóstico', () => {
  // As seções que o deck da web tem, pelo texto que cada página carrega.
  it.each([
    ['a capa', 'Diagnóstico de carreira'],
    ['o perfil', 'Seu perfil de carreira'],
    ['o que o diagnóstico revela', 'O que o seu diagnóstico revela'],
    ['as cidades', 'Onde seus ouvintes estão'],
    ['as plataformas', 'Sua presença nas plataformas'],
    ['a imprensa', 'Imprensa em detalhe'],
    ['os 16 perfis', 'Sua posição entre os 16 perfis'],
    ['o TOP ICON', 'TOP ICON'],
    ['quem assina', 'Anita Carvalho'],
    ['o próximo passo', 'Você sabe onde está. Agora, para onde ir.'],
  ])('%s existe nos dois decks', (_nome, texto) => {
    expect(deckDaWeb).toContain(texto);
    expect(html).toContain(texto);
  });

  it('tem uma página por seção, com a numeração fechando', () => {
    const paginas = html.match(/class="pg/g) ?? [];
    // 10 fixas + cidades + plataformas.
    expect(paginas).toHaveLength(12);
    expect(html).toContain('11 / 12');
  });

  // A procedência é o ponto mais sensível do documento: sem ela, um número declarado passa por
  // apurado. As linhas vêm do núcleo, então basta provar que a marca chega ao papel.
  it('marca o que foi declarado por quem preencheu', () => {
    expect(linhasDaDimensao('e', real, chartmetric).every((l) => l.declarado)).toBe(true);
    expect(html).toContain('†');
    expect(html).toContain('A Maestra não verifica estes dados');
    expect(html).toContain('informados por quem preencheu');
  });

  // O `docId` é a referência do suporte: mesmo diagnóstico, mesmo id, nas duas superfícies.
  it('a autoria é determinística e vai para o papel', () => {
    const a = autoriaDoDocumento({
      email: 'artista@exemplo.com', artistId: '61803333-1bdd',
      calculadoEm: '2026-08-01T12:00:00.000Z',
    });
    const b = autoriaDoDocumento({
      email: 'artista@exemplo.com', artistId: '61803333-1bdd',
      calculadoEm: '2026-08-01T12:00:00.000Z',
    });
    expect(a!.docId).toEqual(b!.docId);
    expect(html).toContain(a!.docId);
  });

  it('sem sessão identificada não há autoria', () => {
    expect(autoriaDoDocumento({ email: null, artistId: 'x' })).toBeUndefined();
  });

  it('o botão do fim leva ao site', () => {
    expect(html).toContain('href="https://www.maestramanager.com"');
  });

  // ── v4: o documento passa a contar a carreira em base ANUAL e com saldo (§7) ──
  //
  // O motor entrega os números; o teste garante que eles CHEGAM ao papel. Sem isso o deck
  // continuaria imprimindo a conta mensal da v3 sobre entradas anuais, e o PDF diria um valor
  // doze vezes menor sem nenhum erro visível.
  describe('na v4', () => {
    const entradas: RealInputsV4 = {
      spotifyConnected: true,
      spotifyListeners: 1_914_986, igFollowers: 80_000, tiktokFollowers: null,
      youtubeMonthlyViews: null, spotifyFollowers: 500_000, deezerFans: 6_000,
      igEngagement: 4.35, tiktokEngagement: null, youtubeEngagement: null,
      editorialPlaylists: 3, radioAirplay180d: 120,
      igFollowersSelf: null, tiktokFollowersSelf: 40_000, youtubeViews28dSelf: null,
      showsPerYear: 40,
      cacheByType: { corporativos: 6_000, produtores: 2_000 },
      revenueSources: { distribuidora: 12_000, editora: 'nao_sei' },
      custoPorShow: 0, custoFixoMensal: 0, investLancamentos12m: 20_000,
      temCnpj: true, aliquota: '6-10', temEmpresario: false,
      fazBilheteria: false, pagantePct: null,
      premios: 4, imprensaRepercussao: true,
      imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
    };
    const v4 = computeRealIndexV4(entradas);
    const htmlV4 = montarDocumentoDoDiagnostico({
      realIndex: v4 as never,
      chartmetric,
      artistName: 'AZMUTH BEATS',
      agora: new Date('2026-09-06T12:00:00.000Z'),
    });

    it('imprime a receita ANUAL, e não a mensal vezes doze', () => {
      // 40 shows × média de 4.000 + 12.000 de distribuidora = 172.000
      expect(v4.revenue.receitaAnual).toBe(172_000);
      expect(htmlV4).toContain('R$ 172 mil');
      expect(htmlV4).toContain('Saldo');
    });

    it('mostra o cachê por tipo de contratante', () => {
      expect(htmlV4).toContain('Cachê médio por tipo de contratante');
      expect(htmlV4).toContain('Corporativos');
      expect(htmlV4).toContain('Produtores de eventos');
    });

    it('diz que o engajamento não entra no diagnóstico', () => {
      expect(htmlV4).toContain('informativo, não entra no diagnóstico');
    });

    it('leva ao papel os textos obrigatórios que se aplicam', () => {
      // Sem bilheteria (§11.3.6) e a fonte "não sei" (§11.3.4).
      expect(htmlV4).toContain('o público real não pode ser comprovado');
      expect(htmlV4).toContain('Não informado:');
      expect(htmlV4).toContain('Editora');
      expect(htmlV4).toContain('parte da gestão da carreira');
    });

    // O aprofundamento do E (§2) é página do PDF, não da tela — e das duas superfícies, senão
    // o artista que baixa pelo app recebe um documento com uma página a mais que o da web.
    it('tem a página "Onde a conta fecha" nos dois decks', () => {
      expect(htmlV4).toContain('Onde a conta fecha');
      expect(deckDaWeb).toContain('Onde a conta fecha');
      expect(htmlV4).toContain('Margem por show e ponto de equilíbrio');
      expect(deckDaWeb).toContain('Margem por show e ponto de equilíbrio');
      expect(htmlV4).toContain('Composição da receita anual');
      expect(deckDaWeb).toContain('Composição da receita anual');
    });

    it('a linha de receita da dimensão E vem marcada como declarada', () => {
      expect(linhasDaDimensao('e', v4 as never, chartmetric).every((l) => l.declarado)).toBe(true);
    });
  });
});

// ── Os textos obrigatórios do §11.3 têm que ter CASA ────────────────────────────
//
// Eles saíram do bloco genérico no topo da entrega e foram para dentro da dimensão a que
// pertencem. O risco agora é o oposto do de antes: um deles deixar de ser impresso em algum
// lugar e desaparecer do produto sem que nada quebre.
describe('os avisos obrigatórios da tela', () => {
  const telaDaWeb = fs.readFileSync(
    path.join(raiz, 'src', 'pages', 'ArtistCreate', 'DiagnosticReport.tsx'), 'utf8',
  );
  const cartaoDoApp = fs.readFileSync(
    path.join(raiz, 'apps', 'mobile', 'src', 'casca', 'diagnostico', 'CartaoDaDimensao.tsx'), 'utf8',
  );

  it.each([
    ['a trava do L', 'travaL', "chave === 'l'", "dk === 'l'"],
    ['a ausência de bilheteria', 'aSemBilheteria', "chave === 'a'", "dk === 'a'"],
    ['a autodeclaração', 'autodeclarados', "chave === 'r'", "dk === 'r'"],
  ])('%s é impressa na dimensão certa, nas duas superfícies', (_nome, flag, noApp, naWeb) => {
    expect(cartaoDoApp).toContain(flag);
    expect(cartaoDoApp).toContain(noApp);
    expect(telaDaWeb).toContain(flag);
    expect(telaDaWeb).toContain(naWeb);
  });

  it('o saldo negativo e o "não sei" saem junto dos números do E', () => {
    for (const fonte of [telaDaWeb, cartaoDoApp]) {
      expect(fonte).toContain('AVISOS.saldoNegativo');
      expect(fonte).toContain('AVISOS.naoSei');
    }
  });

  it('o bloco do topo passa a usar só o que não tem casa', () => {
    expect(telaDaWeb).toContain('avisosSemLugarProprio');
    expect(telaDaWeb).not.toContain('avisosDoDiagnostico(');
  });
});
