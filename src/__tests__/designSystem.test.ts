import fs from 'fs';
import path from 'path';

import { COR, FONTE, RAIO } from '@maestra/core/constants/design';

// O app nativo não tem CSS: ele lê o sistema visual de `constants/design.ts`, no núcleo. Este
// teste é o que impede os dois de divergirem — se alguém trocar a cor primária no
// `ConfigProvider` e esquecer do núcleo, o app continuaria azul-antigo sem ninguém notar até
// abrir os dois lado a lado.
//
// A comparação é contra o App.tsx de propósito: é lá que a web DECLARA o sistema. Comparar
// contra o próprio arquivo de tokens seria um teste que só concorda consigo mesmo.

const appTsx = fs.readFileSync(path.join(__dirname, '..', 'App.tsx'), 'utf8');

/** Lê um valor do bloco `token: { ... }` do ConfigProvider. */
const daWeb = (chave: string): string => {
  const achado = new RegExp(`${chave}:\\s*(?:'([^']*)'|"([^"]*)"|([0-9]+))`).exec(appTsx);
  expect(achado).not.toBeNull();
  return (achado![1] ?? achado![2] ?? achado![3]).trim();
};

describe('o núcleo e a web declaram o mesmo sistema visual', () => {
  it.each([
    ['colorPrimary', COR.primaria],
    ['colorTextLightSolid', COR.sobrePrimaria],
    ['colorText', COR.texto],
    ['colorTextHeading', COR.titulo],
    ['colorTextPlaceholder', COR.espaçoReservado],
    ['colorBorder', COR.contorno],
    ['colorSplit', COR.divisoria],
    ['colorBgLayout', COR.fundo],
    ['colorBgContainer', COR.superficie],
  ])('%s bate com o token do núcleo', (chave, doNucleo) => {
    expect(daWeb(chave).toLowerCase()).toBe(doNucleo.toLowerCase());
  });

  it('o raio de campo é o borderRadius do ConfigProvider', () => {
    expect(RAIO.campo).toBe(Number(daWeb('borderRadius')));
  });

  it('a família tipográfica é a mesma', () => {
    expect(FONTE).toBe(daWeb('fontFamily'));
  });

  // A confusão mais fácil de cometer: o roxo é a MARCA, e o azul é a AÇÃO. Trocar os dois deixa
  // o app parecendo outro produto, e nenhum teste de cor individual pegaria isso.
  it('a cor de ação não é a cor institucional', () => {
    expect(COR.primaria).not.toBe(COR.marca);
    expect(COR.marca.toLowerCase()).toBe('#9a4fd1');
  });
});
