import {
  QUIZ, TRANSICOES, CTX_API, transicaoDoBloco, proximaPergunta, perguntaAnterior,
  colunaMarcada, LINHA_SEM_ESCOLHA, mapaDaTabela, respostaDaTabela, gravarEscape, gravarResposta,
  respostaGravada, naTrilha, posicaoNaTrilha, totalDaTrilha, type QuizDef,
} from './quizDoDiagnostico';

// O ROTEIRO v4.2 — a ordem das perguntas e as transições de bloco.
//
// A v4.2 não mudou uma conta sequer: mudou a SEQUÊNCIA. Por isso não há teste de motor que a
// proteja — reordenar o array de volta, ou perder uma transição num merge, deixa os testes do
// `realEngine` todos verdes e a tela pedindo dinheiro na primeira pergunta de novo.
//
// A ordem sai da metodologia, e não da conveniência da tela: atividade antes de dinheiro,
// sim/não e contagem antes de valores, conquistas antes de estrutura, dinheiro por último.

const chaves = () => QUIZ.map((p) => p.key);

/** O caminho de quem responde: a partir de `de`, as perguntas que de fato aparecem. */
const perguntasVisiveis = (respostas: Record<string, any>) =>
  QUIZ.filter((p) => !p.skipIf?.(respostas)).map((p) => p.key);

const indiceDe = (chave: string) => QUIZ.findIndex((p) => p.key === chave);

/** Quem pediu ajuda para calcular: o desvio aberto, e a faixa de saldo por responder. */
const detalhando = { _detalhar: true, showsPerYear: 12 };

describe('a ordem do quiz (v4.5, §3.2)', () => {
  it('é a sequência da metodologia, do mais leve ao mais sensível', () => {
    expect(chaves()).toEqual([
      'vinculo',
      'fazBilheteria', 'pagantePct',
      'igFollowersSelf', 'tiktokFollowersSelf', 'youtubeViews28dSelf',
      'imprensaRepercussao', 'imprensaMatrix', 'imprensaFrequencia', 'premios',
      // O bloco do dinheiro, contíguo: quatro perguntas de núcleo com o desvio entre a segunda
      // e a terceira.
      'showsPerYear', 'saldoFaixa',
      'cacheFaixa', '_cachePorTipo', 'cacheByTypeFaixa', 'outrasFaixa',
      ...Array<string>(9).fill('outrasPorFonteFaixa'),
      'custoShowFaixa', 'fixoFaixa', 'lancFaixa',
      'temCnpj', 'temEmpresario',
    ]);
  });

  // ⚠️ O BLOCO DO DINHEIRO TEM DE SER CONTÍGUO, e é isso que a v4.5 arrumou. O CNPJ e o
  // empresário viviam num bloco à parte, três perguntas antes, e os textos da Anita para o E
  // pressupõem-nos no fim dele ("Duas últimas, rápidas"). O detalhamento parte o bloco ao meio,
  // e é a única coisa que pode estar no meio.
  it('nada de fora se intromete no bloco do dinheiro', () => {
    const doDinheiro = QUIZ
      .map((p, i) => [i, p.bloco] as const)
      .filter(([, b]) => b === 'numeros' || b === 'detalhe');
    const primeiro = doDinheiro[0][0];
    const ultimo = doDinheiro[doDinheiro.length - 1][0];

    for (let i = primeiro; i <= ultimo; i += 1) {
      expect(['numeros', 'detalhe']).toContain(QUIZ[i].bloco);
    }
  });

  it('o dinheiro fica por último, depois de tudo o que não é dinheiro', () => {
    const primeiraDeDinheiro = QUIZ.findIndex((p) => p.bloco === 'numeros');
    const ultimaQueNaoEDinheiro = QUIZ.map((p) => p.bloco)
      .map((b, i) => (b === 'numeros' || b === 'detalhe' ? -1 : i))
      .reduce((a, b) => Math.max(a, b), -1);

    expect(primeiraDeDinheiro).toBeGreaterThan(ultimaQueNaoEDinheiro);
  });

  // A contagem de shows abre o bloco, e dela dependem os `skipIf` das perguntas de palco.
  it('a contagem de shows vem antes do que depende dela', () => {
    expect(indiceDe('showsPerYear')).toBeLessThan(indiceDe('cacheFaixa'));
    expect(indiceDe('showsPerYear')).toBeLessThan(indiceDe('custoShowFaixa'));
  });

  // ⚠️ NADA É DIGITADO NO E (§3.2). O artista escolhe faixas; o quiz guarda o ÍNDICE, nunca o
  // dinheiro. É isso que permite reconstruir piso, ponto médio e rótulo a partir do diagnóstico
  // gravado — e um campo de moeda que voltasse aqui quebrava essa promessa em silêncio.
  it('nenhuma pergunta pede dinheiro digitado', () => {
    expect(QUIZ.map((p) => p.type)).not.toContain('currency');
    const doDinheiro = QUIZ.filter((p) => p.bloco === 'numeros' || p.bloco === 'detalhe');
    expect(doDinheiro.filter((p) => p.type === 'int').map((p) => p.key)).toEqual(['showsPerYear']);
  });

  // A alíquota saiu: ela nunca entrou no índice, servia a uma linha de exibição, e a v4.5
  // trocou-a por uma pergunta a menos.
  it('a alíquota deixou de ser perguntada', () => {
    expect(chaves()).not.toContain('aliquota');
  });
});

