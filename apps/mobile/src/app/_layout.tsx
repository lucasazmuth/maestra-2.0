import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '@maestra/core/store/store';
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
    // O MESMO store da web, com os mesmos slices e thunks. E o que faz "carregar os perfis do
    // usuario" ser uma linha aqui em vez de uma reimplementacao.
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        <StatusBar style="dark" />
        {/* O portão fica DENTRO do roteador: ele lê a rota atual para não expulsar quem já
            está na tela de entrar. */}
        <PortaoDaSessao />
        {/* Depois do da sessão: sem sessão não há consentimento a cobrar. */}
        <PortaoDoConsentimento />
        <Stack screenOptions={{ headerShown: false }} />
      </PersistGate>
    </Provider>
  );
}
