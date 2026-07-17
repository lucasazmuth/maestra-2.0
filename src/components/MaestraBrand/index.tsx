import type { FC, HTMLAttributes } from 'react';

import { ReactComponent as SymbolMark } from '../../assets/brand/maestra-symbol.svg';
import { ReactComponent as WordmarkMark } from '../../assets/brand/maestra-wordmark.svg';
import styles from './MaestraBrand.module.scss';

export type MaestraBrandVariant = 'symbol' | 'wordmark' | 'lockup';
export type MaestraBrandTone = 'light' | 'dark';

export interface MaestraBrandProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  variant: MaestraBrandVariant;
  tone: MaestraBrandTone;
  beta?: boolean;
}

/** Vetores oficiais da Maestra, normalizados para uso em qualquer superfície do produto. */
export const MaestraBrand: FC<MaestraBrandProps> = ({
  variant,
  tone,
  beta = false,
  className,
  role,
  'aria-label': ariaLabel,
  'aria-hidden': ariaHidden,
  ...props
}) => {
  const hidden = ariaHidden === true || ariaHidden === 'true';
  const classes = [styles.root, styles[variant], styles[tone], className].filter(Boolean).join(' ');

  return (
    <span
      {...props}
      className={classes}
      role={hidden ? undefined : role || 'img'}
      aria-label={hidden ? undefined : ariaLabel || 'Maestra'}
      aria-hidden={ariaHidden}
      data-brand-variant={variant}
      data-brand-tone={tone}
    >
      {(variant === 'symbol' || variant === 'lockup') && (
        <SymbolMark
          className={[styles.graphic, styles.symbolGraphic].join(' ')}
          aria-hidden='true'
          focusable='false'
        />
      )}
      {(variant === 'wordmark' || variant === 'lockup') && (
        <WordmarkMark
          className={[styles.graphic, styles.wordmarkGraphic].join(' ')}
          aria-hidden='true'
          focusable='false'
        />
      )}
      {beta && <span className={styles.beta} aria-hidden='true'>Beta</span>}
    </span>
  );
};

export default MaestraBrand;
