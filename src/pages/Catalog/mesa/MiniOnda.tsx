import { FC, memo } from 'react';

import styles from './mesa.module.scss';

// A onda de uma pista, em miniatura.
//
// Desenhada a partir dos picos que a MESA já tem — ela descodificou o áudio para tocar, e os
// números estão ali. A alternativa seria um wavesurfer por pista, e isso descodificaria o mesmo
// áudio outra vez: com seis stems, o PCM inteiro duas vezes na memória.
//
// A parte já tocada fica na cor de ação, o resto em cinza — é a mesma leitura da onda grande,
// e dispensa uma agulha por cima.

/** Quantas barras. 60 é o que cabe numa linha estreita sem virar um borrão. */
export const BARRAS = 60;

const LARGURA = 2;
const INTERVALO = 2;
const ALTURA = 34;
/** Uma barra sempre visível: silêncio absoluto é uma linha, não um vazio. */
const MINIMA = 2;

type Props = { picos: number[]; progresso: number; apagada?: boolean };

const MiniOndaBase: FC<Props> = ({ picos, progresso, apagada }) => {
  if (!picos.length) return <div className={styles.ondaVazia} />;

  const largura = picos.length * (LARGURA + INTERVALO);
  const ate = progresso * picos.length;

  return (
    <svg
      className={styles.onda}
      viewBox={`0 0 ${largura} ${ALTURA}`}
      preserveAspectRatio='none'
      aria-hidden
    >
      {picos.map((pico, i) => {
        const alta = Math.max(MINIMA, pico * ALTURA);
        return (
          <rect
            key={i}
            x={i * (LARGURA + INTERVALO)}
            y={(ALTURA - alta) / 2}
            width={LARGURA}
            height={alta}
            rx={1}
            className={apagada ? styles.barraApagada : i < ate ? styles.barraAndada : styles.barra}
          />
        );
      })}
    </svg>
  );
};

export const MiniOnda = memo(MiniOndaBase);
