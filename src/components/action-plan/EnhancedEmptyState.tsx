import { FC, useEffect, useState } from 'react';

import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import type { EnhancedEmptyStateProps } from './types';
import styles from './EnhancedEmptyState.module.scss';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

// Empty state conversacional: a Nyta "fala" (efeito de digitação) convidando o artista a
// iniciar o planejamento; ao terminar, surge a ação. Objetivo: intuitivo e acolhedor.
const EnhancedEmptyState: FC<EnhancedEmptyStateProps> = ({ artistName, onStartWizard, canStart = true }) => {
  const greeting = canStart
    ? `Oi${artistName ? `, ${artistName}` : ''}! Eu sou a Nyta, sua estrategista de carreira. Bora montar, juntos, um plano sob medida pra você?`
    : `Oi${artistName ? `, ${artistName}` : ''}! Eu sou a Nyta. O planejamento deste artista ainda não foi criado. Assim que o titular do perfil montar o plano, ele aparece aqui pra você acompanhar.`;

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

  // O anel "aurora" saiu daqui: sobre o fundo preto era um brilho passageiro na borda; no design
  // claro virava uma moldura azul em volta da página inteira, lida como defeito.
  return (
    <div className={styles.empty}>
      <div className={styles.content}>
        <div className={styles.avatar}>
          <NytaAvatar size={72} state={done ? 'idle' : 'thinking'} />
        </div>

        <p className={styles.greeting}>
          {typed}
          {!done && <span className={styles.caret} aria-hidden />}
        </p>

        {canStart && (
          <button
            className={`${styles.cta} ${done ? styles.ctaVisible : ''}`}
            onClick={onStartWizard}
            disabled={!done}
          >
            Sim, iniciar meu planejamento
          </button>
        )}
      </div>
    </div>
  );
};

export default EnhancedEmptyState;
