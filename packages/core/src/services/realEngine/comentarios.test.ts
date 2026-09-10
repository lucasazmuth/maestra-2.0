import { computeRealIndexV4 } from './index';
import type { RealInputsV4 } from './index';
import {
  comentariosDaDimensao, estagioDoBeginner, retratoDoPerfil, statusDaBarra,
} from './comentarios';
import { COMENTARIOS, FIXOS, LEITURAS_CURTAS, RETRATOS } from '../../constants/realTextos';
import { SIIC_ANUAL } from './relatorio';

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
const DIMS = ['r', 'e', 'a', 'l'] as const;
const ids = (ri: any, dim: any, superficie: 'tela' | 'pdf' = 'pdf') =>
  comentariosDaDimensao(ri, dim, { superficie }).map((c) => c.id);

// ⚠️ O BÔNUS DE ESTRUTURA É PONTUAÇÃO, E NÃO DINHEIRO (relatório v4.4, §1.3, §7.10, §12, §13).
//
// Ter CNPJ e ter empresário valem um bônus sobre o saldo positivo, e é assim que a dimensão E
// acende. Mas o valor inflado por esse bônus não é o que existe na conta bancária de ninguém, e
// o relatório não o exibe nem o usa em comparação exibida. A referência do setor cultural
// compara o SALDO REAL — porque um salário é líquido, e o que se compara com ele é o que sobra
// depois de a carreira pagar o que custou.
describe('§7.10 a referência do setor compara o saldo real', () => {
  /** Saldo real logo abaixo do salário anual do setor; com o bônus de 30%, acima dele. */
  const noLimite = () => computeRealIndexV4(base({
    showsPerYear: 15, cacheByType: { produtores: 3_200 },
    custoPorShow: 0, custoFixoMensal: 0, investLancamentos12m: 0,
    temCnpj: true, temEmpresario: true,
  }));

  it('o artista no limite recebe E8.b, e não E8.a', () => {
    const ri = noLimite();
    const rev: any = (ri as any).revenue;
    // O caso só prova alguma coisa se o bônus de facto atravessar a fronteira.
    expect(rev.saldo).toBeLessThan(SIIC_ANUAL);
    expect(rev.saldoAjustado).toBeGreaterThanOrEqual(SIIC_ANUAL);

    expect(ids(ri, 'e')).toContain('E8.b');
    expect(ids(ri, 'e')).not.toContain('E8.a');
  });

  // O texto do E8 diz "rendeu, líquido, {x}". Com o ajustado, o número seria maior do que a
  // conta do artista, e maior do que o card ao lado no mesmo PDF.
  it('o múltiplo escrito no texto é o do saldo real', () => {
    const ri = noLimite();
    const rev: any = (ri as any).revenue;
    const texto = comentariosDaDimensao(ri, 'e', { superficie: 'pdf' }).find((c) => c.id === 'E8.b')!.texto;
    const doAjustado = (rev.saldoAjustado / SIIC_ANUAL).toFixed(1).replace('.', ',');
    expect(texto).not.toContain(doAjustado);
  });
});

