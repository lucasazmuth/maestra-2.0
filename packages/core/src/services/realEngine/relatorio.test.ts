import { computeRealIndexV4 } from './index';
import type { RealInputsV4 } from './index';
import {
  AVISOS, AVISO_LEGADO, avisosDoDiagnostico, ehLegado, engajamentoExibido,
  linhasDaDimensao, resumoDoE, SIIC_ANUAL,
} from './relatorio';

const base = (over: Partial<RealInputsV4> = {}): RealInputsV4 => ({
  spotifyConnected: true,
  spotifyListeners: null, igFollowers: null, tiktokFollowers: null, youtubeMonthlyViews: null,
  spotifyFollowers: null, deezerFans: null,
  igEngagement: null, tiktokEngagement: null, youtubeEngagement: null,
  editorialPlaylists: null, radioAirplay180d: null,
  igFollowersSelf: null, tiktokFollowersSelf: null, youtubeViews28dSelf: null,
  showsPerYear: 0, cacheByType: {}, revenueSources: {}, investimento: 0,
  temCnpj: false, aliquota: null, temEmpresario: false,
  fazBilheteria: false, pagantePct: null,
  premios: 0, imprensaRepercussao: false, imprensaMatrix: [], imprensaFrequencia: 'lancamento',
  ...over,
});

describe('§13.2 diagnósticos em versão anterior', () => {
  it('reconhece o legado pela versão', () => {
    expect(ehLegado({ version: 2 })).toBe(true);
    expect(ehLegado({ version: 3 })).toBe(true);
    expect(ehLegado({})).toBe(true);
    expect(ehLegado(computeRealIndexV4(base()))).toBe(false);
  });

  it('o legado recebe o aviso da versão e nenhum outro', () => {
    // As flags da v4 nem existem num diagnóstico antigo: misturar os avisos afirmaria coisas
    // sobre dados que aquele diagnóstico nunca coletou.
    expect(avisosDoDiagnostico({ version: 3, flags: { travaL: true } }))
      .toEqual([{ chave: 'legado', texto: AVISO_LEGADO }]);
  });

  it('as linhas e o resumo do E não se aplicam ao legado', () => {
    expect(linhasDaDimensao({ version: 3 }, 'e')).toEqual([]);
    expect(resumoDoE({ version: 3 })).toBeNull();
  });
});

describe('§11.3 textos obrigatórios', () => {
  it('não avisa nada quando não há o que avisar', () => {
    const ri = computeRealIndexV4(base({ fazBilheteria: true, pagantePct: '95-100' }));
    expect(avisosDoDiagnostico(ri)).toEqual([]);
  });

  it('avisa a trava de L, o saldo negativo, a bilheteria, o autodeclarado e o "não sei"', () => {
    const ri = computeRealIndexV4(base({
      premios: 4, imprensaRepercussao: true, imprensaFrequencia: 'perene',
      imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
      revenueSources: { outras: 1_000, editora: 'nao_sei' },
      investimento: 20_000,
      igFollowersSelf: 4_000,
    }));
    const chaves = avisosDoDiagnostico(ri).map((a) => a.chave);
    expect(chaves).toEqual(['travaL', 'saldoNegativo', 'semBilheteria', 'autodeclarado', 'naoSei']);
    expect(avisosDoDiagnostico(ri)[0].texto).toBe(AVISOS.travaL);
  });
});

describe('§7.5 resumo do E', () => {
  const ri = computeRealIndexV4(base({
    showsPerYear: 40,
    cacheByType: { corporativos: 6_000, produtores: 2_000, particulares: 0 },
    revenueSources: { distribuidora: 12_000, editora: 'nao_sei', aulas: 8_000 },
    investimento: 30_000,
    temCnpj: true, aliquota: '6-10', temEmpresario: true,
  }));

  it('devolve a conta inteira, na base anual', () => {
    const r = resumoDoE(ri)!;
    expect(r.cacheMedio).toBe(4_000);        // média só dos cachês informados
    expect(r.receitaShows).toBe(160_000);
    expect(r.receitaOutrasTotal).toBe(20_000);
    expect(r.receitaAnual).toBe(180_000);
    expect(r.saldo).toBe(150_000);
    expect(r.bonus).toBe(1.3);
    expect(r.saldoAjustado).toBe(195_000);
  });

  it('lista só os tipos de contratante atendidos, para o gráfico', () => {
    expect(resumoDoE(ri)!.cache.map((c) => c.tipo)).toEqual(['corporativos', 'produtores']);
  });

  it('mantém a fonte "não sei" na lista, sinalizada', () => {
    const fontes = resumoDoE(ri)!.fontes;
    expect(fontes.find((f) => f.fonte === 'editora')).toEqual(
      expect.objectContaining({ valor: 0, naoSei: true }),
    );
    // As fontes zeradas e não perguntadas não entram: só o que tem valor ou "não sei".
    expect(fontes.map((f) => f.fonte)).toEqual(['distribuidora', 'editora', 'aulas']);
  });

  it('estima a receita líquida pelo ponto médio da faixa, e compara com o SIIC', () => {
    const r = resumoDoE(ri)!;
    expect(r.receitaLiquidaEstimada).toBe(Math.round(180_000 * 0.92));
    expect(r.aliquotaRotulo).toBe('De 6% a 10%');
    expect(r.vezesOSetor).toBeCloseTo(180_000 / SIIC_ANUAL, 6);
  });

  it('omite a receita líquida quando a alíquota é "não sei"', () => {
    const sem = computeRealIndexV4(base({ temCnpj: true, aliquota: 'nao_sei' }));
    expect(resumoDoE(sem)!.receitaLiquidaEstimada).toBeNull();
    expect(resumoDoE(sem)!.aliquotaRotulo).toBe('Não sei');
  });

  it('recomenda empresariamento a quem não tem', () => {
    expect(resumoDoE(ri)!.recomendarEmpresariamento).toBe(false);
    expect(resumoDoE(computeRealIndexV4(base()))!.recomendarEmpresariamento).toBe(true);
  });
});

