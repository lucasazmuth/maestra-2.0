import { CSSProperties, FC, ReactNode } from 'react';

import styles from './AiGlow.module.scss';

// Envolve um botão (ou elemento) de interação com a IA e desenha a luz "aurora"
// percorrendo o contorno. Use em volta de qualquer CTA da Nyta.
// `style` vai no wrapper (inline, sempre vence a classe) — usado pra adaptar o glow a
// containers não-pílula (ex.: cards retangulares em largura cheia).
export const AiGlow: FC<{ children: ReactNode; className?: string; style?: CSSProperties }> = ({ children, className, style }) => (
  <span className={`${styles.wrap}${className ? ` ${className}` : ''}`} style={style}>
    <span className={styles.glow} aria-hidden />
    {children}
  </span>
);

export default AiGlow;
