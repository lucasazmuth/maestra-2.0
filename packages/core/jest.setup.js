require('@testing-library/jest-dom');

// Mesmo polyfill do `setupTests.ts` da web: o jsdom nao traz TextEncoder, e bibliotecas que o
// nucleo carrega esperam encontra-lo.
const { TextEncoder, TextDecoder } = require('util');
Object.assign(global, { TextEncoder, TextDecoder });