describe('§4 as três regras da seleção', () => {
  it('sai no máximo um comentário por grupo', () => {
    const ri = computeRealIndexV4(base({
      spotifyListeners: 200_000, igFollowers: 30_000, showsPerYear: 60,
      cacheByType: { produtores: 3_000 }, custoPorShow: 500, custoFixoMensal: 400,
      revenueSources: { distribuidora: 20_000, aulas: 15_000, publi: 12_000 },
      premios: 4, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
      imprensaFrequencia: 'perene', editorialPlaylists: 3, radioAirplay180d: 200,
      fazBilheteria: true, pagantePct: '70-94', temCnpj: true,
    }));
    for (const dim of DIMS) {
      const grupos = comentariosDaDimensao(ri, dim, { superficie: 'pdf' }).map((c) => c.grupo);
      expect(grupos).toEqual([...new Set(grupos)]);
    }
  });

  it('a tela corta em três; o PDF traz tudo', () => {
    const ri = computeRealIndexV4(base({
      spotifyListeners: 5_000, igFollowersSelf: 2_000, showsPerYear: 4,
      cacheByType: { casasDeShow: 500 }, custoPorShow: 900, custoFixoMensal: 300,
      revenueSources: { editora: 'nao_sei' }, premios: 2, imprensaRepercussao: true,
      imprensaMatrix: [{ tipo: 'blogs', porte: 'pequeno' }], imprensaFrequencia: 'esporadico',
    }));
    for (const dim of DIMS) {
      const tela = comentariosDaDimensao(ri, dim, { superficie: 'tela' });
      const pdf = comentariosDaDimensao(ri, dim, { superficie: 'pdf' });
      expect(tela.length).toBeLessThanOrEqual(3);
      expect(pdf.length).toBeGreaterThanOrEqual(tela.length);
    }
  });

  it('a tela respeita a prioridade da seção, não a ordem dos IDs', () => {
    const ri = computeRealIndexV4(base({ spotifyListeners: 5_000, igFollowersSelf: 2_000 }));
    const grupos = comentariosDaDimensao(ri, 'r', { superficie: 'tela' }).map((c) => c.grupo);
    expect(grupos).toEqual(['R1', 'R2', 'R3']);
  });

  it('no E, o "não sei" põe o E6 no lugar do E4 (§7)', () => {
    const semNaoSei = computeRealIndexV4(base({ revenueSources: { distribuidora: 5_000 } }));
    expect(ids(semNaoSei, 'e', 'tela')).toContain('E4.a');
    expect(ids(semNaoSei, 'e', 'tela')).not.toContain('E6');

    const comNaoSei = computeRealIndexV4(base({ revenueSources: { distribuidora: 5_000, editora: 'nao_sei' } }));
    const naTela = ids(comNaoSei, 'e', 'tela');
    expect(naTela).toContain('E6');
    expect(naTela).not.toContain('E4.a');
    // E o E4 não some do documento: ele continua no PDF.
    expect(ids(comNaoSei, 'e', 'pdf')).toContain('E4.a');
  });

  it('um diagnóstico de versão anterior não recebe comentário nenhum (§13.2)', () => {
    for (const dim of DIMS) expect(comentariosDaDimensao({ version: 3 }, dim)).toEqual([]);
    expect(retratoDoPerfil({ version: 3 })).toBeNull();
  });
});

