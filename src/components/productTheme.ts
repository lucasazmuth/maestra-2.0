import type { CSSProperties } from 'react';

import { ACENTO_DO_PRODUTO } from '@maestra/core/constants/produtos';

import gradReal from './journey/gradients/real.svg';
import gradPlanning from './journey/gradients/planning.svg';
import gradAction from './journey/gradients/action.svg';

// Identidade visual de cada produto do ciclo de crescimento (cor + gradiente de fundo próprio).
// Compartilhado entre os cards da jornada (Dashboard) e o fundo das páginas de cada produto.
export const PRODUCT_THEME = {
  real: { accent: ACENTO_DO_PRODUTO.real, bg: gradReal },
  planning: { accent: ACENTO_DO_PRODUTO.planning, bg: gradPlanning },
  action: { accent: ACENTO_DO_PRODUTO.action, bg: gradAction },
};

// Fundo sutil da página: um glow radial no topo, na cor do produto (mesma cor dos cards da jornada),
// fixo no viewport. Dá coerência cromática entre Dashboard e as páginas, sem atrapalhar a leitura.
export const pageBg = (accent: string): CSSProperties => ({
  backgroundColor: '#0a0a0c',
  backgroundImage: `radial-gradient(120% 50% at 50% -10%, rgba(${accent},0.10) 0%, rgba(${accent},0.035) 36%, transparent 64%)`,
  backgroundAttachment: 'fixed',
  backgroundRepeat: 'no-repeat',
});
