import { FC, useState } from 'react';
import { FiArrowRight } from 'react-icons/fi';

import { useNytaModal } from '../../hooks/useNytaModal';
import { NYTA_SUGGESTIONS } from '../../constants/maestra';
import { NytaAvatar } from '../../pages/Wizard/chat/nytaPersona';
import styles from './NytaDashboardHero.module.scss';

/**
 * Hero da Nyta no Dashboard: entrada do assistente com brilho aurora, campo de busca
 * e card do agente com sugestões. Digitar + enviar (ou clicar num chip) abre o chat já com
 * a pergunta; o campo vazio abre o chat em branco.
 */
export const NytaDashboardHero: FC = () => {
  const { open, openWithPrompt } = useNytaModal();
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (t) {
      openWithPrompt(t);
      setText('');
    } else {
      open();
    }
  };

  return (
    <section className={styles.hero}>
      <div className={styles.inner}>
        <span className={styles.kicker}>Nyta · sua consultora</span>

        <h2 className={styles.title}>Como posso te ajudar hoje?</h2>
        <p className={styles.subtitle}>
          Sua estrategista de carreira, todos os dias, pra você focar na sua música.
        </p>

        <form
          className={styles.inputBar}
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className={styles.input}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Quais análises da sua carreira vamos fazer hoje?"
            aria-label="Pergunte algo à Nyta"
          />
          <button type="submit" className={styles.send} aria-label="Enviar">
            <FiArrowRight size={18} />
          </button>
        </form>

        <div className={styles.agent}>
          <div className={styles.agentHead}>
            <NytaAvatar size={32} />
            <span>
              <span className={styles.agentName}>Nyta IA</span>
              <span className={styles.agentRole}>Estratégia de Carreira</span>
            </span>
          </div>

          <p className={styles.agentGreeting}>
            Oi! Eu sou a Nyta, sua estrategista de carreira. Planejo sua carreira pra
            você focar na sua música.
          </p>

          <span className={styles.agentLabel}>Então experimente uma destas opções</span>

          <div className={styles.chips}>
            {NYTA_SUGGESTIONS.map((s) => (
              <button key={s} type="button" className={styles.chip} onClick={() => openWithPrompt(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>

        <p className={styles.disclaimer}>
          A Nyta pode cometer erros. Confira informações importantes.
        </p>
      </div>
    </section>
  );
};

export default NytaDashboardHero;
