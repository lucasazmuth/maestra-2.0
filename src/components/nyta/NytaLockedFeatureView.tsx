import { FC } from 'react';
import { FiArrowRight } from 'react-icons/fi';

import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import styles from './NytaLockedFeatureView.module.scss';

interface NytaLockedFeatureViewProps {
  onNavigateToPlans: () => void;
}

export const NytaLockedFeatureView: FC<NytaLockedFeatureViewProps> = ({
  onNavigateToPlans,
}) => {
  return (
    <div className={styles.container}>
      <div className={styles.iconWrapper}>
        <NytaAvatar size={72} />
      </div>

      <h2 className={styles.title}>Nyta IA</h2>

      <p className={styles.description}>
        Sua assistente de IA integrada à plataforma Maestra. A Nyta ajuda com
        planejamento estratégico, gestão de tarefas, acompanhamento de metas e
        muito mais para impulsionar a carreira dos seus artistas.
      </p>

      <button className={styles.cta} onClick={onNavigateToPlans}>
        Assinar Maestra Pro
        <FiArrowRight className={styles.ctaIcon} />
      </button>
    </div>
  );
};
