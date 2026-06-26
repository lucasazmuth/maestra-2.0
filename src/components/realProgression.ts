import type { RealIndex } from '../interfaces/maestra';
import { tierForAltas, type RealTier } from './RealBadge';

// Progressão de "nível" do REAL: a escada é o nº de dimensões R·E·A·L altas (0→4) = os 5 tiers de
// placa. Calcula a fase atual, o próximo nível e o "driver" (qual dimensão baixa está mais perto de
// virar alta — o caminho mais curto pra subir). Suporta o realIndex v2 (boletim/cutLine 0–100) e o
// v1 (z-scores em `dimensions`, sem pontuação 0–100).

export type RealDim = 'r' | 'e' | 'a' | 'l';

export const DIM_LABEL: Record<RealDim, string> = {
  r: 'Alcance',
  e: 'Receita',
  a: 'Público',
  l: 'Legitimação',
};

const DIMS: RealDim[] = ['r', 'e', 'a', 'l'];

export interface RealProgression {
  altas: number;                 // 0–4
  tier: RealTier;                // placa atual
  nextTier: RealTier | null;     // placa do próximo andar (null no topo)
  atTop: boolean;                // já é Icon (4 altas)
  // dimensão baixa mais perto de virar alta (o próximo passo). gap em pts só no v2.
  driver: { dim: RealDim; label: string; gap: number | null } | null;
}

export function realProgression(ri: RealIndex): RealProgression {
  const altas = DIMS.filter((d) => ri.pattern[d]).length;
  const tier = tierForAltas(altas);
  const atTop = altas >= 4;
  const nextTier = atTop ? null : tierForAltas(altas + 1);

  const riAny = ri as unknown as { version?: number; boletim?: Record<RealDim, number>; cutLine?: Record<RealDim, number>; dimensions?: Record<RealDim, number> };
  const isV2 = riAny.version === 2 && !!riAny.boletim && !!riAny.cutLine;
  const lows = DIMS.filter((d) => !ri.pattern[d]);

  let driver: RealProgression['driver'] = null;
  if (!atTop && lows.length) {
    if (isV2 && riAny.boletim && riAny.cutLine) {
      // menor gap (cutLine - boletim) = mais perto de "alto".
      const ranked = lows
        .map((d) => ({ d, gap: Math.max(0, Math.round(riAny.cutLine![d] - riAny.boletim![d])) }))
        .sort((a, b) => a.gap - b.gap);
      driver = { dim: ranked[0].d, label: DIM_LABEL[ranked[0].d], gap: ranked[0].gap };
    } else {
      // v1: baixo = z < 0; o mais perto é o de MAIOR z (mais próximo de 0).
      const dz = riAny.dimensions || ({} as Record<RealDim, number>);
      const ranked = lows
        .map((d) => ({ d, z: typeof dz[d] === 'number' ? dz[d] : -99 }))
        .sort((a, b) => b.z - a.z);
      driver = { dim: ranked[0].d, label: DIM_LABEL[ranked[0].d], gap: null };
    }
  }

  return { altas, tier, nextTier, atTop, driver };
}
