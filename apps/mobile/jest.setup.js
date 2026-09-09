/* eslint-env jest */

// O MMKV e um modulo nativo: no jest ele nao existe. O `ambienteApp` so e exercitado no
// aparelho, e o que os testes de tela precisam e que importar a arvore nao exploda.
jest.mock('react-native-mmkv', () => ({
  createMMKV: () => {
    const mapa = new Map();
    return {
      getString: (c) => mapa.get(c),
      set: (c, v) => mapa.set(c, v),
      remove: (c) => mapa.delete(c),
      contains: (c) => mapa.has(c),
      getAllKeys: () => [...mapa.keys()],
      clearAll: () => mapa.clear(),
    };
  },
}));

// `expo-apple-authentication` consulta o sistema no import; sem aparelho, devolve indisponivel.
jest.mock('expo-apple-authentication', () => ({
  isAvailableAsync: () => Promise.resolve(false),
  signInAsync: jest.fn(),
  AppleAuthenticationScope: { FULL_NAME: 0, EMAIL: 1 },
  AppleAuthenticationButtonType: { SIGN_IN: 0 },
  AppleAuthenticationButtonStyle: { BLACK: 0 },
  AppleAuthenticationButton: () => null,
}));

// ─── O áudio e os gestos do editor de stems ─────────────────────────────────
//
// Três bibliotecas nativas que não existem no jest. As duas primeiras trazem o próprio duplo,
// escrito por quem as escreveu — usar o de casa é sempre melhor do que inventar um nosso, que
// divergiria da biblioteca no primeiro update.
//
// A `react-native-audio-api` é o motor da mesa (o `AudioContext` do navegador, no telemóvel).
// O duplo dela não toca nada: os testes de tela verificam que o editor DESENHA — pistas, botões,
// transporte. Quem prova que a mesa mistura e sincroniza é a suíte do núcleo, com um contexto
// falso de relógio manual, sem tocar num som.
//
// O duplo dela publica as classes só na exportação `default`; o nosso código importa `AudioContext`
// e `AudioManager` pelo nome, como a biblioteca de verdade permite. Espalhar as duas resolve.
jest.mock('react-native-audio-api', () => {
  const duplo = require('react-native-audio-api/mock');
  const api = { ...duplo, ...duplo.default };
  // O `AudioManager` do duplo não conhece a sessão de áudio do iOS — o duplo ficou atrás da
  // biblioteca, que já expõe as duas. Sem elas, montar a tela do editor estoura no primeiro
  // render. Ficam aqui como nada, que é o que uma sessão de áudio faz num processo sem áudio.
  api.AudioManager.setAudioSessionOptions ??= () => {};
  api.AudioManager.setAudioSessionActivity ??= () => Promise.resolve(true);
  return api;
});
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
require('react-native-gesture-handler/jestSetup');

const { configurarAmbiente } = require('@maestra/core/nucleo/ambiente');

// O nucleo avisa (com razao) quando ninguem registra um deposito: sem isso ele cai em memoria e
// nada sobrevive ao fechamento. No teste, memoria e exatamente o que se quer — mas registrada,
// e nao por omissao, senao o aviso polui toda rodada e a gente aprende a ignorar aviso.
const memoria = () => {
  const mapa = new Map();
  return {
    ler: (c) => mapa.get(c) ?? null,
    gravar: (c, v) => { mapa.set(c, v); },
    apagar: (c) => { mapa.delete(c); },
  };
};
configurarAmbiente({ armazenamento: memoria(), sessao: memoria(), origemDoApp: 'maestra://' });

// Dois timers ficam de pe depois da ultima assercao e seguram o jest aberto: a renovacao de
// token que o cliente do Supabase agenda no import, e a gravacao adiada do redux-persist. Nenhum
// dos dois e vazamento de verdade — sao servicos que no app rodam a vida toda —, mas num processo
// de teste eles precisam ser desligados na saida.
// Encadeado com `?.` de proposito: uma suite que MOCKA `lib/supabase` ou `store/store` nao tem
// esses objetos, e derrubar a suite inteira num passo de limpeza seria trocar o essencial pelo
// acessorio — o teste ja passou quando isto roda.
afterAll(() => {
  try {
    require('@maestra/core/lib/supabase').supabase?.auth?.stopAutoRefresh?.();
    require('@maestra/core/store/store').persistor?.pause?.();
  } catch {
    /* modulo mockado ou nao carregado nesta suite: nada a desligar */
  }
});
