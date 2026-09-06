import { useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';

import { useEstadoDoConsentimento } from '@maestra/core/hooks/useConsent';

import { useSessao } from '@/nucleo/sessao';

/** A tela do próprio consentimento, que não pode expulsar quem está nela. */
const CONSENTIMENTO = 'consentimento';

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
  const segmentos = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!usuario || !state || state.satisfied) return;
    if (segmentos[0] === CONSENTIMENTO) return;
    router.replace('/consentimento');
  }, [usuario, state, segmentos, router]);

  return null;
};
