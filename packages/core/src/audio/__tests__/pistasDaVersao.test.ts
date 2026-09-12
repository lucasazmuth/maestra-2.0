import type { CatalogVersion } from '../../interfaces/maestra';
import {
  DURACAO_DESCONHECIDA, ID_DA_MIX, NOME_DA_MIX, copiaDoClipe, ehPistaDaMix, fimDaPista, montagemDaVersao, nomeDaPistaNova, pistaAlvoDoArrasto, pistasDaGravacao, proximaCorDaPista, proximaPosicaoDaPista,
} from '../pistasDaVersao';

// A ponte entre o banco e a mesa: três tabelas de um lado (ficheiros, pistas, clipes), uma
// montagem do outro.

const versao = (over: Partial<CatalogVersion> = {}): CatalogVersion => ({
  id: 'v1', project_id: 'p1', version_number: 1,
  audio_file: 'https://x/mix.mp3',
  ...over,
} as CatalogVersion);

describe('montagemDaVersao', () => {
  // ⚠️ Toda gravação que já existe hoje tem um `audio_file` e nenhuma pista, e tem de continuar
  // a tocar ao abrir, sem ninguém montar nada.
  it('sem montagem, a mix entra sozinha, do zero', () => {
    const montagem = montagemDaVersao(versao());
    expect(montagem).toHaveLength(1);
    expect(montagem[0].nome).toBe(NOME_DA_MIX);
    expect(montagem[0].clipes[0]).toMatchObject({
      url: 'https://x/mix.mp3', inicio: 0, recorte: 0, duracao: DURACAO_DESCONHECIDA,
    });
  });

  it('sem montagem e sem áudio, não há o que tocar', () => {
    expect(montagemDaVersao(versao({ audio_file: null }))).toEqual([]);
    expect(montagemDaVersao(null)).toEqual([]);
  });

  // ⚠️ Assim que existe montagem, a mix SAI DE CENA. Ela é a soma das camadas: tocá-la junto
  // faria cada instrumento soar duas vezes, ligeiramente desalinhado.
  it('com pistas montadas, a mix não entra', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 0.8, muted: false, color_index: 2,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 4, offset_seconds: 1, duration_seconds: 3 }],
      }],
    }));

    expect(montagem).toHaveLength(1);
    expect(montagem[0].nome).toBe('Voz');
    expect(montagem.some((p) => p.nome === NOME_DA_MIX)).toBe(false);
  });

  it('traz o volume e o mudo guardados, e resolve a URL pelo ficheiro', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 0.4, muted: true, color_index: 0,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
      }],
    }));

    expect(montagem[0]).toMatchObject({ ganhoInicial: 0.4, mudaInicial: true });
    expect(montagem[0].clipes[0].url).toBe('https://x/voz.wav');
  });

  // O NOME do clipe é o do ficheiro, sem a extensão — é ele que a linha do tempo escreve no
  // canto, no lugar de "Take N". Sai do ficheiro e não do clipe porque cortar um clipe em dois
  // faz duas linhas novas que continuam a tocar o mesmo ficheiro: as duas metades têm de
  // continuar a dizer de onde vieram.
  it('o clipe leva o nome do ficheiro, sem a extensão', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'voz_dobra.wav', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [
          { id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 },
          { id: 'c2', track_id: 't1', file_id: 'f1', start_seconds: 5, offset_seconds: 5, duration_seconds: 5 },
        ],
      }],
    }));

    expect(montagem[0].clipes.map((c) => c.nome)).toEqual(['voz dobra', 'voz dobra']);
  });

  // Sem ficheiro com nome não há rótulo nenhum, e a tela volta ao número do take. Um `''` aqui
  // seria pior do que `undefined`: a tela veria um nome e escreveria um canto vazio.
  it('sem nome de ficheiro, o clipe fica sem nome', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: '', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'f1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
      }],
    }));

    expect(montagem[0].clipes[0].nome).toBeUndefined();
  });

  // Um clipe cujo ficheiro sumiu é uma linha órfã: some da mesa em vez de a derrubar com uma
  // URL indefinida.
  it('um clipe sem ficheiro não entra', () => {
    const montagem = montagemDaVersao(versao({
      files: [],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [{ id: 'c1', track_id: 't1', file_id: 'sumiu', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
      }],
    }));
    expect(montagem[0].clipes).toEqual([]);
  });

  // O banco devolve `numeric` como texto: sem a conversão, `inicio` viria "4" e a aritmética do
  // agendamento faria concatenação em vez de soma.
  it('os segundos chegam como número, mesmo vindo como texto', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [{
          id: 'c1', track_id: 't1', file_id: 'f1',
          start_seconds: '4.5' as unknown as number,
          offset_seconds: '1.25' as unknown as number,
          duration_seconds: '3' as unknown as number,
        }],
      }],
    }));
    expect(montagem[0].clipes[0]).toMatchObject({ inicio: 4.5, recorte: 1.25, duracao: 3 });
  });

  it('os clipes saem na ordem do tempo', () => {
    const montagem = montagemDaVersao(versao({
      files: [{ id: 'f1', version_id: 'v1', name: 'Voz', file_url: 'https://x/voz.wav' }],
      tracks: [{
        id: 't1', version_id: 'v1', name: 'Voz', position: 0, gain: 1, muted: false, color_index: 0,
        clips: [
          { id: 'tarde', track_id: 't1', file_id: 'f1', start_seconds: 10, offset_seconds: 0, duration_seconds: 2 },
          { id: 'cedo', track_id: 't1', file_id: 'f1', start_seconds: 1, offset_seconds: 0, duration_seconds: 2 },
        ],
      }],
    }));
    expect(montagem[0].clipes.map((c) => c.id)).toEqual(['cedo', 'tarde']);
  });
});

