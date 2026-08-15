import { FC, useId } from 'react';
import { useNavigate } from 'react-router-dom';

import { useAppSelector } from '../../store/store';
import { PAYWALL_DISABLED } from '../../constants/maestra';
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

// Gema facetada, no espírito do selo de referência: topo em leque e ponta embaixo. Desenhada
// aqui em 24×24 porque o arquivo original tem 1,9 MB (traz imagens embutidas) — o que importa é
// a silhueta e o degradê, não o bitmap.
const Gem: FC<{ gradientId: string }> = ({ gradientId }) => (
  <svg viewBox='0 0 24 24' width='12' height='12' fill='none' aria-hidden focusable='false'>
    <path d='M7 4h10l4 5-9 11L3 9l4-5Z' fill={`url(#${gradientId})`} />
    <path
      d='M7 4l2.6 5L12 20 14.4 9 17 4M3 9h18'
      stroke='#fff'
      strokeOpacity='.55'
      strokeWidth='1.1'
      strokeLinejoin='round'
    />
  </svg>
);

export const PlanTag: FC = () => {
  const navigate = useNavigate();
  const gradientId = useId();
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
      <svg width='0' height='0' aria-hidden focusable='false' className={styles.defs}>
        <defs>
          <linearGradient id={gradientId} x1='12' y1='4' x2='12' y2='20' gradientUnits='userSpaceOnUse'>
            <stop stopColor='var(--plan-gem-from)' />
            <stop offset='.45' stopColor='var(--plan-gem-mid)' />
            <stop offset='1' stopColor='var(--plan-gem-to)' />
          </linearGradient>
        </defs>
      </svg>
      <Gem gradientId={gradientId} />
      {label}
    </button>
  );
};

export default PlanTag;
