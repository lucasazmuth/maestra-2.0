import type { CatalogVersion } from '../../interfaces/maestra';
import {
  DURACAO_DESCONHECIDA, ID_DA_MIX, NOME_DA_MIX, ehPistaDaMix, montagemDaVersao,
  nomeDaPistaNova, pistaAlvoDoArrasto, pistasDaGravacao, proximaPosicaoDaPista,
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
