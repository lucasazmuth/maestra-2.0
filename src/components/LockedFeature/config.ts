import { IconType } from 'react-icons';
import { FiCheckSquare, FiUsers, FiTrendingUp } from 'react-icons/fi';

import {
  LOCKED_FEATURE_CONFIG as TEXTOS,
  type LockedFeatureKey,
} from '@maestra/core/constants/bloqueios';

// Os TEXTOS dos bloqueios moram no núcleo — o app nativo mostra a mesma tela, e a lista de
// benefícios é uma promessa comercial, não decoração. Aqui fica só o que é da web: o ícone de
// cada bloqueio, que é o mesmo do item no menu lateral do módulo.

export type { LockedFeatureKey, LockedCtaKind, LockedFeatureConfig } from '@maestra/core/constants/bloqueios';

const ICONES: Record<LockedFeatureKey, IconType> = {
  planning: FiCheckSquare, // = "Plano de Ação" na navbar
  team: FiUsers, // = "Equipe" na navbar
  tasks: FiCheckSquare,
  nyta: FiTrendingUp,
};

export const LOCKED_FEATURE_CONFIG = Object.fromEntries(
  (Object.keys(TEXTOS) as LockedFeatureKey[]).map((chave) => [
    chave,
    { ...TEXTOS[chave], icon: ICONES[chave] },
  ]),
) as Record<LockedFeatureKey, (typeof TEXTOS)[LockedFeatureKey] & { icon: IconType }>;
