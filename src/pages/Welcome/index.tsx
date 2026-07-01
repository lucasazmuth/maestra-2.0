import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowRight } from 'react-icons/fi';

import { Wordmark } from '../../components/Wordmark';
import styles from './Welcome.module.scss';

// Canal do YouTube da Maestra (tutorial).
const YOUTUBE_URL = 'https://www.youtube.com/channel/UCoqTUfW8kpK7AV_iWVjUrQg';

const REDUCE_MOTION =
  typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

const GREETING =
  'Bem-vindo à Maestra! Aqui a sua carreira vira estratégia, com a Nyta te guiando. Bora criar o seu primeiro perfil?';

// Tela de boas-vindas pós-cadastro: a Maestra dá as boas-vindas (efeito de digitação) e
// convida o artista a criar o primeiro perfil. Mantém o fundo roxo premium da tela original.
const Welcome: FC = () => {
  const navigate = useNavigate();

  const [typed, setTyped] = useState(REDUCE_MOTION ? GREETING : '');
  const done = typed.length >= GREETING.length;

  useEffect(() => {
    if (REDUCE_MOTION) return;
    let i = 0;
    const id = window.setInterval(() => {
      i += 1;
      setTyped(GREETING.slice(0, i));
      if (i >= GREETING.length) window.clearInterval(id);
    }, 32);
    return () => window.clearInterval(id);
  }, []);

  const goToArtists = () => navigate('/artists', { replace: true });
  const startTutorial = () => {
    window.open(YOUTUBE_URL, '_blank', 'noopener,noreferrer');
    goToArtists();
  };

  return (
    <div className={styles.page}>
      <div className={styles.pillWrap}>
        <div className={styles.pillGlow} aria-hidden />
        <div className={styles.pill}>
          <Wordmark className={styles.pillText} />
        </div>
      </div>

      <p className={styles.greeting}>
        {typed}
        {!done && <span className={styles.caret} aria-hidden />}
      </p>

      <div className={`${styles.actions} ${done ? styles.actionsVisible : ''}`}>
        <button type='button' className={styles.skip} onClick={startTutorial} disabled={!done}>
          Ver tutorial
        </button>
        <button type='button' className={styles.cta} onClick={goToArtists} disabled={!done}>
          Começar <FiArrowRight />
        </button>
      </div>
    </div>
  );
};

export default Welcome;
