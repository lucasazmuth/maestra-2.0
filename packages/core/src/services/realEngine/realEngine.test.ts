import {
  boletimDoE, computeRealIndexV4, escala, faixaDe, medioDaFaixa, CUTS, FONTES_DE_RECEITA,
  FAIXAS_DE_SALDO, FAIXAS_POR_SHOW, FAIXAS_ANUAIS, FAIXAS_DE_FIXO,
} from './index';
import type { Faixa } from './index';
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

  // ⚠️ O CASO QUE AMPLIAVA PREJUÍZO.
  //
  // Multiplicar saldo negativo pelo bônus deixava quem tem CNPJ e empresário com um resultado
  // PIOR do que quem não tem. Um caso real saiu de −2,79 mi para −3,63 mi, e o número ia impresso
  // no relatório.
  //
  // A nota do boletim não denunciava nada: saldo ≤ 0 vale 0 com ou sem bônus. Só a exibição
  // mentia, e é por isso que isto atravessou a implementação sem ninguém tropeçar.
  it('o bônus não amplia prejuízo: só incide sobre saldo positivo (§7.2)', () => {
    const noVermelho = { showsPerYear: 0, custoFixoMensal: 100_000 };   // saldo de −1,2 mi
    const semEstrutura = computeRealIndexV4(base({ ...noVermelho }));
    const comEstrutura = computeRealIndexV4(base({ ...noVermelho, temCnpj: true, temEmpresario: true }));

    expect(semEstrutura.revenue.saldo).toBe(-1_200_000);
    expect(comEstrutura.revenue.bonus).toBe(1.3);
    // O bônus foi calculado, e não foi aplicado: o ajustado é o próprio saldo.
    expect(comEstrutura.revenue.saldoAjustado).toBe(-1_200_000);
    expect(comEstrutura.revenue.saldoAjustado).toBe(semEstrutura.revenue.saldoAjustado);
  });

  it('sobre saldo positivo o bônus continua valendo (§7.2)', () => {
    const comEstrutura = computeRealIndexV4(base({ ...E_ON, temCnpj: true, temEmpresario: true }));

    expect(comEstrutura.revenue.saldo).toBe(150_000);
    expect(comEstrutura.revenue.saldoAjustado).toBe(195_000);          // 150k × 1,3
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

  // ⚠️ A NOTA NUNCA CONTRADIZ O ACESO, MESMO QUANDO O NÚMERO DELA DIZ O CONTRÁRIO.
  //
  // A v4.5 separa as duas leituras do saldo: a decisão de acender olha o PISO da faixa e a nota
  // olha o PONTO MÉDIO (§7.2). Isso abre um caso que hoje ainda não se alcança pelo quiz, e que
  // é real: faixa de R$ 6 a 10 mil por mês, com CNPJ e empresário. O piso dá 72.000 × 1,3 =
  // 93.600, que não acende; o ponto médio dá 96.000 × 1,3 = 124.800, que sozinho valeria 71.
  //
  // Apagada com 71 quebra a invariante do §11.1 e derruba o teste de propriedade lá embaixo. Quem
  // cede é a nota. Por isso `boletimDoE` recebe o aceso em vez de o deduzir do valor — e por isso
  // este teste chama a função direto: é a única forma de exercitar a divergência antes de as
  // faixas existirem.
  describe('§11.1 · a nota do E cede à leitura binária', () => {
    it('apagada trava em 69, mesmo com o ponto médio acima do corte', () => {
      expect(boletimDoE(124_800, false)).toBe(69);
    });

    it('acesa nunca cai abaixo de 70, mesmo com o ponto médio abaixo do corte', () => {
      expect(boletimDoE(93_600, true)).toBe(70);
    });

    // E onde os dois concordam, a curva do §7.4 continua exatamente a mesma.
    it.each([
      [0, false, 0],
      [60_000, false, 35],
      [119_999, false, 69],
      [120_000, true, 70],
      [1_200_000, true, 100],
      [12_000_000, true, 100],
    ])('saldo %s aceso=%s dá nota %s', (saldo, aceso, nota) => {
      expect(boletimDoE(saldo as number, aceso as boolean)).toBe(nota);
    });
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

// ════════ §3.2 · as faixas de valor ════════
//
// A v4.5 parou de pedir dinheiro digitado: o artista escolhe uma faixa, e o motor lê dois números
// dela. O piso decide se acende, o ponto médio dá a nota (§7.2).
describe('§3.2 faixas de valor', () => {
  const TABELAS: [string, readonly Faixa[], number][] = [
    ['saldo', FAIXAS_DE_SALDO, 9],
    ['por show', FAIXAS_POR_SHOW, 9],
    ['anuais', FAIXAS_ANUAIS, 8],
    ['fixo', FAIXAS_DE_FIXO, 7],
  ];

  it.each(TABELAS)('a escala de %s tem as faixas que a spec manda', (_nome, tabela, quantas) => {
    expect(tabela).toHaveLength(quantas);
  });

  // ⚠️ ESTA É A PROMESSA DO §3.2, E É O MOTIVO DE AS FAIXAS TEREM ESTAS BORDAS.
  //
  // "Os cortes do E (120 mil e 1,2 milhão) são bordas de faixa por desenho: acender e Top Tier
  // ficam exatos." Se alguém recalibrar um corte sem mexer na faixa correspondente, a decisão
  // passa a ter arredondamento e a frase acima vira mentira. Este teste é o que impede.
  it('os pisos das faixas 6 e 8 do saldo SÃO os cortes do E', () => {
    expect(FAIXAS_DE_SALDO[6].piso).toBe(CUTS.e.saldoAcende);
    expect(FAIXAS_DE_SALDO[8].piso).toBe(CUTS.e.saldoTopIcon);
  });

  it.each(TABELAS)('a escala de %s não anda para trás', (_nome, tabela) => {
    for (let i = 1; i < tabela.length; i += 1) {
      expect(tabela[i].piso).toBeGreaterThanOrEqual(tabela[i - 1].piso);
      expect(tabela[i].medio).toBeGreaterThan(tabela[i - 1].medio);
    }
  });

  it.each(TABELAS)('na escala de %s, o ponto médio nunca fica abaixo do piso', (_nome, tabela) => {
    for (const f of tabela) expect(f.medio).toBeGreaterThanOrEqual(f.piso);
  });

  it.each(TABELAS)('toda faixa de %s tem rótulo e frase, e são diferentes de vazio', (_nome, tabela) => {
    for (const f of tabela) {
      expect(f.rotulo.trim().length).toBeGreaterThan(0);
      expect(f.naFrase.trim().length).toBeGreaterThan(0);
    }
  });

  // O −1 é marcador, não dinheiro: é o que distingue "gastei mais do que ganhei" de "empatou",
  // que decidem igual (nenhum acende) e pontuam igual (nota 0), mas dizem coisas diferentes.
  it('só a primeira faixa do saldo é negativa, e a segunda é o zero', () => {
    expect(FAIXAS_DE_SALDO[0].piso).toBe(-1);
    expect(FAIXAS_DE_SALDO[0].medio).toBe(-1);
    expect(FAIXAS_DE_SALDO[1].piso).toBe(0);
    expect(FAIXAS_DE_SALDO[1].medio).toBe(0);
  });

  // ⚠️ `null` E NÃO ZERO: quem chama encadeia com os reais que os builds já publicados mandam.
  // Um zero aqui desligava o `??` e zerava o saldo de toda compilação antiga da loja.
  describe('índice fora da tabela', () => {
    it.each([[-1], [99], [1.5], [null], [undefined], ['3'], [NaN]])(
      'o índice %p não é faixa nenhuma',
      (i) => {
        expect(faixaDe(FAIXAS_DE_SALDO, i)).toBeNull();
        expect(medioDaFaixa(FAIXAS_DE_SALDO, i)).toBeNull();
      },
    );

    it('e um índice válido devolve o ponto médio', () => {
      expect(medioDaFaixa(FAIXAS_DE_SALDO, 6)).toBe(210_000);
      expect(medioDaFaixa(FAIXAS_POR_SHOW, 4)).toBe(3_500);
      expect(medioDaFaixa(FAIXAS_ANUAIS, 3)).toBe(12_500);
      expect(medioDaFaixa(FAIXAS_DE_FIXO, 5)).toBe(20_000);
    });

    // O zero é faixa legítima, e distingue-se da ausência.
    it('a faixa "nada" devolve zero, que não é a mesma coisa que null', () => {
      expect(medioDaFaixa(FAIXAS_POR_SHOW, 0)).toBe(0);
      expect(medioDaFaixa(FAIXAS_POR_SHOW, 0)).not.toBeNull();
    });
  });
});

// ════════ §3.2 + §7.2 · os dois caminhos do E ════════
//
// A v4.5 pergunta o saldo em faixa. Quem sabe o número responde e acabou (caminho DIRETO); quem
// não sabe pede ajuda e detalha parcela a parcela (caminho DETALHADO). O motor não recebe bandeira
// nenhuma: é a PRESENÇA da faixa de saldo que decide, porque quem detalha não responde QE.2.
describe('§3.2 os dois caminhos do E', () => {
  const direto = (i: number, over: Partial<RealInputsV4> = {}) =>
    computeRealIndexV4(base({ saldoFaixa: i, ...over }));

  it('sem faixa de saldo o caminho é detalhado, e o saldo é a soma das parcelas', () => {
    const ri = computeRealIndexV4(base(E_ON));
    expect(ri.revenue.caminho).toBe('detalhado');
    expect(ri.revenue.saldoMedio).toBe(150_000);
    // No detalhado não há faixa, então piso e ponto médio são o mesmo número: não há intervalo.
    expect(ri.revenue.saldoPiso).toBe(ri.revenue.saldoMedio);
    expect(ri.revenue.saldoFaixa).toBeNull();
  });

  it('com faixa de saldo o caminho é direto, e lê piso e ponto médio DELA', () => {
    const ri = direto(6);
    expect(ri.revenue.caminho).toBe('direto');
    expect(ri.revenue.saldoFaixa).toBe(6);
    expect(ri.revenue.saldoPiso).toBe(120_000);
    expect(ri.revenue.saldoMedio).toBe(210_000);
  });

  // ⚠️ A FAIXA DE SALDO MANDA NO DETALHAMENTO INTEIRO, e não se soma a ele.
  // Quem respondeu QE.2 nunca viu as perguntas D. Se as duas coisas chegassem juntas — um payload
  // remontado, um "voltar" mal implementado —, somá-las dobrava o saldo de alguém.
  it('a faixa de saldo ignora o detalhamento que venha junto', () => {
    const so = direto(4);
    const comLixo = direto(4, { ...E_ON, custoFixoMensal: 90_000, investLancamentos12m: 400_000 });
    expect(comLixo.revenue.saldoMedio).toBe(so.revenue.saldoMedio);
    expect(comLixo.boletim.e).toBe(so.boletim.e);
    expect(comLixo.pattern.e).toBe(so.pattern.e);
  });

  // ⚠️ A DECISÃO É DO PISO E A NOTA É DO PONTO MÉDIO (§7.2), e este é o caso em que os dois
  // discordam: faixa 5 (R$ 6 a 10 mil/mês) com CNPJ e empresário. Piso 72.000 × 1,3 = 93.600, que
  // não acende; ponto médio 96.000 × 1,3 = 124.800, que sozinho valeria 71. Quem cede é a nota.
  it('a faixa 5 com estrutura NÃO acende, e a nota trava em 69', () => {
    const ri = direto(5, { temCnpj: true, temEmpresario: true });
    expect(ri.revenue.saldoPisoAjustado).toBe(93_600);
    expect(ri.revenue.saldoMedioAjustado).toBe(124_800);
    expect(ri.pattern.e).toBe(false);
    expect(ri.boletim.e).toBe(69);
  });

  // E a borda é exata justamente porque o piso da faixa 6 É o corte (§3.2).
  it('a faixa 6 acende no osso, sem estrutura nenhuma', () => {
    const ri = direto(6);
    expect(ri.revenue.saldoPisoAjustado).toBe(CUTS.e.saldoAcende);
    expect(ri.pattern.e).toBe(true);
    // E a nota já sai acima de 70, porque é do ponto médio (210 mil) e não do piso.
    expect(ri.boletim.e).toBe(77);
  });

  it('a faixa 8 é Top Tier no osso, pelo mesmo desenho', () => {
    const ri = direto(8);
    expect(ri.dimTopIcon.e).toBe(true);
    expect(ri.boletim.e).toBe(100);
  });

  // O −1 da faixa 0 é sentinela, não dinheiro: o bónus não pode multiplicá-lo para lugar nenhum,
  // e a nota é a mesma do empate. O que os separa é o que o relatório diz, não o índice.
  it.each([[0], [1]])('a faixa %i não acende e vale zero', (i) => {
    const ri = direto(i as number, { temCnpj: true, temEmpresario: true });
    expect(ri.pattern.e).toBe(false);
    expect(ri.boletim.e).toBe(0);
    expect(ri.revenue.saldoMedioAjustado).toBe(i === 0 ? -1 : 0);
  });
});

// ════════ §3.2 · a costura da compatibilidade ════════
//
// ⚠️ ISTO NÃO É ZELO: as compilações iOS já publicadas mandam o E em REAIS e vão continuar a
// mandá-lo durante meses, porque não há como as atualizar à força. A edge é partilhada, então no
// instante do deploy elas passam todas a correr este motor. Não há tradutor de payload de
// propósito — inventar um índice de faixa a partir de um valor digitado mudaria o diagnóstico de
// quem escreveu o número exato. A costura é POR PARCELA: faixa quando existe, reais quando não.
describe('§3.2 o motor continua a ler reais', () => {
  // Um payload v4.2 inteiro, sem uma única faixa. É o que a loja manda hoje.
  const V42: Partial<RealInputsV4> = {
    showsPerYear: 50,
    cacheByType: { corporativos: 5_000, particulares: 3_000 },
    revenueSources: { distribuidora: 8_000, outras: 2_000 },
    custoPorShow: 1_000, custoFixoMensal: 2_000, investLancamentos12m: 30_000,
  };

  // Este teste morre se `medioDaFaixa` devolver 0 em vez de `null`: o `??` do `ouOsReais` deixa
  // de disparar, toda parcela vira zero e o saldo de todo build publicado desaba para −24.000.
  it('um payload v4.2 puro dá os mesmos números de sempre', () => {
    const ri = computeRealIndexV4(base(V42));
    expect(ri.revenue.receitaShows).toBe(200_000);       // 50 × (5.000 + 3.000) / 2
    expect(ri.revenue.receitaOutrasTotal).toBe(10_000);
    expect(ri.revenue.custoShowsAnual).toBe(50_000);
    expect(ri.revenue.custoFixoAnual).toBe(24_000);
    expect(ri.revenue.saldoMedio).toBe(106_000);
    expect(ri.revenue.caminho).toBe('detalhado');
    expect(ri.revenue.emFaixas).toBe(false);
  });

  // A costura é por parcela, e não por payload: nada obriga as sete a chegarem juntas.
  it.each([
    ['custoShowFaixa', { custoShowFaixa: 3 }, 'custoShowsAnual', 75_000],
    ['fixoFaixa', { fixoFaixa: 4 }, 'custoFixoAnual', 78_000],
    ['lancFaixa', { lancFaixa: 4 }, 'investLancamentos12m', 35_000],
    ['outrasFaixa', { outrasFaixa: 3 }, 'receitaOutrasTotal', 12_500],
  ])('a faixa de %s ganha dos reais, e as outras parcelas seguem em reais', (_nome, faixa, campo, esperado) => {
    const ri = computeRealIndexV4(base({ ...V42, ...(faixa as Partial<RealInputsV4>) }));
    expect((ri.revenue as unknown as Record<string, number>)[campo as string]).toBe(esperado);
    expect(ri.revenue.receitaShows).toBe(200_000);       // esta não mudou em nenhum dos casos
    expect(ri.revenue.emFaixas).toBe(true);
  });

  // A faixa única de cachê (QD.1) é a média que o artista estimou de cabeça, e o §7.2 manda o
  // detalhe por tipo valer mais. Então ela só entra quando não há tipo nenhum informado.
  it('a faixa única de cachê entra quando nenhum tipo foi informado', () => {
    const ri = computeRealIndexV4(base({ ...V42, cacheByType: {}, cacheFaixa: 4 }));
    expect(ri.revenue.receitaShows).toBe(175_000);
    expect(ri.revenue.emFaixas).toBe(true);
  });

  it('e perde para o detalhe por tipo, que é mais específico', () => {
    const ri = computeRealIndexV4(base({ ...V42, cacheFaixa: 4 }));
    expect(ri.revenue.receitaShows).toBe(200_000);
  });

  it('o cachê por tipo em faixa ganha do cachê por tipo em reais', () => {
    const ri = computeRealIndexV4(base({ ...V42, cacheByTypeFaixa: { corporativos: 6 } }));
    expect(ri.revenue.receitaShows).toBe((17_500 + 3_000) / 2 * 50);
  });

  it('a fonte em faixa ganha da fonte em reais, e "não sei" sobrevive à travessia', () => {
    const ri = computeRealIndexV4(base({
      ...V42,
      outrasPorFonteFaixa: { distribuidora: 4, editora: 'nao_sei' },
    }));
    expect(ri.revenue.receitaOutrasTotal).toBe(35_000);
    expect(ri.flags.naoSeiFontes).toEqual(['editora']);
  });

  // `emFaixas` é o que decide o rótulo "cerca de" no relatório (F23). Chamar de "cerca de" um
  // número que a pessoa digitou é uma mentira pequena, mas é uma mentira.
  it('o caminho direto é sempre em faixas, por definição', () => {
    expect(computeRealIndexV4(base({ saldoFaixa: 3 })).revenue.emFaixas).toBe(true);
  });

  // E um índice de lixo numa fonte não pode abrir o caminho por fonte: abriria-o zerando as
  // outras oito em silêncio, e o artista perdia a receita que tinha declarado.
  it('um índice de lixo numa fonte não abre o caminho por fonte', () => {
    const ri = computeRealIndexV4(base({
      ...V42,
      outrasPorFonteFaixa: { distribuidora: 99 },
    }));
    expect(ri.revenue.receitaOutrasTotal).toBe(10_000);
    expect(ri.revenue.emFaixas).toBe(false);
  });

  it('um índice de faixa inválido não conta como faixa, e cai nos reais', () => {
    const ri = computeRealIndexV4(base({ ...V42, cacheFaixa: 99 }));
    expect(ri.revenue.receitaShows).toBe(200_000);
    expect(ri.revenue.emFaixas).toBe(false);
  });
});
