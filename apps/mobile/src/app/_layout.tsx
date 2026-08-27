import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { ligarAmbienteDoApp } from '@/nucleo/ambienteApp';

// No escopo do modulo, de proposito: o nucleo precisa saber onde guardar as coisas ANTES de
// qualquer tela montar. Dentro de um efeito seria tarde — a primeira leitura de sessao ja teria
// acontecido contra o deposito errado.
ligarAmbienteDoApp();

export default function LayoutRaiz() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}
