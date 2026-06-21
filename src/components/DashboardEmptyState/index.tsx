import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiLock } from 'react-icons/fi';

import styles from './DashboardEmptyState.module.scss';

interface DashboardEmptyStateProps {
  title: string;
  description: string;
  ctaLabel?: string;
  ctaTo?: string;
}

export const DashboardEmptyState: FC<DashboardEmptyStateProps> = ({
  title,
  description,
  ctaLabel = 'Assinar Pro',
  ctaTo = '/assinatura',
}) => {
  const navigate = useNavigate();

  return (
    <div className={styles.container}>
      <FiLock className={styles.icon} />
      <h3 className={styles.title}>{title}</h3>
      <p className={styles.description}>{description}</p>
      <button className={styles.cta} onClick={() => navigate(ctaTo)}>
        {ctaLabel}
      </button>
    </div>
  );
};
