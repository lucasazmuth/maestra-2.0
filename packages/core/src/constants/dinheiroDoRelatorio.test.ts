import { dinheiroDoRelatorio } from './realCopy';

// O DINHEIRO DO RELATÓRIO REAL (§11 da especificação v4.4).
//
// ⚠️ ABREVIAR A PARTIR DE MIL APAGAVA DINHEIRO. "R$ 1.200" virava "R$ 1 mil": o relatório comia
// R$ 200 de alguém para poupar dois caracteres, num documento cujo assunto é exatamente quanto
// entra e quanto sai. Acima de dez mil a casa decimal já basta para o número ser lido de
// relance, e o que se perde ali não muda decisão nenhuma.

describe('dinheiroDoRelatorio', () => {
  it('até dez mil escreve o número inteiro', () => {
    expect(dinheiroDoRelatorio(1_200)).toBe('R$ 1.200');
    expect(dinheiroDoRelatorio(9_999)).toBe('R$ 9.999');
    expect(dinheiroDoRelatorio(450)).toBe('R$ 450');
    expect(dinheiroDoRelatorio(0)).toBe('R$ 0');
  });

  // "Somente ACIMA de dez mil": dez mil redondo ainda é escrito por extenso.
  it('dez mil redondo é a fronteira, e fica do lado de fora', () => {
    expect(dinheiroDoRelatorio(10_000)).toBe('R$ 10.000');
    expect(dinheiroDoRelatorio(10_001)).toBe('R$ 10 mil');
  });

  it('acima disso abrevia, com uma casa quando ela diz alguma coisa', () => {
    expect(dinheiroDoRelatorio(25_200)).toBe('R$ 25,2 mil');
    expect(dinheiroDoRelatorio(260_000)).toBe('R$ 260 mil');
    expect(dinheiroDoRelatorio(2_800_000)).toBe('R$ 2,8 mi');
    expect(dinheiroDoRelatorio(3_000_000)).toBe('R$ 3 mi');
  });

  // O saldo negativo é o caso em que o sinal carrega a notícia inteira.
  it('o negativo leva o sinal junto', () => {
    expect(dinheiroDoRelatorio(-1_200)).toBe('−R$ 1.200');
    expect(dinheiroDoRelatorio(-25_200)).toBe('−R$ 25,2 mil');
  });

  it('sem número, não inventa um', () => {
    expect(dinheiroDoRelatorio(NaN)).toBe('—');
    expect(dinheiroDoRelatorio(Infinity)).toBe('—');
  });
});
