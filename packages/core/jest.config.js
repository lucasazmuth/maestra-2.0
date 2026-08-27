// Suite do nucleo.
//
// Ela e separada da suite da web porque o CRA nao aceita override de `roots` — o jest dele so
// enxerga `src/`. Separar acabou sendo o certo de qualquer forma: os testes da logica do produto
// nao ficam presos dentro de um app React, e o app nativo vai poder roda-los sem CRA nenhum.
//
// O transform e o MESMO do react-scripts, de proposito: dois transpiladores diferentes para o
// mesmo codigo seria uma fonte de divergencia entre o que o teste ve e o que o app ve.
const path = require('path');

module.exports = {
  rootDir: __dirname,
  roots: ['<rootDir>/src'],
  testEnvironment: 'jsdom',
  // Os dois ajustes abaixo copiam o que o react-scripts faz, e nao sao cosmeticos: sem o
  // polyfill de `fetch` no jsdom, os testes de propriedade da Chartmetric passavam na web e
  // falhavam aqui — o mesmo codigo, dois ambientes diferentes. E `resetMocks` e o padrao do CRA;
  // teste escrito sob ele quebra sem ele.
  setupFiles: [require.resolve('react-app-polyfill/jsdom')],
  resetMocks: true,
  transform: {
    '^.+\\.(js|jsx|mjs|cjs|ts|tsx)$': path.resolve(
      __dirname,
      '../../node_modules/react-scripts/config/jest/babelTransform.js'
    ),
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  testMatch: ['<rootDir>/src/**/__tests__/**/*.{ts,tsx}', '<rootDir>/src/**/*.{test,property.test}.{ts,tsx}'],
};
