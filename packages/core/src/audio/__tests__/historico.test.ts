import {
  HISTORICO_VAZIO, LIMITE_DO_HISTORICO,
  desfazer, podeDesfazer, podeRefazer, refazer, registar, rotuloDaSeta,
  type PassoDaMontagem,
} from '../historico';

// AS DUAS SETAS DA MONTAGEM.
//
// Uma linha do tempo sem desfazer é uma linha do tempo onde ninguém experimenta: corta-se um
// clipe com medo e apaga-se uma pista com mais medo ainda. Estes testes prendem as quatro
// coisas que fazem um desfazer deixar de merecer confiança — perder a ordem, esquecer o que
// desfez, refazer uma montagem que já não existe, e crescer sem fim.

const mover = (n: number): PassoDaMontagem => ({ tipo: 'mover', clipeId: `c${n}`, de: n, para: n + 1 });

describe('a pilha', () => {
  it('desfaz na ordem inversa de quem fez', () => {
    let h = registar(registar(registar(HISTORICO_VAZIO, mover(1)), mover(2)), mover(3));

    const terceiro = desfazer(h)!;
    expect(terceiro.passo).toEqual(mover(3));
    const segundo = desfazer(terceiro.historico)!;
    expect(segundo.passo).toEqual(mover(2));
    const primeiro = desfazer(segundo.historico)!;
    expect(primeiro.passo).toEqual(mover(1));

    h = primeiro.historico;
    expect(podeDesfazer(h)).toBe(false);
    expect(desfazer(h)).toBeNull();
  });

  it('refazer devolve na ordem em que se desfez', () => {
    const h = registar(registar(HISTORICO_VAZIO, mover(1)), mover(2));
    const a = desfazer(h)!;
    const b = desfazer(a.historico)!;

    const volta1 = refazer(b.historico)!;
    expect(volta1.passo).toEqual(mover(1));
    const volta2 = refazer(volta1.historico)!;
    expect(volta2.passo).toEqual(mover(2));
    expect(podeRefazer(volta2.historico)).toBe(false);
    expect(refazer(volta2.historico)).toBeNull();
  });

  // ⚠️ FAZER ALGO NOVO APAGA O FUTURO. Sem isto, o refazer prometia devolver uma montagem que
  // já não existe: os clipes mudaram de sítio por baixo dele, e a seta punha o projeto num
  // estado que ninguém pediu nem reconhece.
  it('um passo novo depois de desfazer larga o que se ia refazer', () => {
    const h = registar(registar(HISTORICO_VAZIO, mover(1)), mover(2));
    const depois = desfazer(h)!.historico;
    expect(podeRefazer(depois)).toBe(true);

    const comOutro = registar(depois, mover(9));
    expect(podeRefazer(comOutro)).toBe(false);
    expect(desfazer(comOutro)!.passo).toEqual(mover(9));
  });

  // ⚠️ E TEM TETO. Uma sessão dura horas e um arrasto rende dezenas de passos por minuto; sem
  // limite a lista cresce para sempre, a segurar ids de coisas que já não existem.
  it('guarda os últimos e larga os mais velhos', () => {
    let h = HISTORICO_VAZIO;
    for (let i = 0; i < LIMITE_DO_HISTORICO + 10; i += 1) h = registar(h, mover(i));

    expect(h.passado).toHaveLength(LIMITE_DO_HISTORICO);
    // O topo é o mais recente, e o fundo já não é o primeiro de todos.
    expect(h.passado[h.passado.length - 1]).toEqual(mover(LIMITE_DO_HISTORICO + 9));
    expect(h.passado[0]).toEqual(mover(10));
  });

  it('refazer também respeita o teto', () => {
    let h = HISTORICO_VAZIO;
    for (let i = 0; i < LIMITE_DO_HISTORICO; i += 1) h = registar(h, mover(i));
    const desfeito = desfazer(h)!.historico;
    const refeito = refazer(desfeito)!.historico;
    expect(refeito.passado).toHaveLength(LIMITE_DO_HISTORICO);
  });

  // A pilha não muda por baixo de quem a segura: cada operação devolve uma nova.
  it('não mexe na pilha que recebeu', () => {
    const h = registar(HISTORICO_VAZIO, mover(1));
    const antes = JSON.stringify(h);
    registar(h, mover(2));
    desfazer(h);
    refazer(h);
    expect(JSON.stringify(h)).toBe(antes);
  });
});

// ⚠️ UMA SETA MUDA NÃO SE USA. Duas setas iguais lado a lado não dizem o que vão desmanchar, e
// quem hesita não carrega.
describe('o que a seta diz', () => {
  it('nomeia o passo que vai desfazer', () => {
    expect(rotuloDaSeta('Desfazer', { tipo: 'apagarPista', pistaId: 'p' }))
      .toBe('Desfazer: apagar a pista');
    expect(rotuloDaSeta('Refazer', { tipo: 'cortar', clipeId: 'c', duracaoAntes: 4, duracaoDepois: 1, novoClipeId: 'd' }))
      .toBe('Refazer: dividir o clipe');
    expect(rotuloDaSeta('Desfazer', { tipo: 'acrescentarPistas', pistaIds: ['a', 'b'] }))
      .toBe('Desfazer: acrescentar 2 pistas');
    expect(rotuloDaSeta('Desfazer', { tipo: 'acrescentarPistas', pistaIds: ['a'] }))
      .toBe('Desfazer: acrescentar a pista');
  });

  it('sem passo, diz que não há nada', () => {
    expect(rotuloDaSeta('Desfazer', null)).toBe('Desfazer (nada por agora)');
    expect(rotuloDaSeta('Refazer', undefined)).toBe('Refazer (nada por agora)');
  });
});
