import { dataDaConversa } from '../dataDaConversa';

// A regra tem três faixas, e o valor dela está justamente em trocar de formato conforme a
// distância: uma lista onde tudo vira "29/08" não distingue a conversa de agora da de terça.

const agora = new Date('2026-08-29T15:00:00');

describe('data curta da conversa', () => {
  it('hoje vira hora', () => {
    expect(dataDaConversa('2026-08-29T09:07:00', agora)).toBe('09:07');
  });

  it('esta semana vira o dia da semana, sem o ponto da abreviação', () => {
    const terca = dataDaConversa('2026-08-25T09:00:00', agora);
    expect(terca).toBe('ter');
    expect(terca).not.toContain('.');
  });

  it('mais de uma semana vira dia/mês', () => {
    expect(dataDaConversa('2026-07-14T09:00:00', agora)).toBe('14/07');
  });

  // A fronteira dos sete dias: um dia a mais e a leitura muda de faixa. Sem isto, um off-by-one
  // aqui passaria despercebido — as duas saídas parecem plausíveis numa lista.
  it('a fronteira é sete dias', () => {
    expect(dataDaConversa('2026-08-23T09:00:00', agora)).toBe('dom');
    expect(dataDaConversa('2026-08-22T09:00:00', agora)).toBe('22/08');
  });
});
