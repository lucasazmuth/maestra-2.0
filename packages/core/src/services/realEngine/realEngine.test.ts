import { computeRealIndexV4, escala, CUTS, FONTES_DE_RECEITA } from './index';
import type { RealInputsV4, PaganteFaixa } from './index';

// Base "zerada": nada acende. Cada teste liga só o que quer medir.
const base = (over: Partial<RealInputsV4> = {}): RealInputsV4 => ({
  spotifyConnected: true,
  spotifyListeners: null, igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null,
  spotifyFollowers: null, deezerFans: null,
  igEngagement: null, tiktokEngagement: null, youtubeEngagement: null,
  editorialPlaylists: null, radioAirplay180d: null,
  igFollowersSelf: null, tiktokFollowersSelf: null, youtubeViews28dSelf: null,
  showsPerYear: 0, cacheByType: {}, revenueSources: {},
  custoPorShow: 0, custoFixoMensal: 0, investLancamentos12m: 0,
  temCnpj: false, aliquota: null, temEmpresario: false,
  fazBilheteria: false, pagantePct: null,
  premios: 0, imprensaRepercussao: false, imprensaMatrix: [], imprensaFrequencia: 'lancamento',
  ...over,
});

// Cortes práticos do §6.3: ouvintes ≈785 mil, seguidores 100 mil, vídeo 1 milhão.
const R_ON: Partial<RealInputsV4> = { spotifyListeners: 1_000_000, igFollowers: 150_000, tiktokFollowers: 150_000, youtubeMonthlyViews: 2_000_000 };
const E_ON: Partial<RealInputsV4> = { showsPerYear: 50, cacheByType: { produtores: 3_000 } };            // 150k de saldo
const A_ON: Partial<RealInputsV4> = { spotifyListeners: 100_000, spotifyFollowers: 30_000, showsPerYear: 50, fazBilheteria: true, pagantePct: '70-94' };
const L_ON: Partial<RealInputsV4> = { premios: 3, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'imprensa', porte: 'grande' }], imprensaFrequencia: 'perene', editorialPlaylists: 3 };
// R e A disputam o mesmo campo (ouvintes): R exige ≥785 mil, e a conversão de A é medida sobre
// esse mesmo número. Um caso 1111 precisa dos dois satisfeitos de uma vez.
const TUDO_ON: Partial<RealInputsV4> = { ...R_ON, ...E_ON, ...L_ON, spotifyFollowers: 300_000, showsPerYear: 50, fazBilheteria: true, pagantePct: '70-94' };

describe('§5.1 escala — interpolação logarítmica ancorada', () => {
  const { social, listeners } = CUTS.r;

  it('devolve exatamente zs[i+1] em cada borda (teste obrigatório §13.3)', () => {
    social.edges.forEach((edge, i) => {
      expect(escala(edge, social)).toBeCloseTo(social.zs[i + 1], 10);
    });
    listeners.edges.forEach((edge, i) => {
      expect(escala(edge, listeners)).toBeCloseTo(listeners.zs[i + 1], 10);
    });
  });

  it('abaixo da primeira borda é piso, acima da última é teto', () => {
    expect(escala(1, social)).toBe(social.zs[0]);
    expect(escala(999, social)).toBe(social.zs[0]);
    expect(escala(1e9, social)).toBe(social.zs[social.zs.length - 1]);
  });

  it('trata nulo, zero e negativo como AUSENTE', () => {
    expect(escala(null, social)).toBeNull();
    expect(escala(0, social)).toBeNull();
    expect(escala(-5, social)).toBeNull();
  });

  it('é estritamente crescente dentro de uma faixa (a v3 dava degraus)', () => {
    const a = escala(120_000, social)!;
    const b = escala(500_000, social)!;
    expect(b).toBeGreaterThan(a);
    expect(a).toBeGreaterThan(escala(100_000, social)!);
  });

  it('reproduz os cortes práticos do §6.3', () => {
    // social e vídeo acendem/gabaritam exatamente nas âncoras
    expect(escala(100_000, social)).toBeCloseTo(CUTS.HIGH_Z, 10);
    expect(escala(1_000_000, social)).toBeCloseTo(CUTS.TOPICON_Z, 10);
    expect(escala(1_000_000, CUTS.r.video)).toBeCloseTo(CUTS.HIGH_Z, 10);
    expect(escala(10_000_000, CUTS.r.video)).toBeCloseTo(CUTS.TOPICON_Z, 10);
    // ouvintes: os cortes caem da interpolação, ≈785 mil e ≈4,5 milhões
    expect(escala(785_000, listeners)!).toBeCloseTo(CUTS.HIGH_Z, 2);
    expect(escala(4_491_000, listeners)!).toBeCloseTo(CUTS.TOPICON_Z, 2);
  });
});