describe('pistasDaGravacao', () => {
  it('ordena pela posição, e desempata pela chegada', () => {
    const faixas = pistasDaGravacao(versao({
      tracks: [
        { id: 'b', version_id: 'v1', name: 'B', position: 1, gain: 1, muted: false, color_index: 0 },
        { id: 'a2', version_id: 'v1', name: 'A2', position: 0, gain: 1, muted: false, color_index: 0, created_at: '2026-02-01' },
        { id: 'a1', version_id: 'v1', name: 'A1', position: 0, gain: 1, muted: false, color_index: 0, created_at: '2026-01-01' },
      ],
    }));
    // Sem o desempate, duas pistas com a mesma posição trocariam de lugar a cada leitura.
    expect(faixas.map((f) => f.id)).toEqual(['a1', 'a2', 'b']);
  });
});

// ⚠️ ARRASTAR UM CLIPE ENTRE FAIXAS NÃO EXISTIA: na web o arrasto só olhava para o eixo do
// tempo, e no app o gesto era cancelado assim que o dedo subia 14 pontos. Mover a voz da faixa
// errada para a certa obrigava a apagar o clipe e enviar o ficheiro outra vez.
//
// A regra mora aqui porque o GESTO é diferente nas duas telas e a DECISÃO é a mesma: na web o
// índice sai do `y` do ponteiro sobre a pilha, no app sai de quantas alturas de faixa o dedo
// percorreu.
describe('pistaAlvoDoArrasto', () => {
  const pilha = [{ id: 't1' }, { id: 't2' }, { id: 't3' }];

  it('devolve a faixa apontada', () => {
    expect(pistaAlvoDoArrasto(pilha, 0, 2)).toBe('t3');
    expect(pistaAlvoDoArrasto(pilha, 2, 0)).toBe('t1');
  });

  // Meio caminho entre duas linhas é a linha mais perto — e não a de cima, sempre.
  it('arredonda para a linha mais perto', () => {
    expect(pistaAlvoDoArrasto(pilha, 0, 0.6)).toBe('t2');
    expect(pistaAlvoDoArrasto(pilha, 0, 0.4)).toBeUndefined();
  });

  // ⚠️ Sem o travão, arrastar para baixo da última faixa dava um índice que não existe, e o
  // clipe desaparecia da montagem até ao recarregamento seguinte.
  it('trava no que existe, acima e abaixo', () => {
    expect(pistaAlvoDoArrasto(pilha, 0, 9)).toBe('t3');
    expect(pistaAlvoDoArrasto(pilha, 2, -9)).toBe('t1');
  });

  // "Não mudou de faixa" tem de ser distinguível de "mudou", e é essa distinção que impede um
  // toque de contar como arrasto.
  it('ficar na mesma faixa não é mudar de faixa', () => {
    expect(pistaAlvoDoArrasto(pilha, 1, 1)).toBeUndefined();
  });

  // A Mix é a SOMA das camadas, montada na hora, e não tem linha no banco: mover um clipe para
  // dentro dela — ou tirar um de lá — seria escrever numa pista que não existe.
  it('a Mix não sai de casa nem recebe visitas', () => {
    const comMix = [{ id: ID_DA_MIX }, { id: 't2' }];
    expect(pistaAlvoDoArrasto(comMix, 0, 1)).toBeUndefined();
    expect(pistaAlvoDoArrasto(comMix, 1, 0)).toBeUndefined();
  });

  it('uma pilha vazia não manda o clipe para lado nenhum', () => {
    expect(pistaAlvoDoArrasto([], 0, 0)).toBeUndefined();
  });
});

