import {
  QUIZ, TRANSICOES, CTX_API, transicaoDoBloco, enunciado, proximaPergunta, perguntaAnterior,
  colunaMarcada, LINHA_SEM_ESCOLHA, mapaDaTabela, respostaDaTabela, type QuizDef,
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

describe('a ordem do quiz (v4.2, §3)', () => {
  it('é a sequência da metodologia, do mais leve ao mais sensível', () => {
    expect(chaves()).toEqual([
      'vinculo',
      'showsPerYear', 'fazBilheteria', 'pagantePct',
      'igFollowersSelf', 'tiktokFollowersSelf', 'youtubeViews28dSelf',
      'imprensaRepercussao', 'imprensaMatrix', 'imprensaFrequencia', 'premios',
      'temCnpj', 'aliquota', 'temEmpresario',
      'cacheByType', 'revenueSources', 'custoPorShow', 'custoFixoMensal', 'investLancamentos12m',
    ]);
  });

  // O PRINCÍPIO por trás da lista acima, dito sozinho: se alguém reordenar de novo, este é o que
  // explica o porquê no relatório de falha.
  it('nenhuma pergunta de dinheiro vem antes de uma que não é', () => {
    const ultimaQueNaoEDinheiro = QUIZ.map((p) => p.bloco).lastIndexOf('estrutura');
    const primeiraDeDinheiro = QUIZ.findIndex((p) => p.bloco === 'numeros');

    expect(primeiraDeDinheiro).toBeGreaterThan(ultimaQueNaoEDinheiro);
  });

  // A contagem de shows é do bloco E e mesmo assim abre o quiz — e não é só estética: dela
  // dependem os dois `skipIf` do bloco dos números.
  it('a contagem de shows vem antes do que depende dela', () => {
    expect(indiceDe('showsPerYear')).toBeLessThan(indiceDe('cacheByType'));
    expect(indiceDe('showsPerYear')).toBeLessThan(indiceDe('custoPorShow'));
  });
});

describe('as transições de bloco', () => {
  it('abrem a primeira pergunta de cada bloco', () => {
    expect(transicaoDoBloco(indiceDe('showsPerYear'), {})).toBe(TRANSICOES.shows);
    expect(transicaoDoBloco(indiceDe('imprensaRepercussao'), {})).toBe(TRANSICOES.reconhecimento);
    expect(transicaoDoBloco(indiceDe('temCnpj'), {})).toBe(TRANSICOES.estrutura);
    expect(transicaoDoBloco(indiceDe('cacheByType'), { showsPerYear: 4 })).toBe(TRANSICOES.numeros);
  });

  it('não se repetem no meio do bloco', () => {
    expect(transicaoDoBloco(indiceDe('fazBilheteria'), {})).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('premios'), {})).toBeUndefined();
    expect(transicaoDoBloco(indiceDe('temEmpresario'), {})).toBeUndefined();
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

describe('o enunciado do cachê retoma o número de shows', () => {
  it('traz o que a pessoa respondeu no primeiro bloco', () => {
    const cache = QUIZ[indiceDe('cacheByType')];

    expect(enunciado(cache, { showsPerYear: 12 })).toContain('fez 12 shows no último ano');
  });

  // Concordância: o marcador carrega o substantivo junto do número, senão sai "fez 1 shows".
  it('concorda no singular', () => {
    const cache = QUIZ[indiceDe('cacheByType')];

    expect(enunciado(cache, { showsPerYear: 1 })).toContain('fez 1 show no último ano');
  });

  it('não sobra marcador na tela quando a resposta é estranha', () => {
    const cache = QUIZ[indiceDe('cacheByType')];

    expect(enunciado(cache, {})).not.toContain('{');
    expect(enunciado(cache, { showsPerYear: 'oito' })).not.toContain('{');
  });

  it('as outras perguntas passam intactas', () => {
    QUIZ.filter((p) => p.key !== 'cacheByType')
      .forEach((p) => expect(enunciado(p, { showsPerYear: 12 })).toBe(p.q));
  });
});

// Quem não fez show nenhum não tem cachê médio nem custo por show. Sem isto, o enunciado novo
// perguntaria o cachê de quem "fez 0 shows no último ano" — e a v4.2 é justamente o documento
// que existe para o quiz parar de soar como interrogatório.
describe('quem não fez show não responde sobre show', () => {
  it('pula o cachê e o custo por show', () => {
    const visiveis = perguntasVisiveis({ showsPerYear: 0 });

    expect(visiveis).not.toContain('cacheByType');
    expect(visiveis).not.toContain('custoPorShow');
    expect(visiveis).toContain('revenueSources');
  });

  it('quem fez ao menos um responde os dois', () => {
    const visiveis = perguntasVisiveis({ showsPerYear: 1 });

    expect(visiveis).toContain('cacheByType');
    expect(visiveis).toContain('custoPorShow');
  });

  // A ida e a volta precisam pular o mesmo tanto, senão o "Voltar" cai numa pergunta que a tela
  // acabou de decidir que não existe.
  it('o voltar pula os mesmos que o avançar', () => {
    const respostas = { showsPerYear: 0 };

    expect(proximaPergunta(indiceDe('cacheByType'), respostas)).toBe(indiceDe('revenueSources'));
    expect(perguntaAnterior(indiceDe('custoPorShow'), respostas)).toBe(indiceDe('revenueSources'));
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