describe('§6 R · Reach', () => {
  it('acende com os presentes acima do corte', () => {
    expect(computeRealIndexV4(base(R_ON)).pattern.r).toBe(true);
  });

  it('não acende com um componente abaixo — R é não compensatório', () => {
    expect(computeRealIndexV4(base({ ...R_ON, youtubeMonthlyViews: 50_000 })).pattern.r).toBe(false);
  });

  it('exige no mínimo 2 componentes presentes (§6.4)', () => {
    const soUm = computeRealIndexV4(base({ spotifyListeners: 20_000_000 }));
    expect(soUm.flags.rComponentesInsuficientes).toBe(true);
    expect(soUm.pattern.r).toBe(false);
    const dois = computeRealIndexV4(base({ spotifyListeners: 20_000_000, igFollowers: 5_000_000 }));
    expect(dois.flags.rComponentesInsuficientes).toBe(false);
    expect(dois.pattern.r).toBe(true);
  });

  it('canal ausente sai da conta; canal presente e ruim continua contando (§4)', () => {
    const semYoutube = computeRealIndexV4(base({ spotifyListeners: 1_000_000, igFollowers: 150_000, tiktokFollowers: 150_000 }));
    expect(semYoutube.pattern.r).toBe(true);
    expect(semYoutube.flags.rComponentesAusentes).toEqual(['videoViews']);
    const youtubeRuim = computeRealIndexV4(base({ ...semYoutube.raw, youtubeMonthlyViews: 20_000 }));
    expect(youtubeRuim.pattern.r).toBe(false);
  });

  it('sem Spotify, ouvintes ficam no piso: presente e baixo, R não acende (§4)', () => {
    const ri = computeRealIndexV4(base({ spotifyConnected: false, igFollowersSelf: 5_000_000, tiktokFollowersSelf: 5_000_000, youtubeViews28dSelf: 50_000_000 }));
    expect(ri.components.r[0].present).toBe(true);
    expect(ri.components.r[0].z).toBe(CUTS.r.listeners.zs[0]);
    expect(ri.pattern.r).toBe(false);
  });

  it('usa a autodeclaração quando a API não trouxe, com proveniência (§4)', () => {
    const ri = computeRealIndexV4(base({ igFollowers: null, igFollowersSelf: 200_000, tiktokFollowers: 90_000 }));
    expect(ri.inputs.igFollowers).toEqual({ value: 200_000, source: 'self' });
    expect(ri.inputs.tiktokFollowers.source).toBe('api');
    expect(ri.flags.autodeclarados).toContain('igFollowers');
  });

  it('zero autodeclarado significa "não tenho essa rede", não zero seguidores (§3.2)', () => {
    const ri = computeRealIndexV4(base({ igFollowersSelf: 0, tiktokFollowersSelf: 150_000, youtubeViews28dSelf: 2_000_000, spotifyListeners: 1_000_000 }));
    expect(ri.inputs.igFollowers.source).toBe('absent');
    expect(ri.pattern.r).toBe(true);   // o IG ausente sai da média do componente social
  });
});

