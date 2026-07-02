import { FC } from 'react';
import { FiCheck, FiZap } from 'react-icons/fi';

import { usePlanPrices } from '../../hooks/usePlanPrices';
import styles from './ProUpsellBanner.module.scss';

interface ProUpsellBannerProps {
  onSubscribe: () => void;
}

/**
 * Pure function that determines whether the ProUpsellBanner should be visible.
 *
 * The banner is shown if and only if the artist profile is paid (isPaid === true)
 * AND the account does NOT have a PRO subscription (isPro === false).
 *
 * Validates: Requirements 2.1, 2.4, 2.5
 */
export interface ProUpsellVisibilityInput {
  isPaid: boolean;
  isPro: boolean;
}

export function shouldShowProUpsellBanner(input: ProUpsellVisibilityInput): boolean {
  return input.isPaid === true && input.isPro === false;
}

const BENEFITS = [
  'Nyta IA em todos os módulos',
  'Catálogo ilimitado',
  'Acompanhamento de evolução automatizado',
  'Lembretes inteligentes',
] as const;

/**
 * Banner promocional do Maestra PRO exibido no Dashboard de perfis pagos
 * que ainda não possuem assinatura PRO.
 *
 * Validates: Requirements 2.1, 2.2, 2.3
 */
export const ProUpsellBanner: FC<ProUpsellBannerProps> = ({ onSubscribe }) => {
  const { monthlyFmt } = usePlanPrices();
  return (
  <section
    className={styles.banner}
    aria-label="Promoção Maestra PRO"
    role="region"
  >
    <div className={styles.header}>
      <span className={styles.badge} aria-hidden="true">
        <FiZap size={12} />
        PRO
      </span>
    </div>

    <h2 className={styles.title}>Maestra PRO</h2>

    <div className={styles.price}>
      <span className={styles.priceValue}>{monthlyFmt}</span>
      <span className={styles.pricePeriod}>/mês</span>
    </div>

    <ul className={styles.benefits} aria-label="Benefícios do plano PRO">
      {BENEFITS.map((benefit) => (
        <li key={benefit}>
          <FiCheck className={styles.checkIcon} aria-hidden="true" />
          <span>{benefit}</span>
        </li>
      ))}
    </ul>

    <button
      className={styles.cta}
      onClick={onSubscribe}
      aria-label={`Assinar Maestra PRO por ${monthlyFmt} por mês`}
    >
      Assinar agora
    </button>
  </section>
  );
};
