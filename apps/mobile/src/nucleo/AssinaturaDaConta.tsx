import { useEffect } from 'react';

import { fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

import { useSessao } from '@/nucleo/sessao';

// O ESTADO DA ASSINATURA, buscado UMA VEZ, na raiz.
//
// Ele era buscado pela pílula do plano — e só por ela. Quem lê o `useEntitlements` (a Nyta
// Consultora, o refazer do diagnóstico, o limite do catálogo) lia o store direto, sem disparar
// busca nenhuma: numa tela onde a pílula não estivesse montada, ou antes de a resposta dela
// chegar, o padrão `none` valia como resposta. O assinante PRO via cadeado no próprio recurso
// que paga.
//
// Aqui na raiz, o estado chega antes de qualquer tela precisar dele. A pílula continua com a
// sua própria busca de segurança (ela também aparece na lista de perfis, fora deste fluxo), e
// `initialized` impede a segunda ida ao servidor.
//
// Depende da SESSÃO: sem ela a edge devolve 401, e insistir a cada abertura do app seria um
// erro por sessão. Ao entrar, o efeito roda de novo — é o que troca o estado de quem acabou de
// fazer login.

export const AssinaturaDaConta = () => {
  const dispatch = useAppDispatch();
  const { sessao } = useSessao();
  const iniciado = useAppSelector((s) => s.subscription.initialized);

  useEffect(() => {
    if (sessao?.user.id && !iniciado) void dispatch(fetchSubscriptionStatus());
  }, [sessao?.user.id, iniciado, dispatch]);

  return null;
};
