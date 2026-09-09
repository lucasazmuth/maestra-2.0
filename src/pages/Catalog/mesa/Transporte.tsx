import { FC } from 'react';
import { FiPause, FiPlay } from 'react-icons/fi';

import styles from './mesa.module.scss';

// O transporte da mesa: um play, um relógio, uma régua.
//
// UM para toda a gravação, e não um por pista — é isso que diz, sem uma palavra, que as pistas
// tocam juntas. Um play por linha prometeria o contrário.

const relogio = (segundos: number) => {
  const s = Math.max(0, Math.floor(segundos));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export const Transporte: FC<{
  tocando: boolean;
  posicao: number;
  duracao: number;
  carregando: boolean;
  /** Quantas pistas conseguiram carregar. Zero = não há o que tocar. */
  prontas: number;
  aoAlternar: () => void;
  aoBuscar: (segundo: number) => void;
}> = ({ tocando, posicao, duracao, carregando, prontas, aoAlternar, aoBuscar }) => {
  const inerte = carregando || prontas === 0;

  return (
    <div className={styles.transporte}>
      <button
        type='button'
        className={styles.play}
        onClick={aoAlternar}
        disabled={inerte}
        aria-label={carregando
          ? 'Preparando as pistas'
          : prontas === 0 ? 'Nenhuma pista para tocar' : tocando ? 'Pausar' : 'Tocar'}
        title={tocando ? 'Pausar (espaço)' : 'Tocar (espaço)'}
      >
        {tocando ? <FiPause /> : <FiPlay />}
      </button>

      <span className={styles.relogio}>{relogio(posicao)}</span>

      {/* Régua como `range`: vem com teclado (setas para andar, Home e End para as pontas) sem
          uma linha de código nossa. Uma div arrastável não teria nada disso. */}
      <input
        type='range'
        className={styles.regua}
        min={0}
        max={Math.max(duracao, 0.001)}
        step={0.01}
        value={Math.min(posicao, duracao)}
        disabled={inerte}
        onChange={(evento) => aoBuscar(Number(evento.target.value))}
        aria-label='Posição da reprodução'
      />

      <span className={`${styles.relogio} ${styles.relogioTotal}`}>{relogio(duracao)}</span>
    </div>
  );
};
