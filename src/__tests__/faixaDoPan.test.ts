import { faixaDoPan } from '../pages/Catalog/daw/EditorDaGravacao';

// O PANORAMA PINTA A PARTIR DO CENTRO.
//
// Ele não é uma quantidade — é um DESVIO com sinal: zero é o meio, e o que interessa ver é
// para que lado e quanto. Com `accent-color`, o navegador pinta sempre do mínimo até ao valor,
// e então uma pista CENTRADA aparecia meio azul (do −100 até ao 0) e uma pista toda à esquerda
// aparecia vazia. A barra crescia ao contrário do que o ouvido faz.

describe('faixaDoPan', () => {
  it('centrado não pinta nada: as duas pontas coincidem', () => {
    expect(faixaDoPan(0)).toEqual({ de: '50%', ate: '50%' });
  });

  it('à direita, a tinta sai do centro e vai para a direita', () => {
    expect(faixaDoPan(0.5)).toEqual({ de: '50%', ate: '75%' });
    expect(faixaDoPan(1)).toEqual({ de: '50%', ate: '100%' });
  });

  it('à esquerda, a tinta sai do centro e vai para a esquerda', () => {
    expect(faixaDoPan(-0.5)).toEqual({ de: '25%', ate: '50%' });
    expect(faixaDoPan(-1)).toEqual({ de: '0%', ate: '50%' });
  });

  // Os dois lados são espelho um do outro: o mesmo desvio pinta o mesmo comprimento.
  it('desvios iguais pintam faixas iguais, de cada lado', () => {
    const direita = faixaDoPan(0.4);
    const esquerda = faixaDoPan(-0.4);
    const largura = (f: { de: string; ate: string }) => parseFloat(f.ate) - parseFloat(f.de);
    expect(largura(direita)).toBeCloseTo(largura(esquerda), 6);
    expect(largura(direita)).toBeCloseTo(20, 6);
  });

  // ⚠️ Um valor fora de −1..1 (dado velho, ou um bug a montante) não pode pintar para fora do
  // trilho: a faixa sairia do controlo e escorreria pela linha ao lado.
  it('valores fora do intervalo ficam presos ao trilho', () => {
    expect(faixaDoPan(3)).toEqual({ de: '50%', ate: '100%' });
    expect(faixaDoPan(-3)).toEqual({ de: '0%', ate: '50%' });
  });
});
