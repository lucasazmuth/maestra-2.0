import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useSessao } from '@/nucleo/sessao';

/** As rotas que existem SEM sessão. Expulsar alguém delas seria um laço. */
const PUBLICAS = ['entrar', 'intro', 'cadastro'];

/**
 * E destas o portão tira quem ACABOU DE ENTRAR — porque elas não têm destino próprio.
 *
 * ⚠️ `cadastro` está de fora de propósito, e a falta é a regra. Quem confirma o código do
 * e-mail ganha sessão e é levado pela PRÓPRIA tela a `/bem-vindo`, que saúda e decide entre
 * criar o primeiro perfil e abrir o convite de equipe que está à espera. Se o portão também
 * agisse ali, as duas navegações corriam juntas: a que chegasse por último ganhava, e num dia
 * mau quem foi convidado caía em `/perfis` sem perfil nenhum — o convite perdido, sem erro
 * nenhum à vista.
 *
 * A tela de cadastro tem o seu próprio desvio para quem já está em sessão, e ele só vale na
 * etapa do formulário, justamente para não atropelar a do código.
 */
const SEM_DESTINO_PROPRIO = ['entrar', 'intro'];

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

  // O primeiro segmento como TEXTO, e o router do módulo: ver o comentário gêmeo no
  // `PortaoDoConsentimento`.
  const primeiroSegmento = useSegments()[0];

  useEffect(() => {
    // `carregando` é o que evita o piscar clássico: sem ele, o app mandaria todo mundo para o
    // login por meio segundo até a sessão do disco chegar.
    if (carregando) return;

    if (!sessao) {
      if (PUBLICAS.includes(primeiroSegmento)) return;
      router.replace('/entrar');
      return;
    }

    // ⚠️ E O SENTIDO CONTRÁRIO TAMBÉM É DAQUI: quem ACABOU DE ENTRAR sai da tela pública.
    //
    // Isto vivia na `entrar.tsx`, num `<Redirect href="/perfis" />`, e travava o app de quem
    // entra por Apple ou Google. Duas razões, e as duas contam:
    //
    // · um `<Redirect>` VALE OUTRA VEZ A CADA RENDER da tela que o contém, enquanto ela não for
    //   desmontada — não é uma ordem, é uma afirmação repetida;
    // · e ele afirmava `/perfis` enquanto o `PortaoDoConsentimento` afirmava `/consentimento`
    //   para quem ainda não declarou idade nem aceitou nada. Um desfazia o outro, e o que se via
    //   era a lista de perfis desenhada com todos os toques a serem engolidos. Pior: a conta
    //   ficava SEM consentimento registado, que é o que aquele portão existe para garantir.
    //
    // Aqui é um efeito: corre uma vez por mudança de rota, e leva a `/perfis`. O portão do
    // consentimento age DEPOIS, a partir de `/perfis`, e leva ao aceite quem precisa. Dois
    // movimentos em sequência, e não dois donos a disputar o mesmo volante.
    if (SEM_DESTINO_PROPRIO.includes(primeiroSegmento)) router.replace('/perfis');
  }, [carregando, sessao, primeiroSegmento]);

  return null;
};