describe('as transições de bloco', () => {
  it('abrem a primeira pergunta de cada bloco', () => {
    expect(transicaoDoBloco(indiceDe('fazBilheteria'), {})).toBe(TRANSICOES.shows);
    expect(transicaoDoBloco(indiceDe('imprensaRepercussao'), {})).toBe(TRANSICOES.reconhecimento);
    expect(transicaoDoBloco(indiceDe('showsPerYear'), {})).toBe(TRANSICOES.numeros);
    expect(transicaoDoBloco(indiceDe('cacheFaixa'), detalhando)).toBe(TRANSICOES.detalhe);
  });

  it('não se repetem no meio do bloco', () => {
    expect(transicaoDoBloco(indiceDe('pagantePct'), { fazBilheteria: true })).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('premios'), {})).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('saldoFaixa'), {})).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('temEmpresario'), {})).toBeUndefined();
  });

  // ⚠️ O DEFEITO QUE A v4.5 TORNOU ALCANÇÁVEL, e a razão de o laço varrer o array inteiro.
  //
  // O recuo contíguo bastava enquanto cada bloco era um trecho seguido do array. O bloco do
  // dinheiro deixou de o ser: o detalhamento parte-o ao meio, e o `temCnpj` do outro lado tem o
  // `lancFaixa` por vizinho — outro bloco. O laço parava logo na primeira volta e a transição
  // QE.0 saía OUTRA VEZ, a meio do bloco, para quem detalhou.
  it('a abertura do bloco do dinheiro não sai duas vezes para quem detalhou', () => {
    expect(transicaoDoBloco(indiceDe('temCnpj'), {})).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('temCnpj'), detalhando)).not.toBe(TRANSICOES.numeros);
  });

  // O vínculo abre o quiz. Uma frase antes da primeira pergunta seria uma tela a mais antes de
  // qualquer coisa ter começado.
  it('o vínculo não tem transição', () => {
    expect(transicaoDoBloco(indiceDe('vinculo'), {})).toBeUndefined();
  });

  it('todo bloco depois do vínculo tem a sua', () => {
    const blocos = [...new Set(QUIZ.map((p) => p.bloco))].filter((b) => b !== 'vinculo');

    blocos.forEach((bloco) => expect(TRANSICOES[bloco]).toBeTruthy());
  });

  // O CASO DO BLOCO DIGITAL, e a razão de a transição ser do BLOCO e não da primeira pergunta.
  //
  // As três perguntas de rede só existem quando a Chartmetric não trouxe o dado, e some primeiro
  // justamente a que abre o bloco. Presa ao Instagram, a transição sumiria com ele — e o artista
  // veria "E no TikTok, quantos seguidores?" sem nada explicando por que a máquina está
  // perguntando o que devia ter buscado sozinha.
  describe('a do bloco digital acompanha a primeira pergunta que sobrou', () => {
    it('com o Instagram vindo da API, ela passa para o TikTok', () => {
      const respostas = { [CTX_API]: { igFollowers: 9000 } };

      expect(transicaoDoBloco(indiceDe('igFollowersSelf'), respostas)).toBe(TRANSICOES.digital);
      expect(transicaoDoBloco(indiceDe('tiktokFollowersSelf'), respostas)).toBe(TRANSICOES.digital);
    });

    it('com Instagram e TikTok da API, ela vai para o YouTube', () => {
      const respostas = { [CTX_API]: { igFollowers: 9000, tiktokFollowers: 400 } };

      expect(transicaoDoBloco(indiceDe('youtubeViews28dSelf'), respostas)).toBe(TRANSICOES.digital);
    });

    // Com os três dados na mão, o bloco inteiro é pulado: nenhuma pergunta dele é visitada, e a
    // transição não chega a existir. O artista vai dos shows direto para o reconhecimento.
    it('com os três da API, nenhuma pergunta do bloco aparece', () => {
      const respostas = {
        [CTX_API]: { igFollowers: 9000, tiktokFollowers: 400, youtubeMonthlyViews: 120000 },
      };

      expect(perguntasVisiveis(respostas)).not.toContain('igFollowersSelf');
      expect(perguntasVisiveis(respostas)).not.toContain('tiktokFollowersSelf');
      expect(perguntasVisiveis(respostas)).not.toContain('youtubeViews28dSelf');
      expect(proximaPergunta(indiceDe('igFollowersSelf'), respostas))
        .toBe(indiceDe('imprensaRepercussao'));
    });
  });
});

