import { zoomQueEncaixa } from '../pages/Catalog/daw/EditorDaGravacao';
import { PIXELS_POR_SEGUNDO, ZOOM_MINIMO_ABSOLUTO } from '../pages/Catalog/daw/tokens';

// A LINHA DO TEMPO ABRE ENCAIXADA NO ECRÃ, no telemóvel.
//
// A 100 % são 60 px por segundo. Uma música de dois minutos mede 8 700 px, e num ecrã de 390
// isso são vinte e dois ecrãs em fila: a pessoa abria a montagem, via seis segundos de onda, e
// para chegar ao resto tinha um polegar de barra de rolagem com 17 px — que ao toque nem chega
// a ser desenhado. O "não consigo rolar pro lado" era isso: o lado existia e não havia como o
// alcançar.

/** Quantos pixels a montagem inteira ocupa com um dado zoom. */
const largura = (duracao: number, zoom: number) => duracao * PIXELS_POR_SEGUNDO * zoom;

describe('zoomQueEncaixa', () => {
  it('a montagem inteira cabe na largura visível', () => {
    expect(largura(144, zoomQueEncaixa(144, 250))).toBeCloseTo(250, 6);
    expect(largura(30, zoomQueEncaixa(30, 900))).toBeCloseTo(900, 6);
  });

  // ⚠️ NUNCA ACIMA DE 100 %. Uma música de dez segundos cabia num ecrã inteiro a 400 %, e abrir
  // assim é abrir errado: a régua marca meio segundo por número e a onda vira um borrão largo.
  // Encaixar é garantir que CABE, não esticar até encostar nas bordas.
  it('não estica uma música curta para além dos 100 %', () => {
    expect(zoomQueEncaixa(10, 1200)).toBe(1);
    expect(zoomQueEncaixa(30, 1800)).toBe(1);
  });

  // ⚠️ E NUNCA ABAIXO DO CHÃO. Um ensaio de uma hora encaixado em 250 px daria 0,001: cada
  // pixel seria quatro segundos de música e a onda deixaria de ter forma. Daí para baixo é
  // melhor sobrar linha do tempo para rolar do que uma mancha que não diz nada.
  it('para no chão em vez de esmagar a onda', () => {
    expect(zoomQueEncaixa(3600, 250)).toBe(ZOOM_MINIMO_ABSOLUTO);
    // E o chão é mesmo um chão: aqui a montagem já NÃO cabe, e é isso que se quer.
    expect(largura(3600, zoomQueEncaixa(3600, 250))).toBeGreaterThan(250);
  });

  // Quanto mais estreito o ecrã, mais afastado tem de abrir — e é a mesma proporção nos dois.
  it('metade da largura pede metade do zoom', () => {
    expect(zoomQueEncaixa(144, 250)).toBeCloseTo(zoomQueEncaixa(144, 500) / 2, 9);
    expect(zoomQueEncaixa(144, 500)).toBeCloseTo(zoomQueEncaixa(288, 500) * 2, 9);
  });

  // Ao abrir, a duração ainda é zero (o áudio nem começou a carregar) e a coluna pode ainda não
  // ter sido medida. Sem esta guarda saía `Infinity` ou `NaN` no zoom, e a régua desaparecia.
  it('sem duração ou sem largura, fica nos 100 %', () => {
    expect(zoomQueEncaixa(0, 390)).toBe(1);
    expect(zoomQueEncaixa(144, 0)).toBe(1);
    expect(zoomQueEncaixa(-5, 390)).toBe(1);
    expect(zoomQueEncaixa(144, -80)).toBe(1);
  });
});
