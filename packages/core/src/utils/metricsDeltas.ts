/**
 * Cálculo de deltas de métricas entre snapshots.
 *
 * Funções puras extraídas para possibilitar testes unitários e property-based
 * tests independentemente da Edge Function collect-metrics.
 */

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DeltaEntry {
  abs: number;
  pct: number;
}

export interface MetricValues {
  monthly_listeners: number | null;
  followers: number | null;
  popularity: number | null;
  track_count: number | null;
}

export interface SnapshotDeltasResult {
  deltas: Record<string, DeltaEntry> | null;
  period_days: number | null;
}

// ─── Pure Functions ───────────────────────────────────────────────────────────

/**
 * Calcula deltas entre o snapshot atual e o anterior.
 * Para cada métrica numérica presente em ambos (não-nula) e com prev !== 0:
 *   abs = curr - prev
 *   pct = ((curr - prev) / prev) * 100, arredondado a 2 casas decimais
 *
 * Retorna null se nenhuma métrica tem delta calculável.
 */
export function calculateDeltas(
  current: MetricValues,
  previous: MetricValues
): Record<string, DeltaEntry> | null {
  const metrics: Array<{ key: string; curr: number | null; prev: number | null }> = [
    { key: "monthly_listeners", curr: current.monthly_listeners, prev: previous.monthly_listeners },
    { key: "followers", curr: current.followers, prev: previous.followers },
    { key: "popularity", curr: current.popularity, prev: previous.popularity },
    { key: "track_count", curr: current.track_count, prev: previous.track_count },
  ];

  const deltas: Record<string, DeltaEntry> = {};
  let hasAny = false;

  for (const { key, curr, prev } of metrics) {
    if (curr != null && prev != null && prev !== 0) {
      deltas[key] = {
        abs: curr - prev,
        pct: Math.round(((curr - prev) / prev) * 100 * 100) / 100,
      };
      hasAny = true;
    }
  }

  return hasAny ? deltas : null;
}

/**
 * Calcula o número de dias entre duas datas.
 */
export function daysBetween(date1: string | Date, date2: string | Date): number {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  return Math.round(Math.abs(d2.getTime() - d1.getTime()) / (24 * 60 * 60 * 1000));
}

/**
 * Determina deltas e period_days para um snapshot dado o anterior (ou null).
 *
 * - Se previousSnapshot é null (primeiro snapshot): retorna { deltas: null, period_days: null }
 * - Se previousSnapshot existe: calcula deltas e period_days
 */
export function computeSnapshotDeltas(
  current: MetricValues,
  currentCollectedAt: string | Date,
  previous: { metrics: MetricValues; collected_at: string | Date } | null
): SnapshotDeltasResult {
  if (!previous) {
    return { deltas: null, period_days: null };
  }

  const deltas = calculateDeltas(current, previous.metrics);
  const periodDays = daysBetween(previous.collected_at, currentCollectedAt);

  return { deltas, period_days: periodDays };
}
