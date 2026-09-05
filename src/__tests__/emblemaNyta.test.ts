import fs from 'fs';
import path from 'path';

// O emblema da Nyta é a marca da inteligência da Maestra: ele aparece no cabeçalho das duas
// superfícies, e um `d` levemente diferente daria duas estrelas diferentes lado a lado.
//
// A web desenha em SVG dentro do JSX; o app, com `react-native-svg`. O que os dois PRECISAM ter
// igual é a geometria e o degradê — o resto é a diferença de plataforma.

const ler = (...p: string[]) => fs.readFileSync(path.join(__dirname, '..', '..', ...p), 'utf8');

const daWeb = ler('src', 'components', 'nyta', 'NytaEmblem.tsx');
const doApp = ler('apps', 'mobile', 'src', 'casca', 'EmblemaNyta.tsx');

/** O valor de uma constante de path (`const NOME = '...'`). */
const path_de = (fonte: string, nome: string): string => {
  const achado = new RegExp(`const ${nome} = '([^']+)'`).exec(fonte);
  expect(achado).not.toBeNull();
  return achado![1];
};

describe('emblema da Nyta', () => {
  it.each([
    ['a estrela em repouso', 'ESTRELA', 'SPARK'],
    // As outras duas formas do set entraram com o wizard: pensando, o emblema gira e as três se
    // revezam. Um `d` diferente aqui daria uma metamorfose diferente de cada lado.
    ['o rastro de giro', 'RASTRO', 'SWOOSH'],
    ['o flare', 'FLARE', 'FLARE'],
  ])('%s tem a mesma geometria nas duas superfícies', (_nome, noApp, naWeb) => {
    expect(path_de(doApp, noApp)).toBe(path_de(daWeb, naWeb));
  });

  // O revezamento é uma sequência de janelas; se elas divergirem, uma superfície mostra o rastro
  // enquanto a outra ainda mostra a estrela.
  it('a volta do "pensando" dura o mesmo nos dois', () => {
    const folha = ler('src', 'components', 'nyta', 'NytaEmblem.module.scss');
    expect(folha).toContain('nytaEmblemSpin 2.4s');
    expect(doApp).toContain('VOLTA = 2400');
  });

  it.each(['#a143ff', '#7420f1'])('o degradê usa %s nas duas', (cor) => {
    expect(daWeb).toContain(cor);
    expect(doApp).toContain(cor);
  });

  it('o eixo do degradê é o mesmo', () => {
    for (const eixo of ["x1='3'", "y1='3'", "x2='21'", "y2='21'"]) {
      expect(daWeb).toContain(eixo);
      expect(doApp).toContain(eixo.replace(/'/g, '"'));
    }
  });
});
