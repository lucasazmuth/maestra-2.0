import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';

import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from './config';
import { usePlanPrices } from '../../hooks/usePlanPrices';
import styles from './LockedFeature.module.scss';

interface LockedFeatureProps {
  feature: LockedFeatureKey;
}

export const LockedFeature: FC<LockedFeatureProps> = ({ feature }) => {
  const navigate = useNavigate();
  const { onceFmt, monthlyFmt } = usePlanPrices();
  const config = LOCKED_FEATURE_CONFIG[feature];
  const Icon = config.icon;

  // Preço dinâmico anexado ao label conforme a origem do bloqueio.
  const ctaLabel = config.cta.kind === 'unlock-profile'
    ? `${config.cta.label} — ${onceFmt}`
    : `${config.cta.label} — ${monthlyFmt}/mês`;

  const handleCta = () => {
    if (config.cta.kind === 'unlock-profile') {
      navigate('/criar-artista');
    } else {
      navigate('/assinatura');
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.content}>
        <Icon className={styles.icon} />
        <h1 className={styles.title}>{config.title}</h1>
        <ul className={styles.benefits}>
          {config.benefits.map((benefit, index) => (
            <li key={index}>
              <FiCheck className={styles.checkIcon} />
              <span>{benefit}</span>
            </li>
          ))}
        </ul>
        <button className={styles.cta} onClick={handleCta}>
          {ctaLabel}
        </button>
      </div>
    </div>
  );
};

export default LockedFeature;
