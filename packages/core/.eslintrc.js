// O nucleo nao pode falar com o navegador.
//
// A checagem era feita pelo tipo — `lib: ["esnext"]`, sem `dom` — e funcionava, mas o preco era
// declarar a mao `fetch`, `Response`, `AbortController` e companhia, com tipos piores do que os
// oficiais. Tipo e tipo; politica e lint. O `dom` volta a tipar, e a proibicao vive aqui.
//
// A lista e do que NAO existe no React Native. `fetch`, `URL` e `setTimeout` existem e ficam
// livres; `TextDecoder` e `crypto.randomUUID` precisam de polyfill no app, e estao anotados no
// README do pacote.
module.exports = {
  root: true,
  extends: ['react-app'],
  rules: {
    'no-restricted-globals': [
      'error',
      { name: 'window', message: 'Nao existe util no app nativo. Use uma porta em nucleo/.' },
      { name: 'document', message: 'Nao existe no app nativo. Isto e codigo de interface: o lugar dele e na web.' },
      { name: 'localStorage', message: 'Use ambiente().armazenamento.' },
      { name: 'sessionStorage', message: 'Use ambiente().sessao.' },
      { name: 'navigator', message: 'Nao existe no app nativo.' },
      { name: 'Notification', message: 'Push do app e APNs/FCM, nao Notification do navegador.' },
      { name: 'alert', message: 'Nao existe no app nativo.' },
      { name: 'confirm', message: 'Nao existe no app nativo.' },
    ],
  },
};
