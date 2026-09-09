import { CONVITE_DA_FICHA, fichaVazia, partesDaFicha, resumoDaFicha } from '../resumoDaFicha';

// A ficha técnica numa linha só — o que substituiu a grelha 2×2 de 153 pt no celular.
//
// O que se protege aqui: a ORDEM fixa (o olho encontra as coisas no mesmo lugar), o que entra
// e o que fica de fora (nada de traços), e o convite quando não há nada.

describe('as partes, na ordem fixa', () => {
  it('BPM, tom, gênero e data, nesta ordem, com o BPM rotulado', () => {
    expect(partesDaFicha({ bpm: '128', tom: 'Am', genero: 'Pop', lancamento: '2026-09-12' }))
      .toEqual(['128 BPM', 'Am', 'Pop', '12/09/2026']);
  });

  it('só entra o que tem valor, sem deixar buraco', () => {
    // Era isto que a grelha fazia mal: quatro traços a ocupar o lugar de quatro valores.
    expect(partesDaFicha({ bpm: '', tom: 'Am', genero: null, lancamento: undefined }))
      .toEqual(['Am']);
    expect(partesDaFicha({ bpm: 120 })).toEqual(['120 BPM']);
  });

  it('não muda a ordem conforme o que está preenchido', () => {
    // Só gênero e data: a data continua depois do gênero, e não "sobe" para o início.
    expect(partesDaFicha({ genero: 'Trap', lancamento: '2026-01-05' }))
      .toEqual(['Trap', '05/01/2026']);
  });

  it('espaço em branco é vazio', () => {
    expect(partesDaFicha({ bpm: '  ', tom: ' ' })).toEqual([]);
  });

  it('uma data que não é data fica de fora, em vez de virar "Invalid Date"', () => {
    expect(partesDaFicha({ lancamento: 'quando der' })).toEqual([]);
  });
});

describe('a linha pronta', () => {
  it('junta com o ponto do meio', () => {
    expect(resumoDaFicha({ bpm: '128', tom: 'Am', genero: 'Pop' })).toBe('128 BPM · Am · Pop');
  });

  it('convida quando não há nada', () => {
    expect(resumoDaFicha({})).toBe(CONVITE_DA_FICHA);
    expect(fichaVazia({})).toBe(true);
    expect(fichaVazia({ tom: 'C' })).toBe(false);
  });
});
