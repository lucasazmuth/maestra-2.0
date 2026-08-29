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