describe('integridade entre texto e gatilho', () => {
  // Percorre um leque de diagnósticos e junta todo ID que algum gatilho chegou a disparar.
  const disparados = new Set<string>();
  const casos: Partial<RealInputsV4>[] = [
    {},
    { spotifyListeners: 20_000_000, igFollowers: 5_000_000, tiktokFollowers: 5_000_000, youtubeMonthlyViews: 50_000_000, spotifyFollowers: 8_000_000, showsPerYear: 240, cacheByType: { produtores: 20_000 }, fazBilheteria: true, pagantePct: '95-100', premios: 6, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene', editorialPlaylists: 10, radioAirplay180d: 900, temCnpj: true, temEmpresario: true },
    { spotifyListeners: 1_000_000, igFollowers: 2_000, youtubeMonthlyViews: 5_000 },
    { igFollowers: 200_000, spotifyListeners: 2_000, youtubeMonthlyViews: 5_000 },
    { spotifyListeners: 1_000_000, igFollowers: 150_000, youtubeMonthlyViews: 20_000 },
    { spotifyListeners: 800_000, igFollowersSelf: 120_000 },
    { spotifyListeners: 200_000, spotifyFollowers: 80_000, showsPerYear: 60, fazBilheteria: true, pagantePct: 'ate50' },
    { spotifyListeners: 200_000, spotifyFollowers: 10_000, showsPerYear: 60, fazBilheteria: true, pagantePct: '95-100' },
    { spotifyListeners: 200_000, spotifyFollowers: 10_000, showsPerYear: 4, fazBilheteria: true, pagantePct: '95-100' },
    { spotifyListeners: 200_000, spotifyFollowers: 10_000, showsPerYear: 4, fazBilheteria: true, pagantePct: 'ate50' },
    { showsPerYear: 20, cacheByType: { produtores: 5_000 }, custoPorShow: 1_000, custoFixoMensal: 800, investLancamentos12m: 30_000 },
    { showsPerYear: 20, cacheByType: { produtores: 500 }, custoPorShow: 900, custoFixoMensal: 5_000 },
    { showsPerYear: 10, cacheByType: { corporativos: 9_000, casasDeShow: 1_000 }, custoPorShow: 200 },
    { showsPerYear: 10, cacheByType: { corporativos: 1_000, casasDeShow: 950 }, custoPorShow: 200 },
    { revenueSources: { distribuidora: 100_000 } },
    { revenueSources: { distribuidora: 30_000, aulas: 30_000 } },
    { revenueSources: { distribuidora: 30_000, aulas: 30_000, publi: 30_000 } },
    { revenueSources: { editora: 'nao_sei', aulas: 'nao_sei' } },
    { showsPerYear: 10, cacheByType: { produtores: 200_000 }, temCnpj: true, temEmpresario: true },
    { temEmpresario: true },
    { premios: 5, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene' },
    { premios: 2, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'blogs', porte: 'medio' }], imprensaFrequencia: 'lancamento' },
    { premios: 3, editorialPlaylists: 0, radioAirplay180d: 0 },
    { editorialPlaylists: 5, radioAirplay180d: 300 },
    { spotifyListeners: 200_000, spotifyFollowers: 60_000, showsPerYear: 60, fazBilheteria: true, pagantePct: '70-94', cacheByType: { produtores: 5_000 } },
    { igEngagement: 4.2, tiktokEngagement: 1.1 },
    // R2.d: duas frentes presentes, as duas abaixo do ponto.
    { spotifyListeners: 5_000, igFollowersSelf: 2_000 },
    // E3.c: a música se paga, mas sobra menos de 10%.
    { revenueSources: { distribuidora: 100_000 }, custoFixoMensal: 7_900 },
    // E4.b: com CNPJ, sem empresário.
    { temCnpj: true },
    // A2.c: agenda cheia, público pagante baixo, conversão baixa.
    { spotifyListeners: 200_000, spotifyFollowers: 10_000, showsPerYear: 60, fazBilheteria: true, pagantePct: 'ate50' },
    // L1.b: acesa com sinal de plataforma, sem prêmio internacional (não é Top Tier).
    { premios: 4, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene', editorialPlaylists: 3 },
    // L1.f: a trava de plataforma barra uma nota que já passou de 0,70.
    { premios: 4, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }], imprensaFrequencia: 'perene' },
    // L1.c: apagada na faixa "perto" (50 a 69).
    { premios: 4, editorialPlaylists: 3 },
    // L5.a: imprensa esporádica.
    { imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'podcasts', porte: 'pequeno' }], imprensaFrequencia: 'esporadico' },
  ];
  const diagnosticos = casos.map((c) => computeRealIndexV4(base(c)));
  for (const ri of diagnosticos) {
    for (const dim of DIMS) ids(ri, dim).forEach((id) => disparados.add(id));
  }

  it('todo gatilho aponta para um texto que existe', () => {
    for (const id of disparados) expect(COMENTARIOS[id]).toBeTruthy();
  });

  it('nenhum texto fica órfão: todos são alcançáveis por algum gatilho', () => {
    const orfaos = Object.keys(COMENTARIOS).filter((id) => !disparados.has(id));
    expect(orfaos).toEqual([]);
  });

  it('os 16 perfis têm retrato e leitura curta', () => {
    // O Beginner tem retrato próprio, em três estágios, e por isso não está em RETRATOS.
    expect(Object.keys(RETRATOS)).toHaveLength(15);
    expect(Object.keys(LEITURAS_CURTAS)).toHaveLength(16);
    for (const chave of Object.keys(LEITURAS_CURTAS)) {
      if (chave !== '0000') expect(RETRATOS[chave]).toBeTruthy();
    }
  });

  it('nenhuma variável fica sem valor no texto entregue', () => {
    // A chave que sobra é o defeito mais fácil de passar: o texto sai com "{margem_show}" no
    // meio da frase e nenhum teste de lógica percebe.
    for (const ri of diagnosticos) {
      for (const dim of DIMS) {
        for (const superficie of ['tela', 'pdf'] as const) {
          for (const c of comentariosDaDimensao(ri, dim, { superficie })) {
            expect(c.texto).not.toMatch(/[{}]/);
          }
        }
      }
      const retrato = retratoDoPerfil(ri);
      if (retrato) expect(retrato.texto).not.toMatch(/[{}]/);
    }
  });
});

