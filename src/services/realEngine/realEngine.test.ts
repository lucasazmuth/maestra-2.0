import { computeRealIndexV3 } from './index';
import type { RealInputsV3 } from './index';

// Base "tudo baixo" (perfil Beginner). Cada teste sobrescreve só o que importa.
const base = (over: Partial<RealInputsV3> = {}): RealInputsV3 => ({
  spotifyConnected: true,
  spotifyListeners: 0, igFollowers: 0, tiktokFollowers: 0, youtubeMonthlyViews: 0,
  spotifyFollowers: 0, deezerFans: 0, igEngagement: 0, youtubeEngagement: 0, tiktokEngagement: 0,
  editorialPlaylists: 0, radioAirplay: null,
  showsPerMonth: 0, cache: 0, faturamentoForaShows: 0, revenueSources: {}, investimento: 0,
  temCnpj: false, temEmpresario: false,
  premios: 0, imprensaRepercussao: false, imprensaMatrix: [], imprensaFrequencia: 'lancamento',
  fazBilheteria: false, pagantePct: null,
  ...over,
});

// Insumos que acendem cada dimensão isoladamente.
const R_ON: Partial<RealInputsV3> = { spotifyListeners: 20_000_000, igFollowers: 2_000_000, tiktokFollowers: 2_000_000, youtubeMonthlyViews: 30_000_000 };
const E_ON: Partial<RealInputsV3> = { showsPerMonth: 4, cache: 4_000, temCnpj: true, temEmpresario: true }; // 16k/mês
const A_ON: Partial<RealInputsV3> = { spotifyListeners: 100_000, spotifyFollowers: 30_000, igEngagement: 5, showsPerMonth: 10, fazBilheteria: true, pagantePct: '70-94' };
const L_ON: Partial<RealInputsV3> = { premios: 2, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }], imprensaFrequencia: 'perene', editorialPlaylists: 3 };

