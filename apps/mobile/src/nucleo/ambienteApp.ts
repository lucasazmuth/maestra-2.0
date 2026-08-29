import { fetch as buscarComStream } from 'expo/fetch';
import * as Linking from 'expo-linking';
import { createMMKV, type MMKV } from 'react-native-mmkv';

import { configurarAmbiente, type Armazenamento } from '@maestra/core/nucleo/ambiente';

// A implementacao nativa da porta de ambiente.
//
// MMKV, e nao AsyncStorage, por um motivo de forma: a porta do nucleo e SINCRONA, porque na web
// ela nasceu sobre `localStorage` e torna-la assincrona obrigaria a mudar todos os chamadores.
// O MMKV le e escreve de forma sincrona, entao o nucleo nao percebe diferenca entre as duas
// superficies. O AsyncStorage forcaria a inversao.

const persistente = createMMKV({ id: 'maestra' });
// Some quando o app e encerrado — o analogo, aqui, da aba fechada no navegador.
const daSessao = new Map<string, string>();

const doMMKV = (deposito: MMKV): Armazenamento => ({
  ler: (chave) => deposito.getString(chave) ?? null,
  gravar: (chave, valor) => deposito.set(chave, valor),
  apagar: (chave) => {
    deposito.remove(chave);
  },
});

const emMemoria: Armazenamento = {
  ler: (chave) => daSessao.get(chave) ?? null,
  gravar: (chave, valor) => { daSessao.set(chave, valor); },
  apagar: (chave) => { daSessao.delete(chave); },
};

/**
 * Liga o nucleo ao aparelho.
 *
 * O `ambiente()` guarda o que resolveu na PRIMEIRA chamada. Quem chega primeiro nao e uma tela:
 * e o proprio `supabase-js`, que ao ser criado ja dispara a recuperacao da sessao
 * (`_recoverAndRefresh` -> `getItem`) — e `lib/supabase.ts` cria o cliente no import. Ou seja,
 * a primeira leitura da sessao acontece durante a AVALIACAO DOS IMPORTS.
 *
 * Por isso o registro roda como efeito colateral deste modulo, e o entry do app o importa ANTES
 * do `expo-router/entry` (ver `index.js`). Chamar do layout raiz nao bastava: em ES modules os
 * imports sao avaliados antes do corpo do modulo, entao o `store`/`supabase` ja tinham lido.
 *
 * Continua exportada para os testes, que precisam registrar de novo depois de `reiniciarAmbiente`.
 */
export const ligarAmbienteDoApp = (): void => {
  configurarAmbiente({
    armazenamento: doMMKV(persistente),
    sessao: emMemoria,
    // O retorno do OAuth e do link de convite: no app e o deep link, nao uma URL http.
    // `createURL` da o esquema certo em desenvolvimento (exp://) e em producao (maestra://).
    origemDoApp: Linking.createURL('/').replace(/\/$/, ''),
    // O `fetch` do React Native devolve `Response` SEM `body`: quem le a resposta em pedacos —
    // a Nyta — receberia o texto inteiro so no fim, sem erro nenhum, parecendo lentidao. O
    // `expo/fetch` tem `body` como `ReadableStream`, e o Expo ja traz o `TextDecoder` que o
    // leitor usa.
    buscar: buscarComStream as unknown as typeof fetch,
  });
};

// Efeito colateral no import: e o unico jeito de chegar antes do `supabase-js`, que le a sessao
// durante a avaliacao dos imports. Ver o comentario acima.
ligarAmbienteDoApp();
