'use strict';

const path = require('path');
const camelcase = require('camelcase');

// Substitui o transform de assets do react-scripts 5.0.1 (config/jest/fileTransform.js).
//
// O original monta o elemento do SVG na mão:
//
//   { $$typeof: Symbol.for('react.element'), type: 'svg', ... }
//
// O React 19 trocou essa marca para `Symbol.for('react.transitional.element')`, então ele
// recusa o objeto com "A React Element from an older version of React was rendered" e derruba
// a árvore inteira. Na prática, qualquer teste que renderizasse um componente com `import` de
// `.svg` falhava — não pelo que estava sendo testado, mas pelo ícone no meio do caminho.
//
// A correção é só deixar o próprio React criar o elemento: `React.createElement` produz a
// marca certa para a versão instalada, seja ela qual for.
//
// Ligado pelo `jest.transform` no package.json, sobrescrevendo a MESMA chave catch-all do CRA
// — o Jest usa a primeira chave que casa, então uma chave nova só para `.svg` seria ignorada.
module.exports = {
  process(src, filename) {
    const assetFilename = JSON.stringify(path.basename(filename));

    if (filename.match(/\.svg$/)) {
      const pascalCaseFilename = camelcase(path.parse(filename).name, {
        pascalCase: true,
      });
      const componentName = `Svg${pascalCaseFilename}`;
      return {
        code: `const React = require('react');
        module.exports = {
          __esModule: true,
          default: ${assetFilename},
          ReactComponent: React.forwardRef(function ${componentName}(props, ref) {
            return React.createElement(
              'svg',
              Object.assign({}, props, { ref: ref }),
              ${assetFilename}
            );
          }),
        };`,
      };
    }

    return { code: `module.exports = ${assetFilename};` };
  },
};
