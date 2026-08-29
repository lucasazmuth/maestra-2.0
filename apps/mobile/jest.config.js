// Testes de tela do app.
//
// O preset `jest-expo` ja traz o transform, os mocks dos modulos nativos e o `testEnvironment`
// certos para React Native — montar isso a mao seria refazer trabalho que quebra a cada SDK.
//
// O `transformIgnorePatterns` precisa deixar passar o que vem em ESM dentro de node_modules
// (React Native e a maior parte dos pacotes `expo-*`), senao o jest recebe `import` cru.
const path = require('path');

module.exports = {
  preset: 'jest-expo',
  // O `persistStore` do redux-persist agenda a primeira gravacao no import do store, e esse
  // timeout ja esta pendente antes de qualquer `afterAll` rodar — `persistor.pause()` para as
  // gravacoes seguintes, mas nao cancela o que ja foi agendado. Sem isto o jest fica um segundo
  // parado no fim de cada rodada e imprime um aviso de vazamento que nao e nosso.
  //
  // Vale a pena registrar o que ISTO NAO faz: os testes rodam inteiros do mesmo jeito; so a
  // saida do processo e forcada depois que tudo terminou.
  forceExit: true,
  // O padrao do jest e 5s. Montar uma tela de React Native custa centenas de milissegundos, e
  // com nove suites em paralelo isso encosta no limite — testes passavam sozinhos e falhavam
  // juntos, que e o pior tipo de falha: parece regressao e nao e. O numero nao esconde teste
  // lento; ele reconhece que o custo aqui e de montagem, nao de logica.
  testTimeout: 20_000,
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // So arquivos .test: senao os fixtures viram 'suite sem teste' e quebram a rodada.
  testMatch: ['<rootDir>/src/**/*.test.{ts,tsx}'],
  // O equivalente, no jest, do que o `metro.config.js` faz com `nodeModulesPaths`: o
  // node_modules do APP vem primeiro. Sem isto, um arquivo do nucleo pedindo `react` ou
  // `@reduxjs/toolkit` encontra a copia da RAIZ, que e a do app web — duas instancias no mesmo
  // processo, e hooks que quebram sem dizer por que.
  moduleNameMapper: {
    // A ORDEM importa: o jest para na primeira regra que casa. O `.svg` vem antes do alias de
    // assets, senão o arquivo real seria carregado e viraria um objeto de asset (o jest não passa
    // pelo Metro, que é quem transforma SVG em componente). Ver o dublê.
    '\\.svg$': '<rootDir>/src/__mocks__/svg.tsx',
    '^@/assets/(.*)$': '<rootDir>/assets/$1',
    '^@/(.*)$': '<rootDir>/src/$1',
    // Toda dependencia que o NUCLEO importa e apontada para a copia do APP.
    //
    // E o equivalente, no jest, do que o `metro.config.js` faz com `nodeModulesPaths`: sem isto
    // um arquivo em `packages/core/src` resolve `react` subindo ate a raiz — e a raiz e a arvore
    // do app WEB. Duas copias de `react` no mesmo processo derrubam qualquer hook, e o erro nao
    // diz de onde veio. `modulePaths` nao resolve: a busca relativa ao arquivo vem antes.
    ...Object.fromEntries(
      [
        'react', 'react-redux', '@reduxjs/toolkit', 'redux-persist',
        '@supabase/supabase-js', 'zustand', 'axios', 'i18next', 'react-i18next',
      ].flatMap((pacote) => [
        [`^${pacote.replace('/', '\\/')}$`, path.resolve(__dirname, 'node_modules', pacote)],
        [`^${pacote.replace('/', '\\/')}\\/(.*)$`, path.resolve(__dirname, 'node_modules', pacote) + '/$1'],
      ]),
    ),
    // Mesma resolucao que o Metro faz: o nucleo entra pela FONTE, sem passo de build.
    '^@maestra/core$': path.resolve(__dirname, '../../packages/core/src/index.ts'),
    '^@maestra/core/(.*)$': path.resolve(__dirname, '../../packages/core/src/$1'),
  },
  // Os pacotes abaixo publicam ESM e precisam passar pelo transform.
  //
  // O padrao e DERIVADO do preset em vez de substituido: o preset traz tres regras (uma delas
  // protege o plugin do reanimated), e trocar a lista inteira por uma linha propria quebraria
  // as outras duas na primeira atualizacao de SDK. Aqui so injetamos nomes na excecao dele.
  transformIgnorePatterns: (() => {
    const doPreset = require('jest-expo/jest-preset').transformIgnorePatterns;
    const nossos = ['react-native-mmkv', 'react-native-nitro-modules', 'react-redux',
                    '@reduxjs/toolkit', 'redux-persist',
                    // transitivas do RTK que tambem publicam ESM
                    'immer', 'reselect'];
    return doPreset.map((padrao) =>
      padrao.includes('(?!(') ? padrao.replace('(?!(', `(?!(${nossos.join('|')}|`) : padrao
    );
  })(),
};
