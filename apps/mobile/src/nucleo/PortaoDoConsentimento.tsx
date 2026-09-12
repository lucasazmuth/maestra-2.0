import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

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
const LIVRES = ['consentimento', 'legal', 'suporte'];

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
  const router = useRouter();

  // ⚠️ O EFEITO DEPENDE DA ROTA COMO TEXTO, E O ROUTER NÃO ENTRA NA LISTA.
  //
  // `useSegments` devolve um ARRAY novo e o `useRouter` um OBJETO novo a cada render (ver o
  // mesmo cuidado em `app/bem-vindo.tsx`). Com os dois na lista, o efeito rodava a cada render:
  // enquanto a tela de origem não terminasse de sair, cada render pedia outro `replace` para a
  // MESMA rota, e cada `replace` provocava outro render. O laço fechava, e o React derrubava a
  // tela com "Maximum update depth exceeded" — foi o que apareceu depois do login pela Apple,
  // que é justamente quem cai neste portão.
  //
  // O primeiro segmento é uma string: ele só muda quando a rota muda de verdade, e então o
  // portão age UMA vez por chegada.
  const primeiroSegmento = useSegments()[0];
  const rota = useRef(router);
  rota.current = router;

  useEffect(() => {
    if (!usuario || !state || state.satisfied) return;
    if (LIVRES.includes(primeiroSegmento)) return;
    rota.current.replace('/consentimento');
  }, [usuario, state, primeiroSegmento]);

  return null;
};
