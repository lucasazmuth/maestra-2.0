import { useEffect } from 'react';

import { PAYWALL_DISABLED } from '@maestra/core/constants/maestra';
import { fetchSubscriptionStatus } from '@maestra/core/store/slices/subscription';
import { useAppDispatch, useAppSelector } from '@maestra/core/store/store';

/**
 * Se cabe oferecer o PRO a quem esta olhando.
 *
 * TRES respostas viram uma so, e as tres importam:
 *
 * · com o paywall desligado nao se oferece nada — convidar a assinar o que esta liberado para
 *   todos e pedir dinheiro por nada;
 * · quem JA assina nao recebe convite para assinar;
 * · e, enquanto a resposta do servidor nao chega, tambem nao se oferece. O padrao do status e
 *   `none`, entao oferecer por padrao mostraria "Seja PRO" a um assinante e tiraria um segundo
 *   depois. Aparecer um instante atrasado para quem NAO assina e o erro barato dos dois.
 *
 * Quem buscava o status era a pilula do plano, no cabecalho, que agora e so da web. Sem esta
 * busca aqui, `initialized` ficaria falso para sempre e o item nunca apareceria — foi
 * exatamente o que aconteceu com a pilula na lista de perfis, antes de ela buscar por conta
 * propria. `initialized` vira true tambem quando a busca FALHA, entao uma rede ruim nao esconde
 * a oferta para sempre.
 */
export const useOfertaDoPro = (): boolean => {
  const dispatch = useAppDispatch();
  const status = useAppSelector((s) => s.subscription.status);
  const iniciado = useAppSelector((s) => s.subscription.initialized);

  useEffect(() => {
    if (!iniciado) void dispatch(fetchSubscriptionStatus());
  }, [iniciado, dispatch]);

  return !PAYWALL_DISABLED && iniciado && status !== 'active';
};
