import { FC, useEffect, useState } from 'react';
import { FiTrendingUp, FiTrendingDown } from 'react-icons/fi';

import { supabase } from '../../lib/supabase';
import type { MetricsSnapshot } from '../../interfaces/maestra';

export interface MetricsEvolutionProps {
  artistId: string;
  // Oculta o rótulo interno "Evolução de métricas" quando o card já está sob um cabeçalho de seção.
  hideLabel?: boolean;
}

/** Métricas numéricas que exibimos no painel de evolução. */
const METRIC_LABELS: Record<string, string> = {
  monthly_listeners: 'Ouvintes mensais',
  followers: 'Seguidores',
  popularity: 'Popularidade',
  track_count: 'Faixas',
};

/**
 * MetricsEvolution — exibe a variação (delta) entre os 2 últimos snapshots de métricas
 * de um artista. Indicadores visuais ↑ (verde) / ↓ (vermelho), variação absoluta e percentual.
 * Estado vazio: "Sem dados de evolução disponíveis".
 */
export const MetricsEvolution: FC<MetricsEvolutionProps> = ({ artistId, hideLabel }) => {
  const [loading, setLoading] = useState(true);
  const [snapshots, setSnapshots] = useState<MetricsSnapshot[]>([]);

  useEffect(() => {
    let cancelled = false;

    const fetchSnapshots = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase
          .from('artist_metrics_snapshots')
          .select('*')
          .eq('artist_id', artistId)
          .order('collected_at', { ascending: false })
          .limit(2);

        if (!cancelled) {
          if (error) {
            console.error('[MetricsEvolution] fetch error:', error.message);
            setSnapshots([]);
          } else {
            setSnapshots((data as MetricsSnapshot[]) || []);
          }
        }
      } catch (err) {
        if (!cancelled) setSnapshots([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchSnapshots();
    return () => { cancelled = true; };
  }, [artistId]);

  // Estado de carregamento
  if (loading) return null;

  // Precisamos de pelo menos 2 snapshots para calcular evolução
  if (snapshots.length < 2) {
    return (
      <section
        style={{
          background: '#181818',
          borderRadius: 14,
          padding: 20,
          marginBottom: 24,
          border: '1px solid #282828',
        }}
      >
        {!hideLabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#b3b3b3',
            }}
          >
            Evolução de métricas
          </span>
        )}
        <p style={{ color: '#8a8a92', fontSize: 14, margin: hideLabel ? 0 : '12px 0 0' }}>
          Sem dados de evolução disponíveis
        </p>
      </section>
    );
  }

  const [current, previous] = snapshots;
  const periodDays = current.period_days ?? calcPeriodDays(current.collected_at, previous.collected_at);

  // Calcula deltas a partir dos dados pré-calculados do snapshot ou computa manualmente
  const deltas = current.deltas ?? computeDeltas(current, previous);

  return (
    <section
      style={{
        position: 'relative',
        background: 'radial-gradient(120% 130% at 100% 0%, rgba(175, 40, 150,0.06), #181818 60%)',
        border: '1px solid rgba(175, 40, 150,0.15)',
        borderRadius: 14,
        padding: 20,
        marginBottom: 24,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: hideLabel ? 'flex-end' : 'space-between', marginBottom: 16 }}>
        {!hideLabel && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: '#af2896',
            }}
          >
            Evolução de métricas
          </span>
        )}
        {periodDays != null && (
          <span style={{ fontSize: 12, color: '#8a8a92' }}>
            Últimos {periodDays} dias
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
          gap: 12,
        }}
      >
        {Object.entries(METRIC_LABELS).map(([key, label]) => {
          const delta = deltas?.[key];
          if (!delta) return null;

          const isPositive = delta.abs > 0;
          const isNeutral = delta.abs === 0;
          const color = isNeutral ? '#8a8a92' : isPositive ? '#af2896' : '#f44336';
          const arrow = isNeutral ? '—' : isPositive ? '↑' : '↓';
          const Icon = isPositive ? FiTrendingUp : FiTrendingDown;

          return (
            <div
              key={key}
              style={{
                background: 'rgba(255,255,255,0.03)',
                borderRadius: 10,
                padding: '14px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
              }}
            >
              <span style={{ fontSize: 12, color: '#8a8a92', fontWeight: 600 }}>{label}</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                {!isNeutral && <Icon size={16} color={color} />}
                <span style={{ fontSize: 18, fontWeight: 800, color }}>
                  {arrow} {formatAbsolute(delta.abs)}
                </span>
              </div>
              <span style={{ fontSize: 12, color, opacity: 0.85 }}>
                {isNeutral ? '0%' : `${delta.pct > 0 ? '+' : ''}${delta.pct.toFixed(2)}%`}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
};

/** Calcula dias entre duas datas ISO. */
function calcPeriodDays(currentDate: string, previousDate: string): number {
  const diff = new Date(currentDate).getTime() - new Date(previousDate).getTime();
  return Math.round(diff / (1000 * 60 * 60 * 24));
}

/** Computa deltas manualmente caso o campo `deltas` do snapshot não esteja preenchido. */
function computeDeltas(
  current: MetricsSnapshot,
  previous: MetricsSnapshot
): Record<string, { abs: number; pct: number }> {
  const result: Record<string, { abs: number; pct: number }> = {};
  const keys: (keyof MetricsSnapshot)[] = ['monthly_listeners', 'followers', 'popularity', 'track_count'];

  for (const key of keys) {
    const curr = current[key] as number | null;
    const prev = previous[key] as number | null;
    if (curr != null && prev != null) {
      const abs = curr - prev;
      const pct = prev !== 0 ? ((curr - prev) / prev) * 100 : 0;
      result[key] = { abs, pct: Math.round(pct * 100) / 100 };
    }
  }

  return result;
}

/** Formata valor absoluto com separador de milhar (pt-BR). */
function formatAbsolute(value: number): string {
  const abs = Math.abs(value);
  return abs.toLocaleString('pt-BR');
}

export default MetricsEvolution;
