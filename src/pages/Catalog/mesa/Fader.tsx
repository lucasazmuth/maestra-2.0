import { FC } from 'react';

import styles from './mesa.module.scss';

// O volume de uma pista.
//
// É um `<input type='range'>` de verdade, e não um controle desenhado à mão como no app: aqui
// ele já vem com teclado (setas, Home, End), com o papel de "adjustable" para o leitor de ecrã
// e com o arrasto que o sistema operativo espera. Reimplementar isso em `div` seria trocar tudo
// isso por uma barra bonita.

export const Fader: FC<{
  /** 0..1 */
  valor: number;
  nome: string;
  apagado?: boolean;
  aoMudar: (valor: number) => void;
}> = ({ valor, nome, apagado, aoMudar }) => (
  <input
    type='range'
    className={`${styles.fader} ${apagado ? styles.faderApagado : ''}`}
    min={0}
    max={100}
    step={1}
    value={Math.round(Math.max(0, Math.min(valor, 1)) * 100)}
    onChange={(evento) => aoMudar(Number(evento.target.value) / 100)}
    aria-label={`Volume de ${nome}`}
  />
);