// A faixa que nasce vazia precisa de um nome, e ele tem de ser ÚNICO: duas faixas com o mesmo
// nome na coluna são a forma mais barata de alguém calar a errada.
describe('nomeDaPistaNova', () => {
  it('começa no um', () => {
    expect(nomeDaPistaNova([])).toBe('Faixa 1');
  });

  // ⚠️ O PRIMEIRO LIVRE, e não o total mais um: com quatro faixas e a segunda apagada, "total
  // + 1" dava `Faixa 4` — que já existia.
  it('usa o primeiro número livre, e não o total mais um', () => {
    expect(nomeDaPistaNova(['Faixa 1', 'Faixa 3', 'Faixa 4'])).toBe('Faixa 2');
  });

  // Quem baptizou uma faixa de "Voz" não fica a dever um número.
  it('ignora os nomes que ninguém pôs assim', () => {
    expect(nomeDaPistaNova(['Voz', 'Bateria', 'Faixa dobrada', 'Faixa 10 b'])).toBe('Faixa 1');
  });
});

// ⚠️ APANHADO NO PRODUTO, com a primeira faixa criada por este botão: a música de teste tinha
// uma faixa em `position: 1`, e "a contagem das faixas" deu 1 outra vez. Duas faixas empatadas,
// e a ordem da coluna a ser decidida pelo desempate da data de criação.
describe('proximaPosicaoDaPista', () => {
  it('a primeira faixa entra no zero', () => {
    expect(proximaPosicaoDaPista([])).toBe(0);
  });

  it('vai depois da última, e não no número de faixas', () => {
    // Uma faixa só, em 1: a contagem daria 1 — empatada com a que já existe.
    expect(proximaPosicaoDaPista([1])).toBe(2);
    // Um buraco no meio não puxa a faixa nova para trás.
    expect(proximaPosicaoDaPista([0, 1, 5])).toBe(6);
  });

  it('uma posição que veio do banco como texto continua a ser um número', () => {
    expect(proximaPosicaoDaPista(['2' as unknown as number])).toBe(3);
  });
});

describe('ehPistaDaMix', () => {
  it('reconhece só a pista montada na hora', () => {
    expect(ehPistaDaMix(ID_DA_MIX)).toBe(true);
    expect(ehPistaDaMix('t1')).toBe(false);
  });
});

