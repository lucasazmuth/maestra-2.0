import { FC, useMemo } from 'react';

// A placa em si é do núcleo (SVGs e tabelas); aqui fica só o componente da web.
import {
  PROFILE_ABBR, TIER_ACCENT, svgDaPlaca, tierForAltas, tierForPattern, altasForPattern,
  type RealTier,
} from '@maestra/core/constants/realBadge';

export { PROFILE_ABBR, TIER_ACCENT, tierForAltas, tierForPattern, altasForPattern };
export type { RealTier };

export const RealBadge: FC<{ tier: RealTier; label: string; size?: number }> = ({ tier, label, size = 64 }) => {
  // ids únicos por instância: evita colisão de gradientes/filtros quando há várias placas na tela.
  const uid = useMemo(() => `rb${Math.random().toString(36).slice(2, 8)}`, []);
  const isBase = tier === 'base';
  const html = useMemo(() => svgDaPlaca(tier, label, uid), [tier, label, uid]);
  return (
    <span
      aria-label={`Placa ${tier} · ${label}`}
      style={{
        display: 'inline-block', width: size, height: size, lineHeight: 0, flexShrink: 0,
        // nível 0 (base): placa Standard em cinza, pra diferenciar do 1 alta (verde).
        filter: isBase ? 'grayscale(1)' : undefined,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default RealBadge;