describe('linhas de cada dimensão', () => {
  const ri = computeRealIndexV4(base({
    spotifyListeners: 200_000, spotifyFollowers: 60_000,
    igFollowers: 80_000, igFollowersSelf: null,
    tiktokFollowers: null, tiktokFollowersSelf: 12_000,
    showsPerYear: 60, cacheByType: { produtores: 3_000 },
    fazBilheteria: true, pagantePct: '70-94',
    editorialPlaylists: 0, radioAirplay180d: 3,
    premios: 4, imprensaRepercussao: true, imprensaFrequencia: 'perene',
    imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
  }));

  it('marca a proveniência de cada campo de R', () => {
    const r = linhasDaDimensao(ri, 'r');
    expect(r.find((l) => l.rotulo === 'Instagram')).toEqual({ rotulo: 'Instagram', num: 80_000, fonte: 'api' });
    expect(r.find((l) => l.rotulo === 'TikTok')).toEqual({ rotulo: 'TikTok', num: 12_000, fonte: 'self' });
    expect(r.find((l) => l.rotulo === 'YouTube (views/mês)')?.fonte).toBe('absent');
  });

  it('o E mostra saldo, não só receita', () => {
    const rotulos = linhasDaDimensao(ri, 'e').map((l) => l.rotulo);
    expect(rotulos).toEqual(['Receita (12 meses)', 'Investimento (12 meses)', 'Saldo']);
  });

  it('o A traz a conversão calculada e a circulação anual', () => {
    const a = linhasDaDimensao(ri, 'a');
    expect(a[0]).toEqual({ rotulo: 'Conversão (seguidores ÷ ouvintes)', valor: '30,0%', fonte: 'api' });
    expect(a[1]).toEqual({ rotulo: 'Shows (12 meses)', valor: '60', fonte: 'self' });
  });

  it('o A diz "Sem dado" quando a conversão não existe, e não zero', () => {
    const semSpotify = computeRealIndexV4(base({ spotifyConnected: false }));
    expect(linhasDaDimensao(semSpotify, 'a')[0].valor).toBe('Sem dado');
  });

  it('o L separa consulta vazia de consulta que não aconteceu', () => {
    const l = linhasDaDimensao(ri, 'l');
    // playlists: a consulta voltou vazia → componente presente valendo 0
    expect(l.find((x) => x.rotulo === 'Playlists editoriais')).toEqual(
      expect.objectContaining({ valor: '0', fonte: 'api' }),
    );
    // rádio: 3 execuções em 180 dias é ABAIXO do piso de 6 → ausente, não "Não"
    expect(l.find((x) => x.rotulo === 'Execução em rádio')).toEqual(
      expect.objectContaining({ valor: 'Sem dado', fonte: 'absent' }),
    );
  });

  it('o L mostra o número de execuções quando o rádio conta', () => {
    const comRadio = computeRealIndexV4(base({ radioAirplay180d: 17_272 }));
    expect(linhasDaDimensao(comRadio, 'l').find((x) => x.rotulo === 'Execução em rádio')?.valor)
      .toBe('17 mil execuções');
  });
});

describe('§8.5 exibição do engajamento', () => {
  it('lista só as redes que a API entregou', () => {
    const ri = computeRealIndexV4(base({ igEngagement: 4.35, tiktokEngagement: null, youtubeEngagement: 1.2 }));
    expect(engajamentoExibido(ri).map((e) => e.rede)).toEqual(['instagram', 'youtube']);
    expect(engajamentoExibido(ri)[0]).toEqual({ rede: 'instagram', value: 4.35, cut: 2.8, above: true });
  });
});

