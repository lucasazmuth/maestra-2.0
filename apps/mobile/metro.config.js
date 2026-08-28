// Metro no monorepo.
//
// O app NAO participa do workspace da raiz de proposito: la vive a arvore do app web (CRA,
// React 19 para DOM, antd), e hoistar as duas juntas e a receita conhecida para duas copias do
// React no mesmo bundle — hooks quebram e o erro nao diz por que. Aqui o app tem node_modules
// proprio, e o unico ponto de contato com o resto do repositorio e o pacote do nucleo.
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projeto = __dirname;
const raiz = path.resolve(projeto, '../..');
const nucleo = path.resolve(raiz, 'packages/core');

const config = getDefaultConfig(projeto);

// Sem isto o Metro nao repara que um arquivo do nucleo mudou: ele so observa a pasta do app.
config.watchFolders = [nucleo];

// `@maestra/core/x` resolve para a FONTE, e nao para o `dist`. O Metro transpila TypeScript
// sozinho, entao nao ha passo de build no meio e editar o nucleo recarrega a tela na hora —
// o mesmo caminho que o jest e o tsc ja usam.
config.resolver.extraNodeModules = {
  '@maestra/core': path.resolve(nucleo, 'src'),
};

// A busca fica restrita ao node_modules do app. E isto que garante instancia UNICA de `react`,
// `react-redux` e companhia: um arquivo do nucleo, ao pedir `react`, encontra a copia do app —
// nao a da web, que esta na raiz.
config.resolver.nodeModulesPaths = [path.resolve(projeto, 'node_modules')];
config.resolver.disableHierarchicalLookup = true;

module.exports = config;
