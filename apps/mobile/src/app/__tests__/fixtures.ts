import type { Artist } from '@maestra/core/interfaces/maestra';

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