describe('§7 E · Earnings', () => {
  it('mede SALDO anual, não receita', () => {
    const semInvestimento = computeRealIndexV4(base(E_ON));
    expect(semInvestimento.revenue.receitaAnual).toBe(150_000);
    expect(semInvestimento.pattern.e).toBe(true);
    const comInvestimento = computeRealIndexV4(base({ ...E_ON, investLancamentos12m: 60_000 }));
    expect(comInvestimento.revenue.saldo).toBe(90_000);
    expect(comInvestimento.pattern.e).toBe(false);
  });

  it('estrutura é BÔNUS, nunca desconto (§7.2)', () => {
    const b = (cnpj: boolean, emp: boolean) => computeRealIndexV4(base({ temCnpj: cnpj, temEmpresario: emp })).revenue.bonus;
    expect(b(false, false)).toBe(1);
    expect(b(true, false)).toBe(1.1);
    expect(b(false, true)).toBe(1.2);
    expect(b(true, true)).toBe(1.3);
  });

  it('receita de shows usa a média dos cachês informados (§7.2)', () => {
    const ri = computeRealIndexV4(base({ showsPerYear: 10, cacheByType: { corporativos: 5_000, particulares: 3_000, produtores: 0 } }));
    expect(ri.revenue.cacheMedio).toBe(4_000);
    expect(ri.revenue.receitaShows).toBe(40_000);
  });

  it('sem nenhum cachê informado, a receita de shows é zero', () => {
    expect(computeRealIndexV4(base({ showsPerYear: 40 })).revenue.receitaShows).toBe(0);
  });

  it('"não sei" conta zero e sinaliza (§4)', () => {
    const ri = computeRealIndexV4(base({ revenueSources: { distribuidora: 8_000, editora: 'nao_sei', associacao: 'nao_sei' } }));
    expect(ri.revenue.receitaOutrasTotal).toBe(8_000);
    expect(ri.flags.naoSeiFontes).toEqual(['editora', 'associacao']);
    expect(ri.revenue.receitaOutras.editora).toEqual({ valor: 0, naoSei: true });
  });

  it('soma as 9 fontes', () => {
    const todas = Object.fromEntries(FONTES_DE_RECEITA.map((f) => [f, 1_000]));
    expect(computeRealIndexV4(base({ revenueSources: todas })).revenue.receitaOutrasTotal).toBe(9_000);
  });

  it('acende exatamente em R$ 120 mil de saldo ajustado (§7.2)', () => {
    const em = (v: number) => computeRealIndexV4(base({ revenueSources: { outras: v } })).pattern.e;
    expect(em(119_999)).toBe(false);
    expect(em(120_000)).toBe(true);
  });

  it('soma as três parcelas do investimento (§7.2, v4.1)', () => {
    const ri = computeRealIndexV4(base({
      showsPerYear: 20, cacheByType: { produtores: 5_000 },
      custoPorShow: 1_200, custoFixoMensal: 800, investLancamentos12m: 30_000,
    }));
    expect(ri.revenue.custoShowsAnual).toBe(24_000);   // 1.200 × 20
    expect(ri.revenue.custoFixoAnual).toBe(9_600);     // 800 × 12
    expect(ri.revenue.investimentoAnual).toBe(63_600); // 24.000 + 9.600 + 30.000
    expect(ri.revenue.saldo).toBe(36_400);             // 100.000 de receita − 63.600
  });

  it('o custo por show multiplica os MESMOS shows que o cachê', () => {
    // É isso que torna margem e ponto de equilíbrio comparáveis: as duas contas andam sobre a
    // mesma agenda. Dobrar os shows dobra receita e custo de show, e o fixo não se move.
    const um = computeRealIndexV4(base({ showsPerYear: 10, cacheByType: { produtores: 3_000 }, custoPorShow: 1_000, custoFixoMensal: 500 }));
    const dois = computeRealIndexV4(base({ showsPerYear: 20, cacheByType: { produtores: 3_000 }, custoPorShow: 1_000, custoFixoMensal: 500 }));
    expect(dois.revenue.receitaShows).toBe(um.revenue.receitaShows * 2);
    expect(dois.revenue.custoShowsAnual).toBe(um.revenue.custoShowsAnual * 2);
    expect(dois.revenue.custoFixoAnual).toBe(um.revenue.custoFixoAnual);
  });

  it('margem por show e ponto de equilíbrio (§7.5)', () => {
    const ri = computeRealIndexV4(base({
      showsPerYear: 12, cacheByType: { casasDeShow: 2_000 },
      custoPorShow: 800, custoFixoMensal: 150,
    }));
    expect(ri.revenue.margemPorShow).toBe(1_200);       // 2.000 − 800
    expect(ri.revenue.pontoEquilibrioShows).toBe(2);    // 1.800 de fixo ÷ 1.200, arredondado acima
  });

  it('sem margem positiva não há ponto de equilíbrio, e não um número enorme', () => {
    // Com o cachê abaixo do custo, nenhuma quantidade de shows cobre o fixo. Devolver um número
    // gigante seria pior que devolver nada: o relatório tem texto próprio para este caso.
    const ri = computeRealIndexV4(base({
      showsPerYear: 12, cacheByType: { casasDeShow: 800 }, custoPorShow: 1_000, custoFixoMensal: 500,
    }));
    expect(ri.revenue.margemPorShow).toBe(-200);
    expect(ri.revenue.pontoEquilibrioShows).toBeNull();
  });

  it('sem cachê informado não há margem: não há o que subtrair', () => {
    const ri = computeRealIndexV4(base({ showsPerYear: 12, custoPorShow: 1_000 }));
    expect(ri.revenue.margemPorShow).toBeNull();
    expect(ri.revenue.pontoEquilibrioShows).toBeNull();
  });

  it('sinaliza saldo negativo (§11.3.3)', () => {
    const ri = computeRealIndexV4(base({ revenueSources: { outras: 10_000 }, investLancamentos12m: 30_000 }));
    expect(ri.flags.saldoNegativo).toBe(true);
    expect(ri.boletim.e).toBe(0);
  });

  it('boletim: linear até 70, log até 100 (§7.4)', () => {
    const nota = (v: number) => computeRealIndexV4(base({ revenueSources: { outras: v } })).boletim.e;
    expect(nota(0)).toBe(0);
    expect(nota(60_000)).toBe(35);
    expect(nota(119_999)).toBe(69);
    expect(nota(120_000)).toBe(70);
    expect(nota(1_200_000)).toBe(100);
    expect(nota(12_000_000)).toBe(100);
    // meio geométrico dos dois cortes cai na metade da rampa log
    expect(nota(Math.round(120_000 * Math.sqrt(10)))).toBe(85);
  });

  it('impostos não entram no índice; a alíquota só alimenta a exibição (§7.2)', () => {
    const com = computeRealIndexV4(base({ ...E_ON, temCnpj: true, aliquota: '6-10' }));
    const sem = computeRealIndexV4(base({ ...E_ON, temCnpj: true, aliquota: 'nao_sei' }));
    expect(com.revenue.saldoAjustado).toBe(sem.revenue.saldoAjustado);
    expect(com.revenue.receitaLiquidaEstimada).toBe(138_000);
    expect(sem.revenue.receitaLiquidaEstimada).toBeNull();
  });
});

