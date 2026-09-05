import fs from 'fs';
import path from 'path';

import { montarDocumentoDoDiagnostico } from '@maestra/core/documentos/diagnosticoHtml';
import { autoriaDoDocumento, linhasDaDimensao } from '@maestra/core/documentos/diagnostico';

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
    showsPerMonth: 4, cache: 3000, investimento: 20000, temCnpj: true, temEmpresario: false,
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
    ['o Top Tier', 'Top Tier'],
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
});
