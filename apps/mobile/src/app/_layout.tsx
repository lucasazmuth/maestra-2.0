import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import { persistor, store } from '@maestra/core/store/store';
import { ligarAmbienteDoApp } from '@/nucleo/ambienteApp';

// No escopo do modulo, de proposito: o nucleo precisa saber onde guardar as coisas ANTES de
// qualquer tela montar. Dentro de um efeito seria tarde — a primeira leitura de sessao ja teria
// acontecido contra o deposito errado.
ligarAmbienteDoApp();

export default function LayoutRaiz() {
  return (
    // O MESMO store da web, com os mesmos slices e thunks. E o que faz "carregar os perfis do
    // usuario" ser uma linha aqui em vez de uma reimplementacao.
    <Provider store={store}>
      <PersistGate persistor={persistor} loading={null}>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </PersistGate>
    </Provider>
  );
}