// Quem não fez show nenhum não tem cachê médio nem custo por show. Perguntá-los seria pedir o
// cachê de quem acabou de dizer que não subiu no palco.
describe('quem não fez show não responde sobre show', () => {
  it('pula o cachê e o custo por show', () => {
    const visiveis = perguntasVisiveis({ ...detalhando, showsPerYear: 0 });

    expect(visiveis).not.toContain('cacheFaixa');
    expect(visiveis).not.toContain('custoShowFaixa');
    expect(visiveis).not.toContain('cacheByTypeFaixa');
    expect(visiveis).toContain('outrasFaixa');
  });

  it('quem fez ao menos um responde os dois', () => {
    const visiveis = perguntasVisiveis({ ...detalhando, showsPerYear: 1 });

    expect(visiveis).toContain('cacheFaixa');
    expect(visiveis).toContain('custoShowFaixa');
  });

  // A ida e a volta precisam pular o mesmo tanto, senão o "Voltar" cai numa pergunta que a tela
  // acabou de decidir que não existe.
  it('o voltar pula os mesmos que o avançar', () => {
    const respostas = { ...detalhando, showsPerYear: 0 };

    expect(proximaPergunta(indiceDe('cacheFaixa'), respostas)).toBe(indiceDe('outrasFaixa'));
    expect(perguntaAnterior(indiceDe('custoShowFaixa'), respostas)).toBe(indiceDe('outrasFaixa'));
  });
});

// Mesmo valor (0), leitura outra: quem está começando não recebe um veredito na primeira lista
// de opções que lê sobre a própria carreira.
it('a opção zero de prêmios não é um veredito', () => {
  const premios = QUIZ[indiceDe('premios')];

  expect(premios.options![0]).toEqual({ label: 'Ainda não participei de premiações', value: 0 });
});