describe('§8 A · Audience', () => {
  it('acende com os três componentes altos', () => {
    expect(computeRealIndexV4(base(A_ON)).pattern.a).toBe(true);
  });

  it('não acende sem conversão presente (§8.3)', () => {
    const semSpotify = computeRealIndexV4(base({ ...A_ON, spotifyConnected: false }));
    expect(semSpotify.flags.conversaoAusente).toBe(true);
    expect(semSpotify.pattern.a).toBe(false);
  });

  it('conversão exige piso de 1.000 ouvintes (§8.1)', () => {
    const raso = computeRealIndexV4(base({ ...A_ON, spotifyListeners: 900, spotifyFollowers: 800 }));
    expect(raso.components.a[0].present).toBe(false);
    expect(raso.pattern.a).toBe(false);
  });

  it('circulação é ANUAL: 48 acende, 240 gabarita (§8.1)', () => {
    expect(computeRealIndexV4(base({ ...A_ON, showsPerYear: 47 })).pattern.a).toBe(false);
    expect(computeRealIndexV4(base({ ...A_ON, showsPerYear: 48 })).pattern.a).toBe(true);
    const top = computeRealIndexV4(base({ ...A_ON, showsPerYear: 240, spotifyFollowers: 40_000, pagantePct: '95-100' }));
    expect(top.dimTopIcon.a).toBe(true);
  });

  it('sem bilheteria é leitura BAIXA, não ausência: A não acende (§8.3)', () => {
    const ri = computeRealIndexV4(base({ ...A_ON, fazBilheteria: false, pagantePct: null }));
    expect(ri.components.a[2].present).toBe(true);
    expect(ri.components.a[2].high).toBe(false);
    expect(ri.pattern.a).toBe(false);
    expect(ri.flags.aSemBilheteria).toBe(true);
  });

  it('engajamento está suspenso: não entra no cálculo, só na exibição (§8.2)', () => {
    const semEng = computeRealIndexV4(base(A_ON));
    const comEngPessimo = computeRealIndexV4(base({ ...A_ON, igEngagement: 0.1, tiktokEngagement: 0.1, youtubeEngagement: 0.1 }));
    expect(comEngPessimo.pattern.a).toBe(semEng.pattern.a);
    expect(comEngPessimo.boletim.a).toBe(semEng.boletim.a);
    expect(comEngPessimo.components.a.map((c) => c.key)).toEqual(['conversion', 'shows', 'pagante']);
    expect(comEngPessimo.engagement.instagram).toEqual({ value: 0.1, cut: 2.8, above: false });
  });

  it('boletim por contagem sobre 3 componentes (§8.4)', () => {
    expect(computeRealIndexV4(base()).boletim.a).toBe(0);
    // só circulação alta
    expect(computeRealIndexV4(base({ showsPerYear: 60 })).boletim.a).toBe(23);
    expect(computeRealIndexV4(base(A_ON)).boletim.a).toBe(70);
  });
});

