import { conferirOPasso, type MundoDaMontagem, type PassoDaMontagem } from '../historico';

// A SETA COM MAIS DE UMA PESSOA NA SALA.
//
// A pilha é de cada um: só entra nela o que EU fiz. O perigo nunca foi desfazer o passo do
// outro — é desfazer o MEU por cima do que o outro fez a seguir.
//
// Eu movo o clipe de 5 para 12. O Nuno move-o para 30. Eu carrego na seta, e ela escreve 5: o
// meu passo volta e o trabalho dele desaparece, sem aviso e sem forma de o trazer de volta,
// porque a pilha dele nunca soube que aquilo aconteceu.
//
// A regra é uma só: a seta anda se o mundo ainda estiver como o meu passo o deixou.

const clipe = (over: Partial<MundoDaMontagem['clipes'][0]> = {}) => ({
  id: 'c1', track_id: 't1', start_seconds: 12, duration_seconds: 5, ...over,
});

const mundo = (over: Partial<MundoDaMontagem> = {}): MundoDaMontagem => ({
  pistas: [{ id: 't1', clips: [{ id: 'c1' }] }],
  clipes: [clipe()],
  ...over,
});

const mover: PassoDaMontagem = { tipo: 'mover', clipeId: 'c1', de: 5, para: 12 };

describe('conferirOPasso — mover', () => {
  it('anda quando o clipe está onde eu o deixei', () => {
    expect(conferirOPasso(mover, mundo(), 'desfazer')).toBeNull();
  });

  // ⚠️ O CASO QUE ISTO EXISTE PARA IMPEDIR: o meu 5 por cima do 30 dele.
  it('não anda quando alguém moveu o clipe depois de mim', () => {
    const depois = mundo({ clipes: [clipe({ start_seconds: 30 })] });
    expect(conferirOPasso(mover, depois, 'desfazer')).toBe('Alguém mexeu nisto depois de você.');
  });

  // Arrastar entre faixas conta como mexer: o segundo pode ser o mesmo e a faixa outra.
  it('não anda quando alguém levou o clipe para outra faixa', () => {
    const passo: PassoDaMontagem = { ...mover, dePista: 't1', paraPista: 't2' };
    const depois = mundo({ clipes: [clipe({ track_id: 't3' })] });
    expect(conferirOPasso(passo, depois, 'desfazer')).not.toBeNull();
  });

  it('não anda quando o clipe já nem existe', () => {
    expect(conferirOPasso(mover, mundo({ clipes: [] }), 'desfazer')).not.toBeNull();
  });

  // ⚠️ REFAZER ESPERA O CONTRÁRIO: o clipe onde ele estava ANTES de mim. Sem isto, a seta da
  // direita andava sempre — e refazer por cima do trabalho de outra pessoa é o mesmo estrago.
  it('refazer espera o clipe onde ele estava antes de mim', () => {
    expect(conferirOPasso(mover, mundo({ clipes: [clipe({ start_seconds: 5 })] }), 'refazer')).toBeNull();
    expect(conferirOPasso(mover, mundo(), 'refazer')).not.toBeNull();
  });

  // Os segundos viajam como texto e voltam como número: uma diferença na quarta casa não é
  // alguém a mexer, é aritmética.
  it('uma poeira de arredondamento não conta como mexida', () => {
    const quase = mundo({ clipes: [clipe({ start_seconds: 12.001 })] });
    expect(conferirOPasso(mover, quase, 'desfazer')).toBeNull();
  });
});

describe('conferirOPasso — apagar', () => {
  const apagarClipe: PassoDaMontagem = { tipo: 'apagarClipe', clipeId: 'c1' };
  const apagarPista: PassoDaMontagem = { tipo: 'apagarPista', pistaId: 't1' };

  // Desfazer um "apagar" só faz sentido se ele ainda estiver fora de cena. Se alguém já o
  // trouxe de volta, a minha seta traria de volta uma coisa que já voltou.
  it('desfazer exige que ele continue removido', () => {
    expect(conferirOPasso(apagarClipe, mundo({ clipes: [] }), 'desfazer')).toBeNull();
    expect(conferirOPasso(apagarClipe, mundo(), 'desfazer')).not.toBeNull();
  });

  it('o mesmo para a pista', () => {
    expect(conferirOPasso(apagarPista, mundo({ pistas: [] }), 'desfazer')).toBeNull();
    expect(conferirOPasso(apagarPista, mundo(), 'desfazer')).not.toBeNull();
  });

  it('refazer exige o contrário: que ele tenha voltado', () => {
    expect(conferirOPasso(apagarClipe, mundo(), 'refazer')).toBeNull();
    expect(conferirOPasso(apagarClipe, mundo({ clipes: [] }), 'refazer')).not.toBeNull();
  });
});

