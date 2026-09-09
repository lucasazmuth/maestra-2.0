import { JOELHO, curvaDoTeto } from '../teto';

// A curva do teto é a única parte da proteção contra estouro que se consegue afirmar sem um
// motor de áudio — e é onde um engano passaria despercebido para sempre, porque uma curva
// errada continua a produzir som.

const valorEm = (curva: Float32Array, x: number) => {
  // A posição de `x` na curva, com `pontos` amostras de −1 a 1.
  const i = Math.round(((x + 1) / 2) * (curva.length - 1));
  return curva[i];
};

describe('a curva do teto', () => {
  it('abaixo do joelho não toca no som', () => {
    const curva = curvaDoTeto(2001);
    // Se aqui houvesse ganho ou perda, uma mesa com duas pistas baixas soaria diferente do
    // ficheiro — e ninguém saberia dizer por quê.
    for (const x of [0, 0.1, 0.25, 0.5, JOELHO]) {
      expect(valorEm(curva, x)).toBeCloseTo(x, 3);
      expect(valorEm(curva, -x)).toBeCloseTo(-x, 3);
    }
  });

  it('acima do joelho dobra, e nunca alcança o teto', () => {
    const curva = curvaDoTeto(2001);
    expect(valorEm(curva, 0.9)).toBeLessThan(0.9);
    expect(valorEm(curva, 0.9)).toBeGreaterThan(JOELHO);
    // A ponta: é o valor que TODA amostra acima de 1 vai receber, porque o domínio do
    // modelador acaba aqui. Tem de sobrar folga até 1.0, senão não há teto nenhum.
    expect(curva[curva.length - 1]).toBeLessThan(1);
    expect(curva[curva.length - 1]).toBeGreaterThan(0.9);
  });

  it('é ímpar: o mesmo tratamento para os dois lados da onda', () => {
    const curva = curvaDoTeto(2001);
    // Tratar o pico positivo diferente do negativo desloca a onda para um lado — é o
    // "componente contínuo", que gasta headroom e não se ouve até estourar.
    for (const x of [0.2, 0.5, 0.8, 1]) {
      expect(valorEm(curva, x)).toBeCloseTo(-valorEm(curva, -x), 6);
    }
  });

  it('cresce sempre: mais entrada, mais saída', () => {
    const curva = curvaDoTeto(999);
    // Uma curva que descesse em algum trecho inverteria a onda ali dentro — distorção que
    // nenhum ouvido perdoa, e que um teste de "não passa de 1" deixaria passar.
    for (let i = 1; i < curva.length; i += 1) {
      expect(curva[i]).toBeGreaterThan(curva[i - 1]);
    }
  });

  it('passa pelo zero', () => {
    const curva = curvaDoTeto(2001);
    // Silêncio tem de continuar silêncio: uma curva deslocada acrescenta um estalo constante.
    expect(valorEm(curva, 0)).toBe(0);
  });
});