describe('a precedência dentro do grupo (o primeiro que casar vence)', () => {
  // A ordem das listas é conteúdo, não estilo: trocá-la troca o comentário que sai. Estes casos
  // são os que se sobrepõem de verdade, e por isso são os que precisam estar amarrados.

  it('R2.e vence: com uma frente só, não se diz qual delas puxa', () => {
    const ri = computeRealIndexV4(base({ spotifyListeners: 20_000_000 }));
    // Os ouvintes estão altíssimos, o que casaria com R2.a se ele viesse antes.
    expect(ids(ri, 'r')).toContain('R2.e');
    expect(ids(ri, 'r')).not.toContain('R2.a');
  });

  it('A2.e vence: sem bilheteria, a conversa é essa e não outra', () => {
    const ri = computeRealIndexV4(base({
      spotifyListeners: 200_000, spotifyFollowers: 80_000, showsPerYear: 4, fazBilheteria: false,
    }));
    // A conversão está alta (40%) e a circulação baixa: casaria com A2.a.
    expect(ids(ri, 'a')).toContain('A2.e');
    expect(ids(ri, 'a')).not.toContain('A2.a');
  });

  it('L1.a vence sobre L1.b quando a dimensão é Top Tier', () => {
    const ri = computeRealIndexV4(base({
      premios: 6, imprensaRepercussao: true, imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
      imprensaFrequencia: 'perene', editorialPlaylists: 5, radioAirplay180d: 300,
    }));
    expect(ri.dimTopIcon.l).toBe(true);
    expect(ids(ri, 'l')).toContain('L1.a');
    expect(ids(ri, 'l')).not.toContain('L1.b');
  });

  it('E1.e vence sobre E1.d quando o saldo é negativo', () => {
    const ri = computeRealIndexV4(base({ revenueSources: { distribuidora: 10_000 }, investLancamentos12m: 30_000 }));
    expect(ids(ri, 'e')).toContain('E1.e');
    expect(ids(ri, 'e')).not.toContain('E1.d');
  });

  it('os alertas de custo coexistem, porque são grupos separados (§7.5)', () => {
    const ri = computeRealIndexV4(base({
      showsPerYear: 10, cacheByType: { casasDeShow: 500 },
      custoPorShow: 900, custoFixoMensal: 1_000, investLancamentos12m: 0,
    }));
    const saida = ids(ri, 'e');
    expect(saida).toEqual(expect.arrayContaining(['E3.d', 'E3.e', 'E3.f']));
  });

  it('o L6 sempre devolve DOIS comentários: um de playlist e um de rádio (§9.8)', () => {
    const ri = computeRealIndexV4(base({ editorialPlaylists: 4, radioAirplay180d: 2 }));
    const saida = ids(ri, 'l');
    expect(saida).toContain('L6.a');   // tem playlist
    expect(saida).toContain('L6.d');   // rádio abaixo do piso de 6
  });
});

describe('§5.1 os estágios invisíveis do Beginner', () => {
  const comNotas = (r: number, e: number, a: number, l: number) =>
    ({ version: 4, profile: { key: '0000' }, boletim: { r, e, a, l } }) as any;

  it('uma frente quase acendendo vale mais que duas que saíram do zero', () => {
    expect(estagioDoBeginner(comNotas(60, 40, 0, 0))).toBe('BEG.2');
    expect(estagioDoBeginner(comNotas(40, 40, 0, 0))).toBe('BEG.1');
    expect(estagioDoBeginner(comNotas(20, 10, 0, 0))).toBe('BEG.0');
  });

  it('o retrato do BEG.2 nomeia a frente mais avançada', () => {
    const ri = computeRealIndexV4(base({ premios: 4, imprensaRepercussao: true, imprensaFrequencia: 'perene', imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }] }));
    expect(ri.profile.key).toBe('0000');
    const retrato = retratoDoPerfil(ri)!;
    expect(retrato.estagio).toBe('BEG.2');
    expect(retrato.texto).toContain('a legitimação');
  });

  it('o retrato do BEG.1 conta as frentes por extenso', () => {
    const retrato = retratoDoPerfil(comNotas(40, 40, 0, 0));
    expect(retrato?.texto).toContain('duas frentes');
  });
});

describe('a abertura em negrito', () => {
  it('parte o comentário na primeira frase', () => {
    const ri = computeRealIndexV4(base({ spotifyListeners: 5_000, igFollowersSelf: 2_000 }));
    const c = comentariosDaDimensao(ri, 'r', { superficie: 'pdf' }).find((x) => x.id === 'R1.d')!;
    expect(c.lead).toBe('Seu alcance está em construção.');
    expect(c.corpo.startsWith('Você já aparece no digital')).toBe(true);
    expect(`${c.lead} ${c.corpo}`).toBe(c.texto);
  });

  it('não parte no ponto de milhar de um valor', () => {
    // "R$ 2.000" tem ponto, e cortar nele partiria a frase no meio do número.
    const ri = computeRealIndexV4(base({
      revenueSources: { distribuidora: 9_000 }, investLancamentos12m: 2_000,
    }));
    const c = comentariosDaDimensao(ri, 'e', { superficie: 'pdf' }).find((x) => x.id === 'E3.a');
    if (c) {
      expect(c.lead).toBe('A música se paga, e sobra.');
      expect(c.corpo).toContain('R$');
    }
  });

  it('todo comentário tem lead, e lead + corpo reconstroem o texto', () => {
    const ri = computeRealIndexV4(base({
      spotifyListeners: 200_000, spotifyFollowers: 60_000, showsPerYear: 60,
      cacheByType: { produtores: 3_000 }, custoPorShow: 800, custoFixoMensal: 500,
      fazBilheteria: true, pagantePct: '70-94', premios: 4, editorialPlaylists: 2,
    }));
    for (const dim of DIMS) {
      for (const c of comentariosDaDimensao(ri, dim, { superficie: 'pdf' })) {
        expect(c.lead.length).toBeGreaterThan(0);
        expect(c.corpo ? `${c.lead} ${c.corpo}` : c.lead).toBe(c.texto);
      }
    }
  });
});