describe('Motor REAL v3', () => {
  it('tudo baixo → Beginner (0000)', () => {
    const ri = computeRealIndexV3(base());
    expect(ri.profile.key).toBe('0000');
    expect(ri.profile.name).toBe('Beginner');
    expect(ri.version).toBe(3);
  });

  it('sem Spotify (opção A): componentes de API ficam baixos → tende a Beginner', () => {
    const ri = computeRealIndexV3(base({
      spotifyConnected: false,
      spotifyListeners: null, igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null,
      spotifyFollowers: null, igEngagement: null, youtubeEngagement: null, tiktokEngagement: null,
      editorialPlaylists: null, radioAirplay: null,
    }));
    expect(ri.pattern.r).toBe(false);
    expect(ri.components.r.every((c) => !c.high)).toBe(true);
    expect(ri.pattern.a).toBe(false);
    expect(ri.profile.key).toBe('0000');
  });

  // ── R ──
  it('R acende só com os 3 componentes altos', () => {
    // 2 de 3 altos (YouTube baixo) → R apagado.
    const two = computeRealIndexV3(base({ spotifyListeners: 2_000_000, igFollowers: 1_000_000, tiktokFollowers: 1_000_000, youtubeMonthlyViews: 1_000 }));
    expect(two.pattern.r).toBe(false);
    // 3 de 3 → R aceso.
    const three = computeRealIndexV3(base(R_ON));
    expect(three.pattern.r).toBe(true);
    expect(three.dimTopIcon.r).toBe(true); // todos no P95
  });

  // ── E ──
  it('E acende com receita_efetiva ≥ 11.250 e o modulador derruba o caso de borda', () => {
    // 4 shows × R$3.000 = R$12.000; com CNPJ+empresário modulador 1.0 → acende.
    const on = computeRealIndexV3(base({ showsPerMonth: 4, cache: 3_000, temCnpj: true, temEmpresario: true }));
    expect(on.pattern.e).toBe(true);
    // Mesma receita, mas sem empresário (−10%) e sem CNPJ (−5%) → 12.000×0,85 = 10.200 < 11.250 → apaga.
    const off = computeRealIndexV3(base({ showsPerMonth: 4, cache: 3_000, temCnpj: false, temEmpresario: false }));
    expect(off.pattern.e).toBe(false);
    // Estrutura não salva quem fatura pouco: 1 show × R$3.000 = 3.000, modulador 1.0 → apaga.
    const poor = computeRealIndexV3(base({ showsPerMonth: 1, cache: 3_000, temCnpj: true, temEmpresario: true }));
    expect(poor.pattern.e).toBe(false);
    // TOP ICON do E: ≥ R$50.000.
    const top = computeRealIndexV3(base({ showsPerMonth: 10, cache: 6_000, temCnpj: true, temEmpresario: true }));
    expect(top.dimTopIcon.e).toBe(true);
  });

  // ── A ──
  it('A acende só com os 4 componentes; sem bilheteria nunca acende', () => {
    const on = computeRealIndexV3(base(A_ON));
    expect(on.pattern.a).toBe(true);
    // conversão fraca (ratio < 0,25) derruba.
    const lowConv = computeRealIndexV3(base({ ...A_ON, spotifyFollowers: 1_000 }));
    expect(lowConv.pattern.a).toBe(false);
    // engajamento abaixo de todos os cortes derruba.
    const lowEng = computeRealIndexV3(base({ ...A_ON, igEngagement: 1, tiktokEngagement: 1, youtubeEngagement: 1 }));
    expect(lowEng.pattern.a).toBe(false);
    // sem bilheteria: % pagante nunca credita → A apagado mesmo com o resto alto.
    const noBilhe = computeRealIndexV3(base({ ...A_ON, fazBilheteria: false, pagantePct: null }));
    expect(noBilhe.pattern.a).toBe(false);
  });

  it('A engajamento acende com PELO MENOS uma rede acima do corte', () => {
    // só TikTok acima do corte (>9%); IG/YT abaixo.
    const ri = computeRealIndexV3(base({ ...A_ON, igEngagement: 1, youtubeEngagement: 1, tiktokEngagement: 12 }));
    expect(ri.components.a.find((c) => c.key === 'engagement')!.high).toBe(true);
  });

  // ── L ──
  it('L: soma ponderada — playlists/rádio sozinhos NÃO bastam (precisa de júri/imprensa)', () => {
    // playlists + airplay altos, sem prêmios nem imprensa: 0,20 (×renorm) < 0,70 → apaga.
    const apiOnly = computeRealIndexV3(base({ editorialPlaylists: 5, radioAirplay: 500, premios: 0, imprensaRepercussao: false }));
    expect(apiOnly.pattern.l).toBe(false);
  });

  it('L renormaliza quando não há airplay (não pune MPB/indie sem rádio)', () => {
    // prêmio internacional (1,0) + imprensa forte + playlists, SEM rádio rastreado.
    const ri = computeRealIndexV3(base({
      premios: 4, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }], imprensaFrequencia: 'perene',
      editorialPlaylists: 3, radioAirplay: null,
    }));
    expect(ri.components.l.radio.bin).toBeNull();
    expect(ri.pattern.l).toBe(true);
  });

  it('caso de calibração §9.3: artista muito legitimado deve acender o L', () => {
    // indicação a prêmio internacional (nota 0,95) + imprensa grande perene + playlists editoriais.
    const ri = computeRealIndexV3(base({
      premios: 4,
      imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }, { tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
      editorialPlaylists: 4, radioAirplay: 200,
    }));
    expect(ri.pattern.l).toBe(true);
    expect(ri.boletim.l).toBeGreaterThanOrEqual(70);
  });

  // ── Perfis / TOP ICON ──
  it('Icon (1111) e flag TOP ICON quando tudo no P95', () => {
    const ri = computeRealIndexV3(base({
      ...R_ON,
      spotifyFollowers: 8_000_000, // ratio 8M/20M = 0,4 ≥ 0,333 (conversão topicon)
      igEngagement: 8, youtubeEngagement: 8, tiktokEngagement: 20,
      showsPerMonth: 40, cache: 6_000, temCnpj: true, temEmpresario: true,
      fazBilheteria: true, pagantePct: '95-100',
      premios: 5, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
      editorialPlaylists: 10, radioAirplay: 500,
    }));
    expect(ri.pattern).toEqual({ r: true, e: true, a: true, l: true });
    expect(ri.profile.name).toBe('Icon');
    expect(ri.topIcon).toBe(true);
  });

  it('perfis intermediários mapeiam pela chave R-E-A-L', () => {
    expect(computeRealIndexV3(base({ ...A_ON })).profile.key).toBe('0010'); // só A → Paradox
    expect(computeRealIndexV3(base({ ...A_ON })).profile.name).toBe('Paradox');
    expect(computeRealIndexV3(base({ ...E_ON })).profile.key).toBe('0100'); // só E → Moneymaker
  });

  // ── Boletim ──
  it('invariante §9.1: para toda dimensão, nota ≥ 70 ⟺ acende', () => {
    const cases: Partial<RealInputsV3>[] = [
      base(), base(R_ON), base(E_ON), base(A_ON), base(L_ON),
      base({ ...R_ON, ...E_ON }), base({ ...A_ON, ...L_ON }),
      base({ showsPerMonth: 4, cache: 2_000 }), // E borderline baixo
      base({ premios: 2, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'blogs', porte: 'pequeno' }], imprensaFrequencia: 'esporadico' }),
    ];
    for (const c of cases) {
      const ri = computeRealIndexV3(c as RealInputsV3);
      (['r', 'e', 'a', 'l'] as const).forEach((k) => {
        expect(ri.boletim[k] >= 70).toBe(ri.pattern[k]);
        expect(ri.boletim[k]).toBeGreaterThanOrEqual(0);
        expect(ri.boletim[k]).toBeLessThanOrEqual(100);
      });
    }
  });

  it('cutLine fixa em 70 em todas as dimensões', () => {
    const ri = computeRealIndexV3(base());
    expect(ri.cutLine).toEqual({ r: 70, e: 70, a: 70, l: 70 });
  });

  // ── Ausência (opção B) ──
  it('com Spotify: sub-item null é EXCLUÍDO da média (não pune)', () => {
    // IG nulo é excluído → componente de rede = só TikTok (alto).
    const absence = computeRealIndexV3(base({ igFollowers: null, tiktokFollowers: 600_000 }));
    expect(absence.components.r.find((c) => c.key === 'socialFollowers')!.high).toBe(true);
    // Zero real: IG = 0 entra na média e derruba o componente.
    const zero = computeRealIndexV3(base({ igFollowers: 0, tiktokFollowers: 600_000 }));
    expect(zero.components.r.find((c) => c.key === 'socialFollowers')!.high).toBe(false);
  });

  // ── Receita / pizza ──
  it('compõe receita (shows × cachê + fora-shows) e expõe as fontes p/ a pizza', () => {
    const ri = computeRealIndexV3(base({ showsPerMonth: 6, cache: 1_800, faturamentoForaShows: 400, revenueSources: { streaming: 300, outros: 100 } }));
    expect(ri.revenue.shows).toBe(10_800);
    expect(ri.revenue.foraShows).toBe(400);
    expect(ri.revenue.total).toBe(11_200);
    expect(ri.revenue.sources).toEqual({ streaming: 300, outros: 100 });
  });

  // ═══════════════════ QA SÊNIOR — fronteiras e propriedades ═══════════════════

  it('QA: E logo ABAIXO do corte não acende e boletim fica < 70 (regressão do arredondamento §9.1)', () => {
    // 1 show × R$11.249 = receita_efetiva 11.249 (modulador 1.0): apagado, mas o boletim sem trava
    // arredondava p/ 70 (= "Baixo · 70/100"). Deve ficar ≤ 69.
    const just = computeRealIndexV3(base({ showsPerMonth: 1, cache: 11_249, temCnpj: true, temEmpresario: true }));
    expect(just.pattern.e).toBe(false);
    expect(just.boletim.e).toBeLessThan(70);
    // R$11.250 exatos: acende e boletim = 70.
    const on = computeRealIndexV3(base({ showsPerMonth: 1, cache: 11_250, temCnpj: true, temEmpresario: true }));
    expect(on.pattern.e).toBe(true);
    expect(on.boletim.e).toBe(70);
  });

  it('QA: âncoras do boletim E (0 → 0, P70 → 70, ponto médio → 85, P90 → 100)', () => {
    const at = (rec: number) => computeRealIndexV3(base({ showsPerMonth: 1, cache: rec, temCnpj: true, temEmpresario: true })).boletim.e;
    expect(at(0)).toBe(0);
    expect(at(11_250)).toBe(70);
    expect(at(30_625)).toBe(85);   // ponto médio entre 11.250 e 50.000
    expect(at(50_000)).toBe(100);
    expect(at(80_000)).toBe(100);  // trava em 100 acima do P90
  });

  it('QA: imprensa usa o MAIOR peso (§7.3 corrigido) — marcar veículo menor NÃO baixa a nota', () => {
    // max(85, 60, 30) = 85 → /100 = 0,85; × 1,0 (lançamento) = 0,85.
    const ri = computeRealIndexV3(base({
      imprensaRepercussao: true, imprensaFrequencia: 'lancamento',
      imprensaMatrix: [{ tipo: 'imprensa', porte: 'medio' }, { tipo: 'blogs', porte: 'grande' }, { tipo: 'podcasts', porte: 'pequeno' }],
    }));
    expect(ri.components.l.imprensa.nota).toBeCloseTo(0.85, 2);
    // adicionar um veículo pequeno a um grande NÃO reduz (era o efeito ruim da média).
    const soGrande = computeRealIndexV3(base({ imprensaRepercussao: true, imprensaFrequencia: 'lancamento', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    const grandeMaisPequeno = computeRealIndexV3(base({ imprensaRepercussao: true, imprensaFrequencia: 'lancamento', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }, { tipo: 'podcasts', porte: 'pequeno' }] }));
    expect(grandeMaisPequeno.components.l.imprensa.nota).toBe(soGrande.components.l.imprensa.nota);
    // teto: TV grande (100) × perene (1,30) → trava em 1,0.
    const teto = computeRealIndexV3(base({ imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    expect(teto.components.l.imprensa.nota).toBe(1);
  });

  it('QA: L NÃO acende sem sinal de plataforma, mesmo com nota_L ≥ 0,70 (trava §7.1/§7.5)', () => {
    // prêmio internacional + imprensa máxima, SEM playlist e SEM rádio → nota_L alta, mas apagado.
    const semPlataforma = computeRealIndexV3(base({
      premios: 5, imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
      editorialPlaylists: 0, radioAirplay: null,
    }));
    expect(semPlataforma.components.l.notaL).toBeGreaterThanOrEqual(0.70);
    expect(semPlataforma.pattern.l).toBe(false);
    expect(semPlataforma.boletim.l).toBeLessThan(70); // invariante §9.1 preservada
    // basta 1 playlist editorial para destravar.
    const comPlaylist = computeRealIndexV3(base({
      premios: 5, imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
      editorialPlaylists: 1, radioAirplay: null,
    }));
    expect(comPlaylist.pattern.l).toBe(true);
  });

  it('QA: dimTopIcon exige a dimensão ACESA — coerência do topIcon global (não marca sem Icon)', () => {
    // A: conversão + %pagante no P95, mas engajamento/shows baixos → A NÃO acende → aTopIcon false.
    const a = computeRealIndexV3(base({
      spotifyListeners: 100_000, spotifyFollowers: 40_000, // ratio 0,4 ≥ 0,333 (conversão topicon)
      igEngagement: 0, tiktokEngagement: 0, youtubeEngagement: 0, showsPerMonth: 1, // eng/shows baixos
      fazBilheteria: true, pagantePct: '95-100', // pagante topicon
    }));
    expect(a.components.a.find((c) => c.key === 'conversion')!.topicon).toBe(true);
    expect(a.pattern.a).toBe(false);
    expect(a.dimTopIcon.a).toBe(false);
    // L: prêmio internacional mas sem plataforma → L não acende → lTopIcon false.
    const l = computeRealIndexV3(base({ premios: 5, editorialPlaylists: 0, radioAirplay: null }));
    expect(l.pattern.l).toBe(false);
    expect(l.dimTopIcon.l).toBe(false);
  });

  it('QA: modulador do E é exatamente 1,00 / 0,95 / 0,90 / 0,85', () => {
    const mod = (cnpj: boolean, emp: boolean) => computeRealIndexV3(base({ temCnpj: cnpj, temEmpresario: emp })).components.e.modulador;
    expect(mod(true, true)).toBe(1.0);
    expect(mod(true, false)).toBe(0.9);   // −0,10 empresário
    expect(mod(false, true)).toBe(0.95);  // −0,05 CNPJ
    expect(mod(false, false)).toBe(0.85); // −0,15
  });

  it('QA (propriedade): invariante §9.1 vale para 500 entradas aleatórias, com receita atravessando o corte', () => {
    const pick = <T,>(arr: readonly T[]) => arr[Math.floor(Math.random() * arr.length)];
    const tipos = ['imprensa', 'blogs', 'influenciadores', 'tv', 'youtube', 'podcasts'] as const;
    const portes = ['pequeno', 'medio', 'grande'] as const;
    for (let i = 0; i < 500; i++) {
      const ri = computeRealIndexV3(base({
        spotifyConnected: Math.random() < 0.85,
        spotifyListeners: pick([null, 0, 5_000, 90_000, 400_000, 3_000_000, 25_000_000]),
        igFollowers: pick([null, 0, 8_000, 120_000, 900_000]),
        tiktokFollowers: pick([null, 0, 8_000, 120_000, 900_000]),
        youtubeMonthlyViews: pick([null, 0, 40_000, 800_000, 9_000_000]),
        spotifyFollowers: pick([null, 0, 2_000, 18_000, 800_000]),
        igEngagement: pick([null, 0, 1, 3, 7]), tiktokEngagement: pick([null, 0, 5, 12]), youtubeEngagement: pick([null, 0, 2, 6]),
        editorialPlaylists: pick([null, 0, 1, 9]), radioAirplay: pick([null, 0, 5, 300]),
        // receita varrendo a faixa do corte (R$11.250) p/ exercitar o arredondamento.
        showsPerMonth: Math.floor(Math.random() * 40), cache: Math.floor(Math.random() * 6000),
        faturamentoForaShows: Math.floor(Math.random() * 60000),
        investimento: Math.floor(Math.random() * 120000),
        temCnpj: Math.random() < 0.5, temEmpresario: Math.random() < 0.5,
        premios: Math.floor(Math.random() * 6),
        imprensaRepercussao: Math.random() < 0.6,
        imprensaMatrix: Array.from({ length: Math.floor(Math.random() * 4) }, () => ({ tipo: pick(tipos), porte: pick(portes) })),
        imprensaFrequencia: pick(['esporadico', 'lancamento', 'perene'] as const),
        fazBilheteria: Math.random() < 0.5, pagantePct: pick([null, 'ate50', '51-69', '70-94', '95-100'] as const),
      }));
      (['r', 'e', 'a', 'l'] as const).forEach((k) => {
        expect(ri.boletim[k]).toBeGreaterThanOrEqual(0);
        expect(ri.boletim[k]).toBeLessThanOrEqual(100);
        // invariante: aceso ⟺ nota ≥ 70.
        expect(ri.boletim[k] >= 70).toBe(ri.pattern[k]);
      });
      // perfil sempre resolve p/ um dos 16.
      expect(ri.profile.name).toBeTruthy();
    }
  });
});
