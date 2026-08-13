import { FC, useEffect, useState } from 'react';
import {
  FiMusic, FiShare2, FiTrendingUp, FiGitMerge, FiDollarSign, FiRadio, FiBarChart2, FiAward,
} from 'react-icons/fi';

import styles from './AnalyzingSteps.module.scss';

// Lista "pensante" do Diagnóstico REAL: passos que sobem um a um dentro de uma janela, o do centro
// nítido e os das pontas esmaecidos (máscara de gradiente). Loop contínuo enquanto o motor roda —
// dá a sensação de que a IA está acessando cada recurso, em vez de um spinner mudo.
const STEPS = [
  { icon: <FiMusic />, label: 'Analisando seu perfil no Spotify' },
  { icon: <FiShare2 />, label: 'Buscando sua presença nas redes sociais' },
  { icon: <FiTrendingUp />, label: 'Medindo alcance e engajamento' },
  { icon: <FiGitMerge />, label: 'Cruzando os dados do seu quiz' },
  { icon: <FiDollarSign />, label: 'Avaliando sua saúde financeira' },
  { icon: <FiRadio />, label: 'Mapeando sua presença na mídia' },
  { icon: <FiBarChart2 />, label: 'Calculando seu Índice REAL' },
  { icon: <FiAward />, label: 'Montando seu diagnóstico' },
];

const STEP_MS = 1500; // tempo que cada item "descansa" no centro antes de subir

export const AnalyzingSteps: FC<{ light?: boolean }> = ({ light = false }) => {
  const [offset, setOffset] = useState(0);
  const [animate, setAnimate] = useState(true);

  // Avança um passo a cada intervalo (o item do centro sobe e o próximo assume).
  useEffect(() => {
    const id = window.setInterval(() => setOffset((o) => o + 1), STEP_MS);
    return () => window.clearInterval(id);
  }, []);

  // Loop sem emenda: a lista é duplicada; ao chegar no fim do 1º ciclo, volta pro início SEM
  // transição (o conteúdo é idêntico ali, então o "salto" é invisível).
  useEffect(() => {
    if (offset === STEPS.length) {
      const t = window.setTimeout(() => { setAnimate(false); setOffset(0); }, 620);
      return () => window.clearTimeout(t);
    }
    if (!animate) {
      const raf = window.requestAnimationFrame(() => setAnimate(true));
      return () => window.cancelAnimationFrame(raf);
    }
    return undefined;
  }, [offset, animate]);

  return (
    <div className={`${styles.wrap}${light ? ` ${styles.light}` : ''}`} role='status' aria-label='Analisando os dados do seu diagnóstico'>
      <div className={styles.window}>
        <div
          className={styles.track}
          style={{
            transform: `translateY(calc(var(--rowH) * ${-offset}))`,
            transition: animate ? 'transform 0.6s cubic-bezier(0.4, 0, 0.2, 1)' : 'none',
          }}
        >
          {[...STEPS, ...STEPS].map((s, i) => (
            <div className={styles.row} key={i}>
              <span className={styles.icon}>{s.icon}</span>
              <span className={styles.label}>{s.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AnalyzingSteps;