// ════════ A tabela de escolha única ════════
//
// ⚠️ ELA ERA A MATRIZ DE IMPRENSA, E SÓ ELA. Os dois renderizadores liam `IMPRENSA_TIPOS` e
// `IMPRENSA_PORTES` direto do módulo e ignoravam a definição da pergunta: `type: 'matrix'` não
// descrevia uma forma, nomeava UMA pergunta. A segunda pergunta com esta forma obrigaria a copiar
// os dois renderizadores inteiros — e a partir daí as cópias divergiriam num lado só, calado.
describe('a tabela de escolha única', () => {
  const imprensa = QUIZ.find((p) => p.key === 'imprensaMatrix')!;

  it('a imprensa é uma tabela, e traz as linhas e as colunas consigo', () => {
    expect(imprensa.type).toBe('tabela');
    expect(imprensa.tabela!.linhas.map((l) => l.key)).toEqual(
      ['imprensa', 'tv', 'influenciadores', 'youtube', 'podcasts', 'blogs'],
    );
    expect(imprensa.tabela!.colunas.map((c) => c.key)).toEqual(['pequeno', 'medio', 'grande']);
    expect(imprensa.tabela!.vazio).toBe('Nunca');
  });

  it('toda tabela declara linhas e colunas, e só uma tabela as declara', () => {
    for (const p of QUIZ) {
      if (p.type === 'tabela') {
        expect(p.tabela?.linhas.length).toBeGreaterThan(0);
        expect(p.tabela?.colunas.length).toBeGreaterThan(0);
      } else {
        expect(p.tabela).toBeUndefined();
      }
    }
  });

  // ⚠️ A FORMA GRAVADA DA IMPRENSA NÃO PODE MUDAR. Ela está em produção desde a v3, o motor e o
  // saneador da edge leem o array de `{ tipo, porte }`, e há 84 diagnósticos guardados com ele.
  // Generalizar o renderizador não é licença para mexer no payload de uma pergunta já publicada.
  it('a imprensa continua a gravar o array de { tipo, porte }, só com as linhas marcadas', () => {
    expect(respostaDaTabela(imprensa, { imprensa: 'grande', tv: LINHA_SEM_ESCOLHA, podcasts: 'medio' }))
      .toEqual([{ tipo: 'imprensa', porte: 'grande' }, { tipo: 'podcasts', porte: 'medio' }]);
  });

  it('e volta a ser o mesmo mapa quando o artista clica em "Voltar"', () => {
    const marcado = { imprensa: 'grande', podcasts: 'medio' };
    expect(mapaDaTabela(imprensa, respostaDaTabela(imprensa, marcado))).toEqual(marcado);
  });

  it.each([[null], [undefined], ['lixo'], [{}], [[{ nada: 1 }]]])(
    'e um valor gravado inútil (%p) devolve um mapa vazio, em vez de rebentar',
    (gravado) => {
      expect(mapaDaTabela(imprensa, gravado)).toEqual({});
    },
  );

  // Uma tabela sem `saida`/`entrada` — o formato das que vêm a seguir, em faixas — grava o mapa
  // como ele é, e a linha sem escolha simplesmente não entra.
  it('uma tabela nova grava o mapa, sem as linhas em branco', () => {
    const nova = { key: 'x', bloco: 'numeros', type: 'tabela', q: '', tabela: {
      linhas: [{ key: 'a', label: 'A' }, { key: 'b', label: 'B' }],
      colunas: [{ key: '0', label: 'Nada' }, { key: '1', label: 'Até R$ 500' }],
    } } as unknown as QuizDef;
    expect(respostaDaTabela(nova, { a: '1', b: LINHA_SEM_ESCOLHA })).toEqual({ a: '1' });
    expect(mapaDaTabela(nova, { a: '1' })).toEqual({ a: '1' });
  });

  it('e um array gravado numa tabela sem conversor não vira mapa de índices', () => {
    const nova = { key: 'x', bloco: 'numeros', type: 'tabela', q: '', tabela: {
      linhas: [{ key: 'a', label: 'A' }], colunas: [{ key: '0', label: 'Nada' }],
    } } as unknown as QuizDef;
    // Sem a guarda, `['x','y']` viraria `{ 0: 'x', 1: 'y' }`: chaves que não são linha nenhuma,
    // e a tabela abriria com marcas em linhas que não existem.
    expect(mapaDaTabela(nova, ['x', 'y'])).toEqual({});
  });

  // ⚠️ A COLUNA QUE LIMPA TEM DE ACENDER NUMA LINHA INTOCADA. A linha que ninguém tocou não tem
  // valor no mapa, e a coluna que limpa tem chave vazia: sem o `??`, a tabela abre com as seis
  // linhas sem nada marcado, como se "Nunca" fosse resposta por dar em vez do estado inicial.
  describe('a marca de cada coluna', () => {
    it('a linha intocada abre com a coluna que limpa acesa', () => {
      expect(colunaMarcada({}, 'imprensa', LINHA_SEM_ESCOLHA)).toBe(true);
      expect(colunaMarcada({}, 'imprensa', 'grande')).toBe(false);
    });

    it('marcar uma coluna apaga a que limpa', () => {
      expect(colunaMarcada({ imprensa: 'grande' }, 'imprensa', 'grande')).toBe(true);
      expect(colunaMarcada({ imprensa: 'grande' }, 'imprensa', LINHA_SEM_ESCOLHA)).toBe(false);
      expect(colunaMarcada({ imprensa: 'grande' }, 'imprensa', 'medio')).toBe(false);
    });

    it('e a escolha de uma linha não marca a linha vizinha', () => {
      expect(colunaMarcada({ imprensa: 'grande' }, 'tv', 'grande')).toBe(false);
      expect(colunaMarcada({ imprensa: 'grande' }, 'tv', LINHA_SEM_ESCOLHA)).toBe(true);
    });
  });

  // A faixa "Nada" é resposta legítima, e não ausência de resposta: por isso `vazio` é opcional.
  it('a coluna que limpa é opcional', () => {
    const semVazio = { key: 'x', bloco: 'numeros', type: 'tabela', q: '', tabela: {
      linhas: [{ key: 'a', label: 'A' }], colunas: [{ key: '0', label: 'Nada' }],
    } } as unknown as QuizDef;
    expect(semVazio.tabela!.vazio).toBeUndefined();
    expect(respostaDaTabela(semVazio, { a: '0' })).toEqual({ a: '0' });
  });
});

