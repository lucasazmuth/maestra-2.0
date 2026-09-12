import { router, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useEstadoDoConsentimento } from '@maestra/core/hooks/useConsent';

import { useSessao } from '@/nucleo/sessao';

/**
 * As telas que o portão NÃO tranca.
 *
 * A do próprio consentimento, obviamente — ela não pode expulsar quem está nela.
 *
 * ⚠️ E AS OUTRAS DUAS SÃO O QUE SE PEDE PARA ACEITAR. A tela do consentimento liga para os
 * Termos e para a Política, e tem um botão de falar com o suporte para quem errou a data de
 * nascimento. Enquanto esses três destinos viviam no navegador, o portão nem os via; no dia em
 * que passaram a ser telas daqui, sem esta lista ele devolvia a pessoa ao consentimento no
 * instante em que ela tocava em "Termos de uso".
 *
 * Ou seja: pedir o aceite de um documento e trancar a porta do documento. O portão existe para
 * garantir a coleta, e não para a impossibilitar.
 */
const LIVRES = [
  'consentimento', 'legal', 'suporte',
  // ⚠️ E AS TELAS PÚBLICAS, QUE É A CORREÇÃO DO APP TRAVADO.
  //
  // Quem está em `entrar`, `intro` ou `cadastro` ainda não entrou: quem manda nessas telas é o
  // `PortaoDaSessao`, que leva para `/perfis` assim que a sessão nasce. Sem esta linha, os dois
  // portões agarravam o volante ao mesmo tempo no instante do login — um a levar para os perfis,
  // o outro para o aceite — e cada um desfazia o do outro.
  //
  // O sintoma era a lista de perfis desenhada na tela com TODOS os toques a serem engolidos, e
  // foi assim que o login pela Apple travou o app: quem entra por provedor social é exatamente
  // quem ainda não declarou idade nem aceitou os documentos. Uma sonda no portão mostrou-o em
  // números: 52 pedidos de `replace('/consentimento')` vindos do segmento `entrar`.
  //
  // Pior do que o travamento: a conta ficava SEM consentimento nenhum registado — que é a coisa
  // que este portão existe para garantir.
  //
  // Agora são dois movimentos EM SEQUÊNCIA: a sessão leva de `entrar` a `perfis`, e só então o
  // consentimento leva de `perfis` ao aceite.
  'entrar', 'intro', 'cadastro',
];

// O PORTÃO DO CONSENTIMENTO (LGPD).
//
// Quem entra por Google ou Apple nunca declarou idade nem aceitou os documentos: o provedor
// devolve uma sessão e pronto. Sem este portão, essa pessoa usaria o app inteiro sem nada
// registrado — e é justamente o registro que sustenta a regra de maioridade dos Termos (§3) e
// da Política (§11).
//
// A regra e a consulta são as MESMAS da web: o `useEstadoDoConsentimento` do núcleo, que já
// sabe reaproveitar o que o formulário de cadastro coletou. Quem se cadastrou por e-mail
// respondeu tudo ali e não vê esta tela.
//
// INDISPONIBILIDADE NÃO TRANCA NINGUÉM. Se a consulta falhar, o estado vem nulo e o portão não
// age: trancar todo mundo do lado de fora por uma falha transitória é pior do que o risco que
// ele cobre, e a coleta volta a ser exigida na próxima verificação que der certo. É a mesma
// decisão que o `RequireConsent` da web tomou.

export const PortaoDoConsentimento = () => {
  const { sessao } = useSessao();
  const usuario = sessao?.user;
  const { state } = useEstadoDoConsentimento(
    usuario ? { id: usuario.id, email: usuario.email } : null,
  );
  // ⚠️ O ROUTER É O SINGLETON, E NÃO O `useRouter()` GUARDADO NUM `ref`.
  //
  // `useSegments` devolve um ARRAY novo e o `useRouter` um OBJETO novo a cada render. Com os
  // dois na lista de dependências, o efeito corria a cada render: enquanto a tela de origem não
  // terminasse de sair, cada render pedia outro `replace` para a MESMA rota, e cada `replace`
  // provocava outro render. O laço fechava, e o React derrubava tudo com "Maximum update depth
  // exceeded" — foi o que apareceu depois do login pela Apple.
  //
  // A primeira saída foi guardar o router num `ref` e escrevê-lo durante a renderização. Só que
  // este app compila com o React Compiler ligado (`reactCompiler` em `app.json`), e escrever num
  // `ref` durante a renderização é exatamente o que ele avisa que não se faz: se ele memoizar o
  // componente, a atribuição não corre e o portão fica com um router velho na mão. Trocar um
  // laço de renders por um volante que não responde é um mau negócio.
  //
  // O `router` importado do `expo-router` é o mesmo objeto sempre. Não precisa de `ref`, não
  // entra na lista de dependências, e o primeiro segmento é uma string: só muda quando a rota
  // muda de verdade, e então o portão age UMA vez por chegada. (O `app/conta.tsx` já o importa
  // assim.)
  const primeiroSegmento = useSegments()[0];

  useEffect(() => {
    if (!usuario || !state || state.satisfied) return;
    if (LIVRES.includes(primeiroSegmento)) return;
    router.replace('/consentimento');
  }, [usuario, state, primeiroSegmento]);

  return null;
};
