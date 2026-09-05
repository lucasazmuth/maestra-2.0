// As variáveis de ambiente, lidas de um jeito que funciona nas DUAS superfícies.
//
// Cada empacotador substitui `process.env.X` por um literal em tempo de build, e cada um só
// reconhece o próprio prefixo: o CRA troca `REACT_APP_*`, e o `babel-preset-expo` troca
// `EXPO_PUBLIC_*`. O núcleo lia só `REACT_APP_*`, então TODA chave dele era inerte no app
// nativo — `PAYWALL_DISABLED` nunca ligava, e a URL do Supabase caía sempre no valor embutido,
// sem meio de apontar o app para outro projeto.
//
// Não dá para resolver com uma função que receba o nome da chave: a substituição é TEXTUAL, e
// `process.env[nome]` não é substituído por ninguém. Por isso cada leitura aqui está escrita à
// mão, com os dois nomes literais. É repetitivo de propósito.
//
// A leitura do outro prefixo devolve `undefined` em vez de estourar: cada empacotador define um
// objeto `process.env` com as chaves que conhece, e uma chave ausente é só `undefined`.

/** `true` apenas para a string "true" — qualquer outra coisa deixa a chave desligada. */
const ligada = (valor?: string) => valor === 'true';

export const ENV = {
  supabaseUrl: process.env.REACT_APP_SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.REACT_APP_SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
  paywallDesligado: ligada(
    process.env.REACT_APP_DISABLE_PAYWALL ?? process.env.EXPO_PUBLIC_DISABLE_PAYWALL,
  ),
  nytaModal: ligada(
    process.env.REACT_APP_FEATURE_NYTA_MODAL ?? process.env.EXPO_PUBLIC_FEATURE_NYTA_MODAL,
  ),
  tcle: ligada(process.env.REACT_APP_TCLE_ENABLED ?? process.env.EXPO_PUBLIC_TCLE_ENABLED),
} as const;
