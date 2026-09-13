import { StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '@maestra/core/store/store';
import { AssinaturaDaConta } from '@/nucleo/AssinaturaDaConta';
import { ConsentimentoDaConta } from '@/nucleo/ConsentimentoDaConta';
import { PortaoDaSessao } from '@/nucleo/PortaoDaSessao';
import { PortaoDoConsentimento } from '@/nucleo/PortaoDoConsentimento';
import { ligarRotaDoApp } from '@/nucleo/rotaApp';

// No escopo do modulo, e nao num efeito: `useRota` e consultado DURANTE a renderizacao dos
// hooks do nucleo (a Nyta le o artista da rota por ali), entao um registro tardio ja teria
// perdido a primeira volta.
//
// A porta de AMBIENTE nao esta aqui, e por um motivo: ela precisa chegar antes ainda — antes
// dos proprios imports deste arquivo, porque o `supabase-js` le a sessao ao ser criado. Ela e
// registrada no entry do app (ver `index.js`).
ligarRotaDoApp();

export default function LayoutRaiz() {
  return (
    // ⚠️ O `GestureHandlerRootView` envolve TUDO, e tem de ser a raiz mesmo.
    //
    // Todo `GestureDetector` da árvore precisa de o ter acima de si — sem ele a biblioteca
    // lança em desenvolvimento ("must be used as a descendant of GestureHandlerRootView") e, em
    // produção, os gestos simplesmente não acontecem. Ele entrou quando o editor de pistas
    // trouxe os primeiros gestos do app (o fader e a régua do transporte); as telas de antes
    // não usavam nenhum, e por isso a falta nunca se notou.
    //
    // O `flex: 1` não é decoração: sem ele a view mede zero e a aplicação inteira fica branca.
    <GestureHandlerRootView style={estilos.raiz}>
      {/* O MESMO store da web, com os mesmos slices e thunks. E o que faz "carregar os perfis
          do usuario" ser uma linha aqui em vez de uma reimplementacao. */}
      <Provider store={store}>
        <PersistGate persistor={persistor} loading={null}>
          <StatusBar style="dark" />
          {/* ⚠️ O PROVEDOR ENVOLVE O PORTÃO E AS TELAS, e é isso que faz o aceite valer.
              O portão e a tela de coleta liam cada um a sua cópia do estado, e a do portão
              mandava na rota: quem acabava de aceitar era devolvido ao consentimento. Ver
              `nucleo/ConsentimentoDaConta`. */}
          <ConsentimentoDaConta>
            {/* O portão fica DENTRO do roteador: ele lê a rota atual para não expulsar quem já
                está na tela de entrar. */}
            <PortaoDaSessao />
            {/* Depois do da sessão: sem sessão não há consentimento a cobrar. */}
            <PortaoDoConsentimento />
            {/* O estado da assinatura chega aqui, e não na pílula do cabeçalho: quem lê o
                `useEntitlements` numa tela sem pílula lia o padrão `none` como resposta. */}
            <AssinaturaDaConta />
            <Stack screenOptions={{ headerShown: false }} />
          </ConsentimentoDaConta>
        </PersistGate>
      </Provider>
    </GestureHandlerRootView>
  );
}

const estilos = StyleSheet.create({ raiz: { flex: 1 } });
