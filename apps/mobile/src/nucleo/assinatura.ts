import { useEffect } from 'react';

import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

/**
 * O status da assinatura, buscando-o se ninguem buscou ainda.
 *
 * Quem buscava era a pilula do plano, no cabecalho. Sem esta busca, `initialized` ficaria falso
 * para sempre — foi exatamente o que aconteceu com a pilula na lista de perfis, antes de ela
 * buscar por conta propria.
 *
 * `initialized` vira true tambem quando a busca FALHA, entao uma rede ruim nao trava as duas
 * respostas abaixo para sempre.
 */
const useStatusDaAssinatura = () => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.subscription.status);
  const iniciado = useAppSelector((s) => s.subscription.initialized);
  const idDaAssinatura = useAppSelector((s) => s.subscription.asaasSubscriptionId);
  const fimDaTolerancia = useAppSelector((s) => s.subscription.gracePeriodEndsAt);

  useEffect(() => {
    if (!iniciado) void dispatch(fetchSubscriptionStatus());
  }, [iniciado, dispatch]);

  return { status, iniciado, idDaAssinatura, fimDaTolerancia };
};

/** O que o selo do cabecalho diz — ou nada, que e o caso de quem nao paga. */
export type TomDoSelo = 'pro' | 'pending';

/**
 * Qual selo mostrar no cabecalho.
 *
 * `null` para quem nao assina: no app o selo NAO tem o estado FREE, porque uma pilula "FREE"
 * que leva ao checkout e direcionar para fora da loja (3.1.3). Quem nao assina encontra o
 * convite em "Seja PRO", dentro do menu.
 *
 * O PENDENTE tem duas origens, e as duas sao a mesma regra da web:
 *
 * · `pending` COM id de assinatura. O id importa: uma linha `pending` SEM ele e fantasma — uma
 *   cobranca que nunca virou assinatura — e mostrar "Pendente" para ela prometeria um acesso
 *   que nao esta a caminho;
 * · `overdue` DENTRO da tolerancia. Passado o prazo o acesso acabou, e ai nao ha mais nada
 *   pendente: ha uma assinatura vencida, que e outra conversa.
 *
 * Enquanto a resposta do servidor nao chega, `null`: um selo que aparece um instante depois e
 * melhor do que um selo que pisca na tela de quem nao assina.
 */
export const useTomDoSelo = (): TomDoSelo | null => {
  const { status, iniciado, idDaAssinatura, fimDaTolerancia } = useStatusDaAssinatura();

  if (!iniciado) return null;
  if (status === 'active') return 'pro';

  const naTolerancia = !!fimDaTolerancia && Date.now() < new Date(fimDaTolerancia).getTime();
  const pendente = (status === 'pending' && !!idDaAssinatura)
    || (status === 'overdue' && naTolerancia);

  return pendente ? 'pending' : null;
};

/**
 * Se cabe oferecer o PRO a quem esta olhando.
 *
 * A oferta e o AVESSO do selo: ela aparece exatamente quando nao ha selo. Assim ninguem ve
 * "Pendente" no cabecalho e "Seja PRO" no menu ao mesmo tempo, que seria o app pedindo de novo
 * um dinheiro que ja esta em confirmacao.
 *
 * Isso ja cobre os dois casos que importam: quem assina nao recebe convite, e enquanto a
 * resposta do servidor nao chega tambem nao se oferece — o padrao do status e `none`, entao
 * oferecer por padrao mostraria "Seja PRO" a um assinante e tiraria um segundo depois. Aparecer
 * um instante atrasado para quem NAO assina e o erro barato dos dois.
 *
 * Falta so o paywall: desligado, nao se oferece nada. Convidar a assinar o que esta liberado
 * para todos e pedir dinheiro por nada.
 */
export const useOfertaDoPro = (): boolean => {
  const tom = useTomDoSelo();
  const { iniciado } = useStatusDaAssinatura();

  return !PAYWALL_DISABLED && iniciado && tom === null;
};