// ⚠️ A COR DA FAIXA É UM FACTO GUARDADO, e não uma conta da tela.
//
// Cada superfície derivava-a da POSIÇÃO na lista, e a mesma faixa saía roxa no computador e
// amarela no telemóvel — a mesma montagem lida como dois produtos. Pior: a cor mudava sozinha ao
// apagar outra faixa, porque as de baixo subiam um lugar.
describe('a cor da faixa na montagem', () => {
  const comCor = (cor: number | null) => ({
    id: 't1', name: 'Voz', position: 0, gain: 1, muted: false, pan: 0, color_index: cor,
    clips: [{ id: 'c1', file_id: 'f1', start_seconds: 0, offset_seconds: 0, duration_seconds: 5 }],
  });
  const gravacao = (faixa: unknown) => ({
    id: 'v1', version_number: 1, tracks: [faixa],
    files: [{ id: 'f1', name: 'voz.wav', file_url: 'u', kind: 'stem' }],
  });

  it('viaja com a montagem, para as duas telas lerem a mesma', () => {
    expect(montagemDaVersao(gravacao(comCor(4)) as never)[0].cor).toBe(4);
  });

  // Uma montagem antiga pode não ter cor guardada; aí quem desenha usa a posição, e é por isso
  // que a falta vem como `undefined` e não como um número inventado aqui.
  it('sem cor guardada, não inventa uma', () => {
    expect(montagemDaVersao(gravacao(comCor(null)) as never)[0].cor).toBeUndefined();
  });

  // ⚠️ E O ZERO É UMA COR. `?? undefined` sobre um `0` guardado devolveria `0`; um `||` teria
  // devolvido `undefined` e pintado a faixa com a posição dela.
  it('a cor zero é uma cor, e não a ausência de uma', () => {
    expect(montagemDaVersao(gravacao(comCor(0)) as never)[0].cor).toBe(0);
  });
});

// ⚠️ ERA `pistas.length % 6`, E ISSO REPETIA. Contar quantas faixas há não diz nada sobre QUAIS
// cores estão em uso: basta apagar uma do meio para o contador voltar a um número ocupado. Foi
// assim que duas faixas da mesma gravação ficaram as duas roxas.
describe('proximaCorDaPista', () => {
  it('escolhe a primeira cor que ninguém está a usar', () => {
    expect(proximaCorDaPista([0, 1])).toBe(2);
    expect(proximaCorDaPista([])).toBe(0);
  });

  // O caso que o contador errava: um buraco no meio volta a ser preenchido.
  it('preenche o buraco de uma faixa apagada, em vez de repetir', () => {
    expect(proximaCorDaPista([0, 2, 3])).toBe(1);
  });

  it('atravessa faixas antigas sem cor guardada', () => {
    expect(proximaCorDaPista([0, null, undefined, 1])).toBe(2);
  });

  // Esgotadas as seis, repete — mas pela contagem, para as repetições ficarem espalhadas em vez
  // de caírem todas na primeira cor.
  it('com a paleta cheia, reparte as repetições', () => {
    expect(proximaCorDaPista([0, 1, 2, 3, 4, 5])).toBe(0);
    expect(proximaCorDaPista([0, 1, 2, 3, 4, 5, 0])).toBe(1);
  });

  // Um índice fora da paleta é o mesmo lugar dela: sem isto, um `7` guardado deixava a cor 1
  // livre aos olhos desta conta e duas faixas ficavam iguais.
  it('um índice além da paleta conta pela cor que ele pinta', () => {
    expect(proximaCorDaPista([0, 7])).toBe(2);
  });
});

