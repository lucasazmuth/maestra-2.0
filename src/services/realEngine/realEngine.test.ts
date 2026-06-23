import { computeRealIndexV2, type RealInputsV2 } from './index';

// Base "tudo baixo" (perfil Beginner). Cada teste sobrescreve só o que importa.
const base = (over: Partial<RealInputsV2> = {}): RealInputsV2 => ({
  spotifyConnected: true,
  spotifyListeners: 0, igFollowers: 0, tiktokFollowers: 0, youtubeMonthlyViews: 0, tiktokVideoViews: 0,
  spotifyFollowers: 0, deezerFans: 0, igEngagement: 0, youtubeEngagement: 0, tiktokEngagement: 0,
  editorialPlaylists: 0, radioAirplay: 0,
  showsPerMonth: 0, avgAudience: 0, faturamento: 0, fonteRenda: 'musical', investimento: 0,
  cnpj: 'pf', empresario: 'nao', premios: 0, imprensa: 0,
  ...over,
});

describe('Motor REAL v2', () => {
  it('tudo baixo → Beginner (0000)', () => {
    const ri = computeRealIndexV2(base());
    expect(ri.profile.key).toBe('0000');
    expect(ri.profile.name).toBe('Beginner');
    expect(ri.version).toBe(2);
  });

  it('sem Spotify (opção B): componentes de API ficam baixos', () => {
    const ri = computeRealIndexV2(base({ spotifyConnected: false, spotifyListeners: null, igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null, tiktokVideoViews: null }));
    expect(ri.pattern.r).toBe(false);
    // todos os componentes de R baixos mesmo com valores nulos (z mínimo)
    expect(ri.components.r.every((c) => !c.high)).toBe(true);
    expect(ri.profile.key).toBe('0000');
  });

  it('Icon (1111): quatro dimensões altas', () => {
    const ri = computeRealIndexV2(base({
      spotifyListeners: 2_000_000, igFollowers: 1_000_000, tiktokFollowers: 1_000_000,
      youtubeMonthlyViews: 10_000_000, tiktokVideoViews: 50_000_000,
      spotifyFollowers: 1_000_000, deezerFans: 300_000,
      igEngagement: 8, youtubeEngagement: 8, tiktokEngagement: 8,
      showsPerMonth: 10, avgAudience: 5_000,
      faturamento: 100_000, fonteRenda: 'musical', investimento: 120_000, cnpj: 'ltda', empresario: 'mercado',
      premios: 4, imprensa: 3, editorialPlaylists: 20, radioAirplay: 500,
    }));
    expect(ri.pattern).toEqual({ r: true, e: true, a: true, l: true });
    expect(ri.profile.key).toBe('1111');
    expect(ri.profile.name).toBe('Icon');
  });

  it('E acende só com score ≥ 0,70 (5 sinais ponderados)', () => {
    // Faturamento alto + musical + CNPJ LTDA + empresário do mercado + investimento saudável.
    const high = computeRealIndexV2(base({ faturamento: 100_000, fonteRenda: 'musical', investimento: 120_000, cnpj: 'ltda', empresario: 'mercado' }));
    expect(high.pattern.e).toBe(true);
    expect(high.components.e.score).toBeGreaterThanOrEqual(0.70);
    // Faturamento alto vindo de fonte NÃO-musical não basta p/ acender o E (mede "a música sustenta?").
    const naoMusical = computeRealIndexV2(base({ faturamento: 100_000, fonteRenda: 'nao_musical' }));
    expect(naoMusical.pattern.e).toBe(false);
    // Gate da fonte: mesmo com estrutura cheia (LTDA + empresário + investimento), não-musical NÃO acende.
    const naoMusicalFull = computeRealIndexV2(base({ faturamento: 100_000, fonteRenda: 'nao_musical', investimento: 120_000, cnpj: 'ltda', empresario: 'mercado' }));
    expect(naoMusicalFull.pattern.e).toBe(false);
    expect(naoMusicalFull.components.e.score).toBeLessThan(0.70);
  });

  it('L: as 2 componentes de API sozinhas NÃO bastam (precisa de júri/imprensa)', () => {
    // Playlists + airplay altos, mas sem prêmios nem imprensa → L apagado.
    const apiOnly = computeRealIndexV2(base({ editorialPlaylists: 20, radioAirplay: 500, premios: 0, imprensa: 0 }));
    expect(apiOnly.components.l.filter((c) => c.high).length).toBe(2);
    expect(apiOnly.pattern.l).toBe(false);
    // Com um reconhecimento de imprensa nacional, fecha 3/4 com júri → L acende.
    const withPress = computeRealIndexV2(base({ editorialPlaylists: 20, radioAirplay: 500, premios: 0, imprensa: 2 }));
    expect(withPress.pattern.l).toBe(true);
  });

  it('zero real vs zero por ausência (com Spotify) no componente de seguidores de rede', () => {
    // Ausência: IG nulo é EXCLUÍDO → componente = só TikTok (alto).
    const absence = computeRealIndexV2(base({ igFollowers: null, tiktokFollowers: 600_000 }));
    const compAbs = absence.components.r.find((c) => c.key === 'socialFollowers')!;
    expect(compAbs.high).toBe(true);
    // Zero real: IG = 0 entra na média e derruba o componente.
    const zero = computeRealIndexV2(base({ igFollowers: 0, tiktokFollowers: 600_000 }));
    const compZero = zero.components.r.find((c) => c.key === 'socialFollowers')!;
    expect(compZero.high).toBe(false);
  });

  it('shows é "por mês" reescalonado ×12 (10/mês = 120/ano = alto)', () => {
    const ri = computeRealIndexV2(base({ showsPerMonth: 10 }));
    const shows = ri.components.a.find((c) => c.key === 'shows')!;
    expect(shows.high).toBe(true);
  });

  it('boletim 0–100 e linha de corte presentes', () => {
    const ri = computeRealIndexV2(base({ faturamento: 100_000, fonteRenda: 'musical', investimento: 120_000, cnpj: 'ltda', empresario: 'mercado' }));
    expect(ri.boletim.e).toBeGreaterThanOrEqual(70);
    expect(ri.cutLine.e).toBe(70);
    for (const k of ['r', 'a', 'l'] as const) {
      expect(ri.boletim[k]).toBeGreaterThanOrEqual(0);
      expect(ri.boletim[k]).toBeLessThanOrEqual(100);
    }
  });
});
