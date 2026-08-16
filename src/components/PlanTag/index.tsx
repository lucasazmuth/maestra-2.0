import { FC } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../store/store';
import { PAYWALL_DISABLED } from '../../constants/maestra';
import { Gem } from './Gem';
import styles from './PlanTag.module.scss';

// Selo do plano ao lado da marca. Substitui a barra de aviso que ocupava o rodapé inteiro para
// dizer, em duas linhas, o que cabe em uma palavra — o plano é um estado permanente da conta,
// não um alerta que interrompe.
//
// Três estados, e nada além disso:
//   PRO      assinatura ativa;
//   PENDENTE cobrança gerada e ainda não confirmada, com o acesso valendo (inclui o período de
//            tolerância de uma fatura vencida — o acesso continua e o pagamento é o que falta);
//   FREE     sem assinatura.

export const PlanTag: FC = () => {
  const navigate = useNavigate();
  const status = useAppSelector((s) => s.subscription.status);
  const initialized = useAppSelector((s) => s.subscription.initialized);
  const gracePeriodEndsAt = useAppSelector((s) => s.subscription.gracePeriodEndsAt);
  const asaasSubscriptionId = useAppSelector((s) => s.subscription.asaasSubscriptionId);

  // Sem resposta do servidor ainda, o status é 'none' por padrão: mostrar "FREE" e trocar para
  // "PRO" um segundo depois seria pior do que não mostrar nada.
  if (!initialized || PAYWALL_DISABLED) return null;

  // 'pending' sem subscription_id é resquício do pagamento único (a linha existe só para o
  // cliente do Asaas), não uma assinatura em andamento — mesma regra do antigo banner.
  const pendente =
    (status === 'pending' && !!asaasSubscriptionId) ||
    (status === 'overdue' && !!gracePeriodEndsAt && Date.now() < new Date(gracePeriodEndsAt).getTime());

  const plano = status === 'active' ? 'pro' : pendente ? 'pending' : 'free';
  const label = plano === 'pro' ? 'PRO' : plano === 'pending' ? 'Pendente' : 'FREE';
  const titulo =
    plano === 'pro' ? 'Maestra Pro ativo'
      : plano === 'pending' ? 'Pagamento em confirmação — seu acesso segue liberado'
      : 'Plano gratuito — ver o Maestra Pro';

  return (
    <button
      type='button'
      className={`${styles.tag} ${styles[plano]}`}
      title={titulo}
      aria-label={titulo}
      onClick={() => navigate('/assinatura')}
    >
      <Gem />
      {label}
    </button>
  );
};

export default PlanTag;
