import type { Artist } from '@maestra/core/interfaces/maestra';
import { computeRealIndexV4 } from '@maestra/core/services/realEngine';

// Perfis de mentira, mas com a FORMA real: o `realIndex` aqui e o que o motor grava de verdade,
// entao a tela e exercitada contra a estrutura que ela vai encontrar em producao.

export const comDiagnostico: Artist = {
  id: 'a-1',
  user_id: 'u-1',
  name: 'Marina Sol',
  content: {
    identity: { genre: 'MPB' },
    spotifyProfile: {
      spotify_artist_id: 'sp1',
      name: 'Marina Sol',
      image: 'https://exemplo.invalid/marina.jpg',
      fetched_at: '2026-01-01T00:00:00Z',
    },
    strategies: [
      {
        id: 's-1',
        type: 'SO',
        title: 'Levar o show para uma segunda praça',
        why: 'O alcance já existe fora da cidade e ninguém está cobrando por isso.',
        tasks: [
          { id: 't-1', description: 'Mapear três casas na cidade vizinha', status: 'done' },
          { id: 't-2', description: 'Montar proposta com cachê e rider', status: 'todo' },
        ],
      },
      {
        id: 's-2',
        type: 'WO',
        title: 'Sair da dependência de um canal só',
        tasks: [{ id: 't-3', description: 'Abrir catálogo em uma segunda distribuidora', status: 'todo' }],
      },
    ],
    realIndex: {
      version: 3,
      profile: {
        key: 'construcao',
        name: 'Em construção',
        description: 'Alcance crescendo, receita ainda irregular.',
        insights: ['O alcance já sustenta um show fora da cidade.', 'A receita depende de um único canal.'],
      },
      pattern: { r: true, e: false, a: false, l: false },
      boletim: { r: 78, e: 34, a: 51, l: 12 },
      cutLine: { r: 70, e: 70, a: 70, l: 70 },
      // Obrigatorios no tipo, e por bom motivo: `inputs` e o espelho que o boletim explica, e
      // `computedAt` diz de quando e a leitura. O tsc os cobrou, e o fixture so vale se tiver a
      // forma real — se ele divergir do que producao grava, o teste passa a mentir.
      inputs: { spotifyListeners: 120_000, igFollowers: 8_400 },
      computedAt: '2026-02-10T12:00:00Z',
    },
  },
};

export const semDiagnostico: Artist = {
  id: 'a-2',
  user_id: 'u-1',
  name: 'Coletivo Norte',
  content: {},
};

/**
 * Um diagnóstico da v4, calculado pelo MOTOR de verdade.
 *
 * Os outros fixtures são escritos à mão, e isso basta enquanto a forma é estável. Aqui não: a v4
 * mudou o formato de `inputs` (proveniência por campo), de `revenue` (base anual, nove fontes) e
 * acrescentou `flags`. Um fixture escrito à mão fixaria a forma que EU imaginei, e a tela
 * continuaria passando no teste enquanto quebrasse em produção. Chamando o motor, o fixture não
 * pode divergir dele.
 */
const v4 = computeRealIndexV4({
  spotifyConnected: true,
  spotifyListeners: 200_000, igFollowers: 80_000, tiktokFollowers: null, youtubeMonthlyViews: null,
  spotifyFollowers: 60_000, deezerFans: 6_000,
  igEngagement: 5.2, tiktokEngagement: null, youtubeEngagement: null,
  editorialPlaylists: 4, radioAirplay180d: 3,
  igFollowersSelf: null, tiktokFollowersSelf: 40_000, youtubeViews28dSelf: null,
  showsPerYear: 60,
  cacheByType: { corporativos: 6_000, produtores: 2_000 },
  revenueSources: { distribuidora: 20_000, editora: 'nao_sei' },
  investimento: 40_000,
  temCnpj: true, aliquota: '6-10', temEmpresario: false,
  fazBilheteria: false, pagantePct: null,
  premios: 4, imprensaRepercussao: true,
  imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
});

export const comDiagnosticoV4: Artist = {
  id: 'a-3',
  user_id: 'u-1',
  name: 'Rafa Duarte',
  content: {
    identity: { genre: 'MPB' },
    realIndex: v4 as never,
  },
};
