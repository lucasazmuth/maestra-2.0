import { FC, ReactNode } from 'react';

import styles from './AiGlow.module.scss';

// Envolve um botão (ou elemento) de interação com a IA e desenha a luz "aurora"
// percorrendo o contorno. Use em volta de qualquer CTA da Nyta.
export const AiGlow: FC<{ children: ReactNode; className?: string }> = ({ children, className }) => (
  <span className={`${styles.wrap}${className ? ` ${className}` : ''}`}>
    <span className={styles.glow} aria-hidden />
    {children}
  </span>
);

export default AiGlow;
