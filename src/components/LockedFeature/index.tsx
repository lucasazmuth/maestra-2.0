import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiCheck } from 'react-icons/fi';

import { LOCKED_FEATURE_CONFIG, type LockedFeatureKey } from './config';
import styles from './LockedFeature.module.scss';

interface LockedFeatureProps {
  feature: LockedFeatureKey;
}

export const LockedFeature: FC<LockedFeatureProps> = ({ feature }) => {
  const navigate = useNavigate();
  const config = LOCKED_FEATURE_CONFIG[feature];
  const Icon = config.icon;

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
          {config.cta.label}
        </button>
      </div>
    </div>
  );
};

export default LockedFeature;