describe('§3 o selo do estado', () => {
  it('a dimensão usa Top Tier, e não TOP ICON', () => {
    const { seloDaDimensao } = require('./comentarios');
    expect(seloDaDimensao({ pattern: {}, dimTopIcon: {} }, 'r').rotulo).toBe('APAGADA');
    expect(seloDaDimensao({ pattern: { r: true }, dimTopIcon: {} }, 'r').rotulo).toBe('ACESA');
    expect(seloDaDimensao({ pattern: { r: true }, dimTopIcon: { r: true } }, 'r').rotulo).toBe('TOP TIER');
  });
});

describe('§10 a linha de status da barra', () => {
  it('apagada diz quanto falta para acender e para o Top Tier', () => {
    const ri = { version: 4, boletim: { r: 17 }, pattern: { r: false }, dimTopIcon: { r: false } };
    expect(statusDaBarra(ri, 'r')).toBe('Faltam 53 pontos para acender e 83 para o Top Tier.');
  });

  it('acesa diz só o que falta para o Top Tier', () => {
    const ri = { version: 4, boletim: { e: 78 }, pattern: { e: true }, dimTopIcon: { e: false } };
    expect(statusDaBarra(ri, 'e')).toBe('Acesa. Faltam 22 pontos para o Top Tier.');
  });

  it('no Top Tier não há o que faltar', () => {
    const ri = { version: 4, boletim: { l: 100 }, pattern: { l: true }, dimTopIcon: { l: true } };
    expect(statusDaBarra(ri, 'l')).toBe(FIXOS.F5);
  });
});


// §7.4 · O ZERO QUE VEM DE "NÃO SEI".
//
// Quem marca "não sei" em todas as fontes fica com `receitaOutrasTotal = 0`, igualzinho a quem
// de fato não faturou nada fora do palco. O relatório lia os dois casos do mesmo jeito e
// imprimia, no MESMO PDF, dois textos que se contradizem: o E2.d afirmando que essas frentes
// estão em zero, e o E6 reconhecendo que a pessoa não soube informar.
//
// É o tipo de erro que o artista percebe antes da gente, e que o faz desconfiar do diagnóstico
// inteiro. A regra manda o grupo se calar e deixa o E6 responder sozinho.
describe('§7.4 zero por ignorância não é zero por ausência', () => {
  const soShows = { showsPerYear: 20, cacheByType: { produtores: 2_000 } };

  it('com "não sei" nas fontes, o grupo da composição se cala', () => {
    const ri = computeRealIndexV4(base({ ...soShows, revenueSources: { distribuidora: 'nao_sei' } as any }));

    expect(ids(ri, 'e')).not.toContain('E2.d');
    // E quem responde é o E6, que diz a verdade: não é ausência de receita, é de informação.
    expect(ids(ri, 'e')).toContain('E6');
  });

  it('sem "não sei", o zero é real e o E2.d volta a falar', () => {
    const ri = computeRealIndexV4(base({ ...soShows }));

    expect(ids(ri, 'e')).toContain('E2.d');
    expect(ids(ri, 'e')).not.toContain('E6');
  });

  // A regra é só para o zero. Quem informou receita de verdade E marcou "não sei" noutra fonte
  // continua tendo a composição comentada, porque aí há composição para comentar.
  it('com receita informada, o "não sei" não cala a composição', () => {
    const ri = computeRealIndexV4(base({
      ...soShows,
      revenueSources: { distribuidora: 40_000, editora: 'nao_sei' } as any,
    }));

    expect(ids(ri, 'e').some((id) => id.startsWith('E2.'))).toBe(true);
    expect(ids(ri, 'e')).toContain('E6');
  });
});