// ════════ O desvio do detalhamento (v4.5, §3.2) ════════
//
// O núcleo do bloco E são quatro perguntas: shows, faixa de saldo, CNPJ, empresário. Quem não
// sabe o saldo toca "Me ajude a calcular" e responde as parcelas, também em faixas. O motor não
// recebe bandeira nenhuma: quem detalha NÃO RESPONDE a faixa de saldo, e é essa ausência que ele
// lê como "somar as parcelas".
describe('o desvio do detalhamento', () => {
  const saldo = QUIZ[indiceDe('saldoFaixa')];
  const detalhe = () => QUIZ.filter((p) => p.bloco === 'detalhe').map((p) => p.key);
  const visiveis = (a: Record<string, any>) => QUIZ.filter((p) => !p.skipIf?.(a)).map((p) => p.key);

  it('quem responde a faixa não vê o detalhamento', () => {
    const vistas = visiveis({ showsPerYear: 12, saldoFaixa: 5 });
    for (const k of detalhe()) expect(vistas).not.toContain(k);
    expect(vistas).toContain('temCnpj');
  });

  it('o botão de escape grava o pedido, e NÃO responde a pergunta', () => {
    const respostas: Record<string, any> = { showsPerYear: 12 };
    gravarEscape(respostas, saldo);

    expect(respostas._detalhar).toBe(true);
    // ⚠️ A AUSÊNCIA É QUE É A RESPOSTA. Gravar qualquer coisa aqui — zero, nulo explícito, uma
    // faixa sentinela — mandava o artista pelo caminho direto com um saldo que ele nunca deu.
    expect('saldoFaixa' in respostas).toBe(false);
    expect(visiveis(respostas)).toContain('cacheFaixa');
  });

  // ⚠️ É ISTO QUE FAZ O "VOLTAR" FUNCIONAR SEM LIMPAR NADA. Quem pediu ajuda, voltou a QE.2 e
  // escolheu uma faixa tem as duas coisas gravadas. Se o desvio olhasse só o pedido, ele
  // continuaria a responder sete perguntas que o motor vai ignorar — porque a faixa de saldo
  // manda no detalhamento inteiro.
  it('voltar e escolher uma faixa faz o detalhamento desaparecer sozinho', () => {
    const respostas: Record<string, any> = { showsPerYear: 12 };
    gravarEscape(respostas, saldo);
    expect(visiveis(respostas)).toContain('cacheFaixa');

    gravarResposta(respostas, saldo, 5);

    expect(respostas._detalhar).toBe(true);      // o pedido continua lá, e não faz mal nenhum
    for (const k of detalhe()) expect(visiveis(respostas)).not.toContain(k);
  });

  it('o convite do cachê por tipo abre a tabela, e o "agora não" fecha-a', () => {
    const base = { showsPerYear: 12, _detalhar: true };
    expect(visiveis({ ...base })).not.toContain('cacheByTypeFaixa');
    expect(visiveis({ ...base, _cachePorTipo: false })).not.toContain('cacheByTypeFaixa');
    expect(visiveis({ ...base, _cachePorTipo: true })).toContain('cacheByTypeFaixa');
  });

  it('o link das fontes abre as nove, e sem ele nenhuma aparece', () => {
    const base = { showsPerYear: 12, _detalhar: true };
    const porFonte = (a: Record<string, any>) =>
      QUIZ.filter((p) => p.key === 'outrasPorFonteFaixa' && !p.skipIf?.(a)).length;

    expect(porFonte(base)).toBe(0);
    expect(porFonte({ ...base, _fontes: true })).toBe(9);
  });

  // As nove gravam na MESMA chave, cada uma na sua fonte. Uma superfície a esquecer a `sub`
  // gravaria a última por cima de todas, e o artista perderia oito respostas sem ver nada.
  it('as nove fontes gravam cada uma na sua chave, dentro do mesmo objeto', () => {
    const respostas: Record<string, any> = {};
    const fontes = QUIZ.filter((p) => p.key === 'outrasPorFonteFaixa');
    gravarResposta(respostas, fontes[0], 3);
    gravarResposta(respostas, fontes[1], 'nao_sei');

    expect(respostas.outrasPorFonteFaixa).toEqual({ distribuidora: 3, editora: 'nao_sei' });
    expect(respostaGravada(respostas, fontes[0])).toBe(3);
    expect(respostaGravada(respostas, fontes[1])).toBe('nao_sei');
    expect(respostaGravada(respostas, fontes[2])).toBeUndefined();
  });

  // O quiz guarda o ÍNDICE da faixa, nunca o dinheiro (§3.2). É o que permite reconstruir piso,
  // ponto médio e rótulo a partir do diagnóstico gravado.
  it('as faixas são gravadas por índice, e os rótulos vêm da escala do motor', () => {
    expect(saldo.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
    expect(saldo.options![5].label).toBe('De R$ 6 mil a R$ 10 mil por mês');
    const cache = QUIZ[indiceDe('cacheFaixa')];
    expect(cache.options!.map((o) => o.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it('cada fonte aceita "não sei", que o relatório devolve como gestão a fazer', () => {
    const fonte = QUIZ.find((p) => p.key === 'outrasPorFonteFaixa')!;
    expect(fonte.options!.map((o) => o.value)).toContain('nao_sei');
  });
});

// ════════ As falas do caminho (QD.z e QD.9) ════════
describe('as falas que substituem a transição do bloco', () => {
  const detalhe = { _detalhar: true, showsPerYear: 12 };

  // Sem palco, o detalhamento abre em `outrasFaixa`, e a ausência das duas perguntas anteriores
  // precisa de explicação — senão a conversa salta do nada para "o que entra fora do palco".
  it('quem não fez show lê o porquê de o palco ficar de fora', () => {
    const texto = transicaoDoBloco(indiceDe('outrasFaixa'), { ...detalhe, showsPerYear: 0 });

    expect(texto).toContain('o palco fica de fora dessa conta');
    // E quem fez show não lê nada ali: para ele, esta não é a primeira pergunta do detalhamento.
    expect(transicaoDoBloco(indiceDe('outrasFaixa'), detalhe)).toBeUndefined();
  });

  it('e quem detalhou lê o fecho da conta antes das duas últimas', () => {
    const texto = transicaoDoBloco(indiceDe('temCnpj'), detalhe);

    expect(texto).toContain('a conta está feita');
    // Quem respondeu a faixa não detalhou nada, e não há conta a fechar.
    expect(transicaoDoBloco(indiceDe('temCnpj'), { saldoFaixa: 5 })).toBeUndefined();
  });
});

// ════════ A barra de progresso ════════
//
// ⚠️ O DETALHAMENTO SAI DO NUMERADOR **E** DO DENOMINADOR, e é por isso que a barra CONGELA em
// vez de recuar. Ele tem de 4 a 16 perguntas conforme o artista abra o cachê por tipo e as nove
// fontes: contá-lo faria o total saltar no instante do toque em "Me ajude a calcular".
describe('a barra de progresso no desvio', () => {
  const antes = { showsPerYear: 12 };
  const dentro = { ...antes, _detalhar: true };

  it('o total não muda quando o artista pede ajuda para calcular', () => {
    expect(totalDaTrilha(dentro)).toBe(totalDaTrilha(antes));
  });

  it('nem quando ele abre o cachê por tipo e as nove fontes', () => {
    expect(totalDaTrilha({ ...dentro, _cachePorTipo: true, _fontes: true }))
      .toBe(totalDaTrilha(antes));
  });

  it('e a posição não anda enquanto ele percorre o detalhamento', () => {
    const naFaixa = posicaoNaTrilha(indiceDe('saldoFaixa'), dentro);
    const noMeio = posicaoNaTrilha(indiceDe('outrasFaixa'), dentro);
    const noFim = posicaoNaTrilha(indiceDe('lancFaixa'), dentro);

    expect(noMeio).toBe(naFaixa);
    expect(noFim).toBe(naFaixa);
    // E volta a andar na pergunta seguinte, que é da trilha.
    expect(posicaoNaTrilha(indiceDe('temCnpj'), dentro)).toBe(naFaixa + 1);
  });

  it('nenhuma pergunta do detalhamento conta na trilha', () => {
    for (const p of QUIZ.filter((q) => q.bloco === 'detalhe')) {
      expect(naTrilha(p, dentro)).toBe(false);
    }
  });

  // A barra chega a 100%: a última pergunta da trilha é a última do array.
  it('a trilha acaba na última pergunta do quiz', () => {
    expect(posicaoNaTrilha(QUIZ.length - 1, dentro)).toBe(totalDaTrilha(dentro));
  });
});