// DUPLICAR UM CLIPE: a cópia encostada ao fim do original.
//
// É o gesto de quem monta uma estrutura — o refrão outra vez, a base a repetir — e não copia
// áudio nenhum: a cópia aponta para o mesmo ficheiro, com o mesmo recorte. O que ela decide é
// UM número, o segundo em que entra, e é esse número que este bloco prende.
describe('copiaDoClipe', () => {
  const original = {
    track_id: 't1', file_id: 'f1',
    start_seconds: 12, offset_seconds: 3, duration_seconds: 8,
  };

  // ⚠️ ONDE O ORIGINAL ACABA, e não onde ele começa. Duas cópias no mesmo segundo soariam como
  // um clipe só, mais alto, e leriam-se como defeito — a pessoa carregou uma vez e vê uma coisa.
  it('entra no segundo em que o original termina', () => {
    expect(copiaDoClipe(original).start_seconds).toBe(20);
  });

  // O recorte dentro do ficheiro é o MESMO: a cópia é o mesmo pedaço de áudio, noutro lugar da
  // linha do tempo. Somar a duração aqui — o engano natural, por simetria com o início — daria
  // uma cópia que toca a parte SEGUINTE do ficheiro, e que soa diferente do que se duplicou.
  it('leva o mesmo recorte, o mesmo comprimento e o mesmo ficheiro', () => {
    expect(copiaDoClipe(original)).toEqual({
      track_id: 't1', file_id: 'f1',
      start_seconds: 20, offset_seconds: 3, duration_seconds: 8,
    });
  });

  // ⚠️ E FICA NA MESMA FAIXA. Duplicar é repetir aqui; mandar a cópia para outra pista seria
  // um gesto diferente, que ninguém pediu e que o arrasto já faz.
  it('a cópia nasce na faixa do original', () => {
    expect(copiaDoClipe({ ...original, track_id: 't9' }).track_id).toBe('t9');
  });

  // Os números chegam do Postgres como TEXTO (`numeric`). Sem o `Number`, `'12' + '8'` punha a
  // cópia a começar no segundo 128 — dez minutos de silêncio à frente dela, numa montagem que
  // parecia vazia.
  it('os segundos que chegam como texto somam-se como números', () => {
    expect(copiaDoClipe({
      track_id: 't1', file_id: 'f1',
      start_seconds: '12', offset_seconds: '3', duration_seconds: '8',
    }).start_seconds).toBe(20);
  });
});

// ONDE ENTRA O ÁUDIO NOVO DE UMA FAIXA QUE JÁ TEM ÁUDIO.
//
// Antes: no segundo zero, em cima do que já lá estava — dois clipes no mesmo sítio, a tocar ao
// mesmo tempo e desenhados um por cima do outro. Agora encosta ao fim, e sobrepor passa a ser
// uma escolha de quem arrasta.
describe('fimDaPista', () => {
  it('uma faixa vazia acaba no zero, que é onde o primeiro clipe nasce', () => {
    expect(fimDaPista([])).toBe(0);
    expect(fimDaPista(null)).toBe(0);
    expect(fimDaPista(undefined)).toBe(0);
  });

  it('acaba onde o clipe termina, e não onde ele começa', () => {
    expect(fimDaPista([{ start_seconds: 10, duration_seconds: 5 }])).toBe(15);
  });

  // ⚠️ O FIM DE CADA UM, e não o do que começa mais tarde. Um clipe de dois segundos largado no
  // minuto 3 acaba ANTES de um de quatro minutos que começou no zero: escolher pelo início mais
  // alto punha o take novo por cima do comprido, que é exatamente o defeito que isto resolve.
  it('escolhe o que termina mais tarde, mesmo que comece mais cedo', () => {
    expect(fimDaPista([
      { start_seconds: 0, duration_seconds: 240 },
      { start_seconds: 180, duration_seconds: 2 },
    ])).toBe(240);
  });

  // ⚠️ OS SEGUNDOS CHEGAM DO POSTGRES COMO TEXTO (`numeric`), e sem o `Number` o `+` CONCATENA:
  // '10' e '5' dão '105' em vez de 15, e o take novo nasce um minuto e meio à frente, num sítio
  // que parece um engano do produto.
  //
  // ⚠️ E O CASO PRECISA DE NÚMEROS EM QUE CONCATENAR DÊ OUTRA COISA. O meu primeiro era
  // '0'+'240' contra '0'+'9', e passava com o defeito lá dentro: o `Math.max` numera os textos
  // outra vez, e '0240' volta a ser 240. A mutação sobreviveu, e foi ela que apanhou o caso.
  it('os segundos que chegam como texto somam-se como números', () => {
    expect(fimDaPista([{ start_seconds: '10', duration_seconds: '5' }])).toBe(15);
  });
});
