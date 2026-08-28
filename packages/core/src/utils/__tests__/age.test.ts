import { idadeEmAnos, ehMaiorDeIdade } from '../age';

// Data fixa: sem isto os casos de "faz aniversário hoje" quebrariam sozinhos com o passar do tempo.
const HOJE = new Date(Date.UTC(2026, 7, 15)); // 15/08/2026

describe('idadeEmAnos', () => {
  it('conta anos completos', () => {
    expect(idadeEmAnos('2000-01-01', HOJE)).toBe(26);
    expect(idadeEmAnos('1990-12-31', HOJE)).toBe(35);
  });

  it('não conta o ano quando o aniversário ainda não chegou', () => {
    expect(idadeEmAnos('2008-08-16', HOJE)).toBe(17);
    expect(idadeEmAnos('2008-12-01', HOJE)).toBe(17);
  });

  it('conta o ano no próprio dia do aniversário', () => {
    // O caso que o fuso quebraria: lido como horário local, 2008-08-15 vira 14/08 e a pessoa
    // seria barrada no dia em que completa 18 anos.
    expect(idadeEmAnos('2008-08-15', HOJE)).toBe(18);
    expect(ehMaiorDeIdade('2008-08-15', HOJE)).toBe(true);
  });

  it('rejeita datas malformadas', () => {
    expect(idadeEmAnos('', HOJE)).toBeNull();
    expect(idadeEmAnos('15/08/2008', HOJE)).toBeNull();
    expect(idadeEmAnos('2008-8-15', HOJE)).toBeNull();
    expect(idadeEmAnos('abc', HOJE)).toBeNull();
  });

  it('rejeita datas que não existem no calendário', () => {
    expect(idadeEmAnos('2021-02-31', HOJE)).toBeNull();
    expect(idadeEmAnos('2021-13-01', HOJE)).toBeNull();
    expect(idadeEmAnos('2021-00-10', HOJE)).toBeNull();
  });

  it('aceita 29 de fevereiro em ano bissexto', () => {
    expect(idadeEmAnos('2004-02-29', HOJE)).toBe(22);
    expect(idadeEmAnos('2005-02-29', HOJE)).toBeNull();
  });

  it('devolve idade negativa para data no futuro', () => {
    expect(idadeEmAnos('2030-01-01', HOJE)).toBeLessThan(0);
    expect(ehMaiorDeIdade('2030-01-01', HOJE)).toBe(false);
  });

  it('separa maior de menor exatamente no corte de 18', () => {
    expect(ehMaiorDeIdade('2008-08-16', HOJE)).toBe(false); // 17
    expect(ehMaiorDeIdade('2008-08-15', HOJE)).toBe(true); // 18 hoje
  });
});