describe('a narrativa lê a v4 (e não some com os parágrafos)', () => {
  // A narrativa é o texto que o artista mais lê. Na v3 ela lia `ri.inputs.investimento` como
  // número; na v4 esse campo virou `{ value, source }` e o autorrelato mudou de lugar. Sem
  // leitores próprios, cada parágrafo que depende do quiz sumiria em silêncio.
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { dimNarrative } = require('../../constants/realNarrative');

  const ri = computeRealIndexV4(base({
    showsPerYear: 60,
    cacheByType: { produtores: 3_000 },
    revenueSources: { distribuidora: 20_000, aulas: 10_000 },
    investimento: 40_000,
    imprensaRepercussao: true, imprensaFrequencia: 'perene',
    imprensaMatrix: [{ tipo: 'tv', porte: 'grande' }],
    editorialPlaylists: 4, radioAirplay180d: 200,
    igEngagement: 5.2,
  }));

  it('o E fala do saldo anual real, não de uma base mensal vezes doze', () => {
    const paras = dimNarrative('e', ri).paras;
    const conta = paras.find((p: any) => p.body.includes('Em 12 meses'));
    // 60 × 3.000 + 30.000 = 210.000 de receita, 40.000 de investimento
    expect(conta.body).toContain('R$ 210 mil');
    expect(conta.body).toContain('R$ 40 mil');
    expect(conta.lead).toBe('A música se paga, e sobra.');
  });

  it('o E reconhece mais de uma fonte de receita', () => {
    expect(dimNarrative('e', ri).paras.some((p: any) => p.lead === 'Sua receita tem mais de uma perna.')).toBe(true);
  });

  it('o A converte a circulação anual em agenda mensal', () => {
    // 60 shows por ano são 5 por mês: o texto de "quase não está no palco" não pode aparecer.
    expect(dimNarrative('a', ri).paras.some((p: any) => p.lead === 'Você está no palco com frequência.')).toBe(true);
    const parado = computeRealIndexV4(base({ showsPerYear: 12 }));
    expect(dimNarrative('a', parado).paras.some((p: any) => p.lead === 'Você quase não está no palco.')).toBe(true);
  });

  it('o L enxerga a imprensa perene e a chancela de plataforma', () => {
    const paras = dimNarrative('l', ri).paras;
    expect(paras.some((p: any) => p.lead === 'Sua presença na mídia é constante.')).toBe(true);
    expect(paras.some((p: any) => p.lead === 'Você tem chancela de plataforma.')).toBe(true);
  });

  it('o L não chama de chancela um rádio abaixo do piso de 6 execuções', () => {
    const poucas = computeRealIndexV4(base({ radioAirplay180d: 3, editorialPlaylists: 0 }));
    expect(dimNarrative('l', poucas).paras.some((p: any) => p.lead === 'Você tem chancela de plataforma.')).toBe(false);
  });
});

describe('compatibilidade com o quiz da v3', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
  const { daQuizV3, computeRealIndexV4: motor } = require('./index');

  // Um app antigo na loja continua mandando as chaves da v3. Sem tradução, o motor não acharia
  // nenhuma delas e o E e o A apagariam em silêncio para essas pessoas.
  const v3 = {
    showsPerMonth: 5, cache: 3_000,
    revenueSources: { streaming: 1_000, direitos: 500, editais: 200 },
    investimento: 40_000, temCnpj: true, temEmpresario: true,
    fazBilheteria: true, pagantePct: '70-94', premios: 4,
  };

  it('converte a base mensal em anual', () => {
    const v4 = daQuizV3(v3);
    expect(v4.showsPerYear).toBe(60);
    expect(v4.cacheByType).toEqual({ outros: 3_000 });
    expect(v4.revenueSources).toEqual({ distribuidora: 12_000, associacao: 6_000, patrocinios: 2_400 });
    // O investimento já era anual nas duas versões: multiplicá-lo seria inventar um gasto.
    expect(v4.investimento).toBe(40_000);
    expect(v4.aliquota).toBeNull();
  });

  it('não mexe num quiz que já é da v4', () => {
    const jaV4 = { showsPerYear: 12, cacheByType: { produtores: 900 } };
    expect(daQuizV3(jaV4)).toBe(jaV4);
  });

  it('aguenta entrada vazia', () => {
    expect(daQuizV3(null)).toEqual({});
    expect(daQuizV3(undefined)).toEqual({});
  });

  it('o diagnóstico traduzido bate com o mesmo quiz respondido na v4', () => {
    const traduzido = motor({ ...base(), ...daQuizV3(v3) });
    const nativo = motor(base({
      showsPerYear: 60, cacheByType: { outros: 3_000 },
      revenueSources: { distribuidora: 12_000, associacao: 6_000, patrocinios: 2_400 },
      investimento: 40_000, temCnpj: true, temEmpresario: true,
      fazBilheteria: true, pagantePct: '70-94', premios: 4,
    }));
    expect(traduzido.revenue.receitaAnual).toBe(nativo.revenue.receitaAnual);
    expect(traduzido.revenue.saldoAjustado).toBe(nativo.revenue.saldoAjustado);
    expect(traduzido.pattern).toEqual(nativo.pattern);
    expect(traduzido.boletim).toEqual(nativo.boletim);
  });
});
