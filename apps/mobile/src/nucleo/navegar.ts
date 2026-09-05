import { useRouter, type Href } from 'expo-router';

/**
 * O "voltar" das telas, que funciona também quando não há de onde voltar.
 *
 * `router.back()` sozinho falha com "The action 'GO_BACK' was not handled" sempre que a tela é a
 * PRIMEIRA da pilha — e isso não é caso raro: acontece em todo deep link, e vai acontecer em
 * toda notificação push tocada, que abre a tela diretamente.
 *
 * Por isso cada tela declara para ONDE ela volta quando a pilha está vazia. É a informação que
 * só ela tem, e é o que transforma um beco sem saída numa navegação normal.
 */
export const useVoltar = (destino: Href) => {
  const router = useRouter();
  return () => {
    if (router.canGoBack()) router.back();
    else router.replace(destino);
  };
};
