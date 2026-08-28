// jest-dom adds custom jest matchers for asserting on DOM nodes.
// allows you to do things like:
// expect(element).toHaveTextContent(/react/i)
// learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom';

// Polyfill TextEncoder/TextDecoder for jsdom (react-router v7 needs it)
import { TextEncoder, TextDecoder } from 'util';

Object.assign(global, { TextEncoder, TextDecoder });

// Registra a rota da web no núcleo, a mesma ligação que o boot faz em `index.tsx`. Sem ela os
// hooks do núcleo não saberiam em que tela estão, e os testes que montam tela passariam a
// exercitar um caminho que produção nunca vê.
//
// Tem que ser `require`, e depois do polyfill: `import` é içado para o topo do módulo, o
// react-router v7 lê `TextEncoder` ao carregar, e as 46 suítes quebravam antes da primeira
// linha rodar.
// eslint-disable-next-line @typescript-eslint/no-var-requires, global-require
require('./nucleo/rotaWeb');
