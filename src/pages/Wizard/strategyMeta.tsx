import { ReactNode } from 'react';
import { FiShield, FiTrendingUp, FiAlertTriangle } from 'react-icons/fi';
import { LuRocket } from 'react-icons/lu';

import type { StrategyType } from '../../interfaces/maestra';

// Metadados visuais dos tipos de estratégia (cruzamentos SWOT), compartilhados entre
// Estratégias, Priorização, Cronograma e Resultado.

export interface StrategyMeta {
  label: string;
  short: string;
  color: string;
  icon: ReactNode;
}

export const STRATEGY_META: Record<StrategyType, StrategyMeta> = {
  SO: {
    label: 'Ataque — Forças + Oportunidades',
    short: 'Ataque',
    color: '#af2896',
    icon: <LuRocket />,
  },
  ST: {
    label: 'Defesa — Forças + Ameaças',
    short: 'Defesa',
    color: '#f59e0b',
    icon: <FiShield />,
  },
  WO: {
    label: 'Reforço — Fraquezas + Oportunidades',
    short: 'Reforço',
    color: '#3b82f6',
    icon: <FiTrendingUp />,
  },
  WT: {
    label: 'Sobrevivência — Fraquezas + Ameaças',
    short: 'Sobrevivência',
    color: '#e91429',
    icon: <FiAlertTriangle />,
  },
};

export const strategyMeta = (type?: string): StrategyMeta =>
  STRATEGY_META[(type as StrategyType) || 'SO'] || STRATEGY_META.SO;

// Legenda compacta dos 4 tipos de cruzamento — exibida onde aparecem siglas SO/ST/WO/WT
// para que o usuário leigo entenda o significado sem decorar.
export const StrategyLegend = () => (
  <div
    style={{
      display: 'flex',
      flexWrap: 'wrap',
      gap: 10,
      marginBottom: 12,
      fontSize: 11,
      color: '#b3b3b3',
    }}
  >
    {(Object.keys(STRATEGY_META) as StrategyType[]).map((t) => {
      const m = STRATEGY_META[t];
      return (
        <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: m.color }} />
          <strong style={{ color: '#fff' }}>{t}</strong> {m.short}
        </span>
      );
    })}
  </div>
);

// Ícone do tipo dentro de um círculo translúcido na cor da estratégia.
export const StrategyTypeIcon = ({ type, size = 32 }: { type?: string; size?: number }) => {
  const meta = strategyMeta(type);
  return (
    <span
      className='wiz-strategy-type-icon'
      style={{
        width: size,
        height: size,
        minWidth: size,
        background: `${meta.color}22`,
        color: meta.color,
        fontSize: size * 0.55,
      }}
    >
      {meta.icon}
    </span>
  );
};
