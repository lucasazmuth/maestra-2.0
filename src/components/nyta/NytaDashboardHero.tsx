import { FC, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FiArrowUpRight } from 'react-icons/fi';

import { NYTA_SUGGESTIONS } from '@maestra/core/constants/maestra';
import { saudacaoDaNyta } from '@maestra/core/constants/nytaChat';
import { InputBar } from '../../pages/NytaChat/components/InputBar';
import '../../pages/NytaChat/components/nytaChatUI.scss';
import styles from './NytaDashboardHero.module.scss';

export const NytaDashboardHero: FC<{ artistName?: string }> = ({ artistName }) => {
  const navigate = useNavigate();
  const artistId = window.location.pathname.match(/^\/artists\/([^/]+)/)?.[1];
  const greeting = artistName ? `Como eu posso ajudar hoje, ${artistName}?` : saudacaoDaNyta();
  const [activeSuggestion, setActiveSuggestion] = useState(0);
  const [animatedPlaceholder, setAnimatedPlaceholder] = useState('');

  const openNytaPage = (prompt?: string) => {
    if (!artistId) return;
    const query = prompt ? `?prompt=${encodeURIComponent(prompt)}` : '';
    navigate(`/artists/${artistId}/nyta${query}`);
  };

  useEffect(() => {
    const phrase = NYTA_SUGGESTIONS[activeSuggestion];
    let cursor = 0;
    let removing = false;
    let timer: number;

    const tick = () => {
      if (!removing) {
        cursor += 1;
        setAnimatedPlaceholder(phrase.slice(0, cursor));
        if (cursor === phrase.length) {
          removing = true;
          timer = window.setTimeout(tick, 1800);
          return;
        }
        timer = window.setTimeout(tick, 52);
        return;
      }

      cursor -= 1;
      setAnimatedPlaceholder(phrase.slice(0, cursor));
      if (cursor === 0) {
        setActiveSuggestion((current) => (current + 1) % NYTA_SUGGESTIONS.length);
        return;
      }
      timer = window.setTimeout(tick, 28);
    };

    setAnimatedPlaceholder('');
    timer = window.setTimeout(tick, 450);

    return () => window.clearTimeout(timer);
  }, [activeSuggestion]);

  return (
    <section className={`nyta-surface ${styles.hero}`} aria-label="Nyta">
      <div className={styles.inner}>
        <div className={styles.greeting}>
          <h2 className={styles.title}>{greeting}</h2>
        </div>
        <InputBar
          onSend={openNytaPage}
          disabled={false}
          rateLimitInfo={null}
          pendingToolCalls={[]}
          placeholder={animatedPlaceholder}
          animatedPlaceholder
        />
        <div className={styles.suggestions}>
          {NYTA_SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className={styles.suggestion}
              onClick={() => openNytaPage(suggestion)}
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
