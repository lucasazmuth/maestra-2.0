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
 * Liga o nucleo ao aparelho. Precisa rodar antes de qualquer tela.
 *
 * O `ambiente()` guarda o que resolveu na primeira chamada: se alguem o consultar antes daqui,
 * fica com o padrao em memoria e a sessao nao sobrevive ao fechamento do app. Por isso a
 * chamada mora no escopo de modulo do layout raiz, e nao dentro de um efeito.
 */
export const ligarAmbienteDoApp = (): void => {
  configurarAmbiente({
    armazenamento: doMMKV(persistente),
    sessao: emMemoria,
    // O retorno do OAuth e do link de convite: no app e o deep link, nao uma URL http.
    // `createURL` da o esquema certo em desenvolvimento (exp://) e em producao (maestra://).
    origemDoApp: Linking.createURL('/').replace(/\/$/, ''),
  });
};