describe('§9 L · Legitimacy', () => {
  it('acende com nota e sinal de plataforma', () => {
    expect(computeRealIndexV4(base(L_ON)).pattern.l).toBe(true);
  });

  it('aceita o nível 6 de prêmios — a v3 cortava em 5 (§15)', () => {
    expect(CUTS.l.premiosMaxLevel).toBe(6);
    const ri = computeRealIndexV4(base({ premios: 6, editorialPlaylists: 1 }));
    expect(ri.components.l.premios.nota).toBe(1.0);
    expect(ri.components.l.premios.topicon).toBe(true);
  });

  it('trava de plataforma barra quem só tem autodeclaração (§9.6)', () => {
    const ri = computeRealIndexV4(base({ premios: 4, imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    expect(ri.components.l.notaL).toBeGreaterThanOrEqual(0.70);
    expect(ri.pattern.l).toBe(false);
    expect(ri.flags.travaL).toBe(true);
    expect(ri.boletim.l).toBe(69);
  });

  it('prêmio internacional é a exceção da trava (§9.6)', () => {
    const ri = computeRealIndexV4(base({ premios: 5, imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    expect(ri.components.l.sinalPlataforma).toBe(false);
    expect(ri.pattern.l).toBe(true);
    expect(ri.flags.travaL).toBe(false);
  });

  it('rádio com menos de 6 execuções é AUSENTE, não zero (§9.5)', () => {
    const poucas = computeRealIndexV4(base({ ...L_ON, radioAirplay180d: 5 }));
    const nenhuma = computeRealIndexV4(base({ ...L_ON, radioAirplay180d: null }));
    const muitas = computeRealIndexV4(base({ ...L_ON, radioAirplay180d: 6 }));
    expect(poucas.components.l.radio).toEqual({ bin: null, present: false });
    expect(poucas.components.l.notaL).toBe(nenhuma.components.l.notaL);
    expect(muitas.components.l.notaL).toBeGreaterThan(poucas.components.l.notaL);
  });

  it('pesos renormalizam para 0,375 / 0,375 / 0,25 sem rádio (§9.5)', () => {
    const ri = computeRealIndexV4(base({ premios: 6, imprensaRepercussao: false, editorialPlaylists: 0 }));
    expect(ri.components.l.notaL).toBe(0.38);   // 0,30 / 0,80 = 0,375, arredondado para exibição
  });

  it('playlist vazia é PRESENTE valendo zero; sem consulta é ausente (§4)', () => {
    const vazia = computeRealIndexV4(base({ premios: 6, editorialPlaylists: 0 }));
    const semConsulta = computeRealIndexV4(base({ premios: 6, editorialPlaylists: null }));
    expect(vazia.components.l.playlists).toEqual({ bin: 0, present: true });
    expect(semConsulta.components.l.playlists).toEqual({ bin: null, present: false });
    expect(semConsulta.components.l.notaL).toBeGreaterThan(vazia.components.l.notaL);
  });

  it('imprensa pega o MAIOR porte, e um veículo menor não baixa a nota (§9.3)', () => {
    const so = computeRealIndexV4(base({ imprensaRepercussao: true, imprensaFrequencia: 'lancamento', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    const mais = computeRealIndexV4(base({ imprensaRepercussao: true, imprensaFrequencia: 'lancamento', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }, { tipo: 'blogs', porte: 'pequeno' }] }));
    expect(mais.components.l.imprensa.nota).toBe(so.components.l.imprensa.nota);
    expect(so.components.l.imprensa.nota).toBe(1);
    // frequência perene não estoura o teto de 1,0
    expect(computeRealIndexV4(base({ imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] })).components.l.imprensa.nota).toBe(1);
  });
});

describe('§10 classificação e §13.1 persistência', () => {
  it('mapeia o padrão R.E.A.L nos 16 perfis', () => {
    expect(computeRealIndexV4(base()).profile.key).toBe('0000');
    expect(computeRealIndexV4(base()).profile.name).toBe('Beginner');
    expect(computeRealIndexV4(base(E_ON)).profile.key).toBe('0100');
    expect(computeRealIndexV4(base(A_ON)).profile.key).toBe('0010');
    expect(computeRealIndexV4(base(TUDO_ON)).profile.key).toBe('1111');
  });

  it('TOP ICON global exige as quatro dimensões em elite (§10)', () => {
    const quase = computeRealIndexV4(base(TUDO_ON));
    expect(quase.profile.key).toBe('1111');
    expect(quase.topIcon).toBe(false);
    const tudo = computeRealIndexV4(base({
      spotifyListeners: 20_000_000, igFollowers: 5_000_000, tiktokFollowers: 5_000_000, youtubeMonthlyViews: 50_000_000,
      spotifyFollowers: 8_000_000, showsPerYear: 240, cacheByType: { produtores: 20_000 },
      fazBilheteria: true, pagantePct: '95-100',
      premios: 6, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene',
      editorialPlaylists: 10, radioAirplay180d: 900,
    }));
    expect(tudo.topIcon).toBe(true);
    expect(tudo.boletim).toEqual({ r: 100, e: 100, a: 100, l: 100 });
  });

  it('grava versão, calibração, proveniência e flags (§13.1)', () => {
    const ri = computeRealIndexV4(base({ ...L_ON, igFollowersSelf: 5_000 }));
    expect(ri.version).toBe(4);
    expect(ri.calibrationVersion).toBe('2026.09');
    expect(ri.inputs.igFollowers).toEqual({ value: 5_000, source: 'self' });
    expect(Object.keys(ri.flags).sort()).toEqual([
      'aSemBilheteria', 'autodeclarados', 'conversaoAusente', 'naoSeiFontes',
      'rComponentesAusentes', 'rComponentesInsuficientes', 'saldoNegativo', 'travaL',
    ]);
    expect(ri.components.r.every((c) => 'present' in c)).toBe(true);
  });
});

describe('§11.1 invariante do boletim (teste de propriedade obrigatório §13.3)', () => {
  // Gerador determinístico: 500 entradas cruzando cada corte, sem depender de seed do runtime.
  let seed = 20260906;
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const escolha = <T,>(xs: readonly T[]): T => xs[Math.floor(rnd() * xs.length)];
  // Faixas centradas exatamente nos cortes, para que muitas amostras caiam em cima deles.
  const perto = (corte: number) => Math.round(corte * (0.5 + rnd() * 1.2));

  it('a nota nunca contradiz a leitura binária, em 500 entradas', () => {
    for (let i = 0; i < 500; i += 1) {
      const ri = computeRealIndexV4(base({
        spotifyConnected: rnd() > 0.1,
        spotifyListeners: escolha([null, perto(785_000), perto(4_491_000), perto(1_000)]),
        igFollowers: escolha([null, perto(100_000), perto(1_000_000)]),
        tiktokFollowers: escolha([null, perto(100_000), perto(1_000_000)]),
        youtubeMonthlyViews: escolha([null, perto(1_000_000), perto(10_000_000)]),
        spotifyFollowers: escolha([null, perto(25_000), perto(300_000)]),
        editorialPlaylists: escolha([null, 0, 1, 5]),
        radioAirplay180d: escolha([null, 0, 5, 6, 200]),
        showsPerYear: escolha([0, 47, 48, 239, 240, 300]),
        cacheByType: { produtores: perto(2_500) },
        revenueSources: { outras: escolha([0, perto(120_000), perto(1_200_000)]) },
        investimento: escolha([0, perto(50_000)]),
        temCnpj: rnd() > 0.5, temEmpresario: rnd() > 0.5,
        fazBilheteria: rnd() > 0.4,
        pagantePct: escolha(['ate50', '51-69', '70-94', '95-100'] as PaganteFaixa[]),
        premios: Math.floor(rnd() * 7),
        imprensaRepercussao: rnd() > 0.3,
        imprensaMatrix: [{ tipo: escolha(['imprensa', 'tv', 'blogs', 'podcasts'] as const), porte: escolha(['pequeno', 'medio', 'grande'] as const) }],
        imprensaFrequencia: escolha(['esporadico', 'lancamento', 'perene'] as const),
      }));
      for (const dim of ['r', 'e', 'a', 'l'] as const) {
        const nota = ri.boletim[dim];
        expect(Number.isInteger(nota)).toBe(true);
        expect(nota).toBeGreaterThanOrEqual(0);
        expect(nota).toBeLessThanOrEqual(100);
        // A invariante: acesa ⟺ nota ≥ 70. Nunca uma sem a outra.
        expect(nota >= 70).toBe(ri.pattern[dim]);
      }
    }
  });
});

const round2 = (n: number) => Math.round(n * 100) / 100;