describe('conferirOPasso — cortar', () => {
  const cortar: PassoDaMontagem = {
    tipo: 'cortar', clipeId: 'c1', duracaoAntes: 10, duracaoDepois: 4, novoClipeId: 'c2',
  };
  const partido = mundo({
    clipes: [clipe({ duration_seconds: 4 }), clipe({ id: 'c2', start_seconds: 16 })],
  });

  it('desfazer exige os dois pedaços como o corte os deixou', () => {
    expect(conferirOPasso(cortar, partido, 'desfazer')).toBeNull();
  });

  it('não anda se alguém esticou o pedaço da esquerda', () => {
    const esticado = mundo({
      clipes: [clipe({ duration_seconds: 7 }), clipe({ id: 'c2', start_seconds: 16 })],
    });
    expect(conferirOPasso(cortar, esticado, 'desfazer')).not.toBeNull();
  });

  it('não anda se alguém removeu o pedaço da direita', () => {
    const semDireito = mundo({ clipes: [clipe({ duration_seconds: 4 })] });
    expect(conferirOPasso(cortar, semDireito, 'desfazer')).not.toBeNull();
  });

  it('refazer espera o clipe inteiro, e sem o pedaço da direita', () => {
    const inteiro = mundo({ clipes: [clipe({ duration_seconds: 10 })] });
    expect(conferirOPasso(cortar, inteiro, 'refazer')).toBeNull();
    expect(conferirOPasso(cortar, partido, 'refazer')).not.toBeNull();
  });
});

// ⚠️ DUPLICAR É O ESPELHO DE APAGAR, e é por isso que tem os seus próprios casos: a cópia tem
// de EXISTIR para eu poder desfazer, e tem de estar FORA para eu poder refazer. Tratá-la como
// um `cortar` — o engano natural, por serem os dois "nasce um clipe novo" — faria a conferência
// exigir uma duração do original que duplicar nunca mexeu.
describe('conferirOPasso — duplicar', () => {
  const duplicar: PassoDaMontagem = { tipo: 'duplicar', clipeId: 'c1', novoClipeId: 'c2' };
  const comACopia = mundo({ clipes: [clipe(), clipe({ id: 'c2', start_seconds: 17 })] });

  it('desfazer exige que a cópia ainda esteja lá', () => {
    expect(conferirOPasso(duplicar, comACopia, 'desfazer')).toBeNull();
  });

  it('não anda se alguém já removeu a cópia', () => {
    expect(conferirOPasso(duplicar, mundo(), 'desfazer')).toBe('Alguém mexeu nisto depois de você.');
  });

  it('refazer exige o contrário: que ela tenha saído', () => {
    expect(conferirOPasso(duplicar, mundo(), 'refazer')).toBeNull();
    expect(conferirOPasso(duplicar, comACopia, 'refazer')).toBe('Alguém mexeu nisto depois de você.');
  });
});

describe('conferirOPasso — acrescentar faixas', () => {
  const criar: PassoDaMontagem = { tipo: 'acrescentarPistas', pistaIds: ['t1'] };

  it('desfazer anda enquanto a faixa continuar vazia', () => {
    const vazia = mundo({ pistas: [{ id: 't1', clips: [] }], clipes: [] });
    expect(conferirOPasso(criar, vazia, 'desfazer')).toBeNull();
  });

  // ⚠️ O CASO QUE MAIS DÓI: a faixa nasceu do meu gesto, e dez minutos depois tem a voz que a
  // outra pessoa acabou de enviar. A seta apagava o trabalho dela para desmanchar um gesto meu.
  it('não anda quando a faixa já tem áudio de alguém', () => {
    expect(conferirOPasso(criar, mundo(), 'desfazer')).toBe('Esta faixa já tem áudio de alguém.');
  });

  it('não anda quando a faixa já nem existe', () => {
    expect(conferirOPasso(criar, mundo({ pistas: [] }), 'desfazer')).not.toBeNull();
  });

  it('refazer espera que ela esteja fora de cena', () => {
    expect(conferirOPasso(criar, mundo({ pistas: [] }), 'refazer')).toBeNull();
    expect(conferirOPasso(criar, mundo(), 'refazer')).not.toBeNull();
  });
});
