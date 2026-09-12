import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { useSessao } from '@/nucleo/sessao';

/** As rotas que existem SEM sessão. Expulsar alguém delas seria um laço. */
const PUBLICAS = ['entrar', 'intro', 'cadastro'];

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
  const router = useRouter();

  // O primeiro segmento como TEXTO, e o router numa referência: ver o comentário gêmeo no
  // `PortaoDoConsentimento`. Um array e um objeto novos a cada render punham este efeito a
  // rodar sempre, e um `replace` repetido para a mesma rota é um laço de renders.
  const primeiroSegmento = useSegments()[0];
  const rota = useRef(router);
  rota.current = router;

  useEffect(() => {
    // `carregando` é o que evita o piscar clássico: sem ele, o app mandaria todo mundo para o
    // login por meio segundo até a sessão do disco chegar.
    if (carregando || sessao) return;
    if (PUBLICAS.includes(primeiroSegmento)) return;
    rota.current.replace('/entrar');
  }, [carregando, sessao, primeiroSegmento]);

  return null;
};
