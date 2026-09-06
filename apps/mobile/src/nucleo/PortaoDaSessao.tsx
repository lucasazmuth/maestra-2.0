import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useSessao } from '@/nucleo/sessao';

/** As rotas que existem SEM sessão. Expulsar alguém delas seria um laço. */
const PUBLICAS = ['entrar', 'intro'];

// O PORTÃO DA SESSÃO — quem sai da conta sai da tela também.
//
// "Sair da conta" chamava o `signOut` e mais nada acontecia: a sessão sumia, mas a tela
// continuava ali, com os dados que já estavam na memória. Quem tocou o botão via o menu fechar
// e nada mudar — parecia que o botão não funcionava, e a conta ficava aberta na cara de quem
// achava que tinha saído.
//
// A causa era o guardião viver em cada tela: `/perfis`, `/conta`, `/notificacoes` e mais três
// tinham o seu `Redirect`; as telas de dentro do artista, não. Sair de lá não levava a lugar
// nenhum.
//
// Agora é UM só, na raiz, e vale para tudo o que existe e para tudo o que for criado. Ele mora
// dentro do roteador de propósito: `useSegments` precisa do contexto da rota.

export const PortaoDaSessao = () => {
  const { sessao, carregando } = useSessao();
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    // `carregando` é o que evita o piscar clássico: sem ele, o app mandaria todo mundo para o
    // login por meio segundo até a sessão do disco chegar.
    if (carregando || sessao) return;
    if (PUBLICAS.includes(segmentos[0] as string)) return;
    router.replace('/entrar');
  }, [carregando, sessao, segmentos, router]);

  return null;
};
