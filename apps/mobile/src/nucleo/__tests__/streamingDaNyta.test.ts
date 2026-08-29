import fs from 'fs';
import path from 'path';

import { ambiente, reiniciarAmbiente } from '@maestra/core/nucleo/ambiente';

import { ligarAmbienteDoApp } from '@/nucleo/ambienteApp';

// A Nyta responde EM PEDAÇOS, e esse é o detalhe que mais engana quando quebra.
//
// No aparelho, o `fetch` global é o polyfill `whatwg-fetch`: ele junta a resposta inteira antes
// de devolver, e `response.body` não tem `getReader`. O `useNytaChat` faz
// `response.body?.getReader()` e, sem leitor, sai da função EM SILÊNCIO: a tela abre, a
// mensagem fica vazia e nenhum erro aparece. Parece a Nyta pensando devagar.
//
// Por isso o app registra o `expo/fetch` na porta de ambiente.
//
// ⚠️ O jest NÃO reproduz esse runtime: aqui o `global.fetch` e o `Response` já são os do Node,
// que fazem streaming. Um teste do tipo "o global não serve" passa a verde neste ambiente e não
// prova nada sobre o aparelho — cheguei a escrever dois assim. O que dá pra guardar de verdade
// é o que está abaixo: que o registro existe, e que o núcleo pede pela porta.

jest.mock('react-native-mmkv', () => ({
  createMMKV: () => ({ getString: () => null, set: () => {}, remove: () => {} }),
}));

jest.mock('expo-linking', () => ({ createURL: () => 'maestra:///' }));

describe('a porta de busca do app', () => {
  afterEach(() => reiniciarAmbiente());

  it('o app registra o fetch do Expo, que sabe entregar a resposta em pedaços', () => {
    const { fetch: doExpo } = jest.requireActual('expo/fetch');
    ligarAmbienteDoApp();
    expect(ambiente().buscar).toBe(doExpo);
  });

  // A outra ponta: de nada adianta registrar se o núcleo continuar chamando o `fetch` global.
  // É a regressão fácil de cometer — o global funciona no navegador e nos testes, então nada
  // acusa até alguém abrir a Nyta no aparelho.
  it('o núcleo pede pela porta, e não pelo fetch global', () => {
    const fonte = fs.readFileSync(
      path.join(__dirname, '..', '..', '..', '..', '..', 'packages', 'core', 'src', 'hooks', 'useNytaChat.ts'),
      'utf8',
    );
    const semComentarios = fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');

    expect(semComentarios).toContain('ambiente().buscar(');
    expect(semComentarios).not.toMatch(/(?<![.\w])fetch\(/);
  });
});
