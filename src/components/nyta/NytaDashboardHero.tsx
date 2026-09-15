import { FC } from 'react';
import { FiArrowUpRight } from 'react-icons/fi';

import { useNytaModal } from '@maestra/core/hooks/useNytaModal';
import { NYTA_SUGGESTIONS } from '@maestra/core/constants/maestra';
import { saudacaoDaNyta } from '@maestra/core/constants/nytaChat';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import { InputBar } from '../../pages/NytaChat/components/InputBar';
import '../../pages/NytaChat/components/nytaChatUI.scss';
import styles from './NytaDashboardHero.module.scss';

export const NytaDashboardHero: FC = () => {
  const { openWithPrompt } = useNytaModal();

  return (
    <section className={`nyta-surface ${styles.hero}`} aria-label="Nyta">
      <div className={styles.inner}>
        <div className={styles.greeting}>
          <NytaAvatar size={48} />
          <h2 className={styles.title}>{saudacaoDaNyta()}</h2>
        </div>
        <InputBar
          onSend={openWithPrompt}
          disabled={false}
          rateLimitInfo={null}
          pendingToolCalls={[]}
        />
        <div className={styles.suggestions}>
          {NYTA_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.suggestion}
              onClick={() => openWithPrompt(suggestion)}
            >
              <span>{suggestion}</span>
              <FiArrowUpRight size={16} aria-hidden />
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default NytaDashboardHero;
