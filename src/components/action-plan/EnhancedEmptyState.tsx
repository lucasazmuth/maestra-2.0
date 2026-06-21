import { FC, useEffect, useState } from 'react';

import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import type { EnhancedEmptyStateProps } from './types';
import styles from './EnhancedEmptyState.module.scss';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Empty state conversacional: a Nyta "fala" (efeito de digitação) convidando o artista a
// iniciar o planejamento; ao terminar, surge a ação. Objetivo: intuitivo e acolhedor.
const EnhancedEmptyState: FC<EnhancedEmptyStateProps> = ({ artistName, onStartWizard }) => {
  const greeting = `Oi${artistName ? `, ${artistName}` : ''}! Eu sou a Nyta, sua estrategista de carreira. Bora montar, juntos, um plano sob medida pra você?`;

  const [typed, setTyped] = useState(REDUCE_MOTION ? greeting : '');
  const done = typed.length >= greeting.length;

  useEffect(() => {
    if (REDUCE_MOTION) {
      setTyped(greeting);
      return;
    }
    setTyped('');
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(greeting.slice(0, i));
      if (i >= greeting.length) window.clearInterval(id);
    }, 40);
    return () => window.clearInterval(id);
  }, [greeting]);

  return (
    <div className={styles.empty}>
      {/* Glow circula a borda da PÁGINA (container inteiro), não o card interno */}
      <span className='aurora-glow aurora-glow--on' aria-hidden />
      <div className={styles.content}>
        <div className={styles.avatar}>
          <NytaAvatar size={72} state={done ? 'idle' : 'thinking'} />
        </div>

        <p className={styles.greeting}>
          {typed}
          {!done && <span className={styles.caret} aria-hidden />}
        </p>

        <button
          className={`${styles.cta} ${done ? styles.ctaVisible : ''}`}
          onClick={onStartWizard}
          disabled={!done}
        >
          Sim, iniciar meu planejamento
        </button>
      </div>
    </div>
  );
};

export default EnhancedEmptyState;
