/**
 * Property-Based Tests for Metrics Delta Calculation
 * Feature: maestra-pro-banner-and-benefits
 *
 * Tests the calculateDeltas and computeSnapshotDeltas pure functions using fast-check.
 */

import * as fc from 'fast-check';
import {
  calculateDeltas,
  computeSnapshotDeltas,
  MetricValues,
} from '../metricsDeltas';

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generator for non-null metric values (positive integers representing real metrics).
 * Avoids 0 for 'previous' values to allow percentage calculation.
 */
const nonZeroMetricValue = fc.integer({ min: 1, max: 10_000_000 });

/**
 * Generator for arbitrary metric values (can be null or a positive integer).
 */
const metricValue = fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 10_000_000 }));

/**
 * Generator for MetricValues where all metrics are non-null and prev > 0.
 * Used for Property 5 to ensure we always have valid deltas to calculate.
 */
const nonNullMetricValues = (minVal: number = 1): fc.Arbitrary<MetricValues> =>
  fc.record({
    monthly_listeners: fc.integer({ min: minVal, max: 10_000_000 }),
    followers: fc.integer({ min: minVal, max: 10_000_000 }),
    popularity: fc.integer({ min: minVal, max: 100 }),
    track_count: fc.integer({ min: minVal, max: 10_000 }),
  });

/**
 * Generator for arbitrary MetricValues (some or all metrics may be null).
 */
const arbitraryMetricValues: fc.Arbitrary<MetricValues> = fc.record({
  monthly_listeners: metricValue,
  followers: metricValue,
  popularity: fc.oneof(fc.constant(null), fc.integer({ min: 0, max: 100 })),
  track_count: metricValue,
});

// ─── Property 5 ───────────────────────────────────────────────────────────────

/**
 * Property 5: Cálculo de deltas de métricas — integridade
 *
 * Para quaisquer dois snapshots consecutivos (prev, curr) do mesmo artista,
 * o campo deltas do snapshot curr SHALL conter, para cada métrica presente em ambos,
 * abs = curr.value - prev.value e pct = ((curr.value - prev.value) / prev.value) * 100
 * (arredondado a 2 casas decimais).
 *
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 5: Cálculo de deltas integridade', () => {
  test('abs = curr - prev and pct = ((curr - prev) / prev) * 100 rounded to 2 decimal places', () => {
    fc.assert(
      fc.property(
        // Generate previous metrics with non-zero values (so pct is calculable)
        nonNullMetricValues(1),
        // Generate current metrics with non-null values
        nonNullMetricValues(0),
        (prev, curr) => {
          const deltas = calculateDeltas(curr, prev);

          // Since both curr and prev have non-null values and prev > 0,
          // deltas should never be null
          expect(deltas).not.toBeNull();

          if (deltas) {
            const metricKeys = ['monthly_listeners', 'followers', 'popularity', 'track_count'] as const;

            for (const key of metricKeys) {
              const currVal = curr[key]!;
              const prevVal = prev[key]!;

              // Skip if prev is 0 (function doesn't calculate delta for prev === 0)
              if (prevVal === 0) continue;

              expect(deltas[key]).toBeDefined();

              // Verify abs = curr - prev
              expect(deltas[key].abs).toBe(currVal - prevVal);

              // Verify pct = ((curr - prev) / prev) * 100 rounded to 2 decimal places
              const expectedPct = Math.round(((currVal - prevVal) / prevVal) * 100 * 100) / 100;
              expect(deltas[key].pct).toBe(expectedPct);
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when prev value is 0 for a metric, that metric delta is not calculated', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 10_000_000 }),
        (currListeners) => {
          const prev: MetricValues = {
            monthly_listeners: 0,
            followers: 100,
            popularity: 50,
            track_count: 10,
          };
          const curr: MetricValues = {
            monthly_listeners: currListeners,
            followers: 150,
            popularity: 60,
            track_count: 12,
          };

          const deltas = calculateDeltas(curr, prev);

          // monthly_listeners should NOT be in deltas (prev === 0)
          if (deltas) {
            expect(deltas['monthly_listeners']).toBeUndefined();
            // But other metrics should have deltas
            expect(deltas['followers']).toBeDefined();
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when any metric is null in either snapshot, that metric delta is not calculated', () => {
    fc.assert(
      fc.property(
        arbitraryMetricValues,
        arbitraryMetricValues,
        (prev, curr) => {
          const deltas = calculateDeltas(curr, prev);

          const metricKeys = ['monthly_listeners', 'followers', 'popularity', 'track_count'] as const;

          for (const key of metricKeys) {
            const currVal = curr[key];
            const prevVal = prev[key];

            if (currVal == null || prevVal == null || prevVal === 0) {
              // This metric should NOT appear in deltas
              if (deltas) {
                expect(deltas[key]).toBeUndefined();
              }
            } else {
              // This metric SHOULD appear in deltas (if deltas is not null)
              if (deltas) {
                expect(deltas[key]).toBeDefined();
                expect(deltas[key].abs).toBe(currVal - prevVal);
                const expectedPct = Math.round(((currVal - prevVal) / prevVal) * 100 * 100) / 100;
                expect(deltas[key].pct).toBe(expectedPct);
              }
            }
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 6 ───────────────────────────────────────────────────────────────

/**
 * Property 6: Primeiro snapshot sem deltas
 *
 * Para qualquer artista cujo primeiro snapshot é coletado, o campo deltas
 * SHALL ser null e period_days SHALL ser null.
 *
 * **Validates: Requirements 5.3, 5.4, 5.5**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 6: Primeiro snapshot sem deltas', () => {
  test('computeSnapshotDeltas returns deltas === null and period_days === null when no previous snapshot exists', () => {
    fc.assert(
      fc.property(
        arbitraryMetricValues,
        // Generate arbitrary collected_at dates
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map((d) => d.toISOString()),
        (currentMetrics, collectedAt) => {
          const result = computeSnapshotDeltas(currentMetrics, collectedAt, null);

          // First snapshot: deltas must be null
          expect(result.deltas).toBeNull();

          // First snapshot: period_days must be null
          expect(result.period_days).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('first snapshot returns nulls regardless of metric values (including all zeros or all non-null)', () => {
    fc.assert(
      fc.property(
        nonNullMetricValues(0),
        fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map((d) => d.toISOString()),
        (currentMetrics, collectedAt) => {
          // Even with perfectly valid metric values, the first snapshot has no deltas
          const result = computeSnapshotDeltas(currentMetrics, collectedAt, null);

          expect(result.deltas).toBeNull();
          expect(result.period_days).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('computeSnapshotDeltas returns non-null deltas and period_days when previous snapshot exists with valid data', () => {
    fc.assert(
      fc.property(
        // Generate previous metrics with non-zero values
        nonNullMetricValues(1),
        // Generate current metrics with non-null values
        nonNullMetricValues(0),
        // Generate two dates (previous before current)
        fc.date({ min: new Date('2020-01-01'), max: new Date('2025-06-01') }),
        fc.integer({ min: 1, max: 90 }),
        (prevMetrics, currMetrics, prevDate, daysDiff) => {
          const prevCollectedAt = prevDate.toISOString();
          const currDate = new Date(prevDate.getTime() + daysDiff * 24 * 60 * 60 * 1000);
          const currCollectedAt = currDate.toISOString();

          const result = computeSnapshotDeltas(
            currMetrics,
            currCollectedAt,
            { metrics: prevMetrics, collected_at: prevCollectedAt }
          );

          // With a valid previous snapshot, deltas should be calculated
          expect(result.deltas).not.toBeNull();

          // period_days should be approximately the days difference
          expect(result.period_days).not.toBeNull();
          expect(result.period_days).toBeGreaterThanOrEqual(0);
        }
      ),
      { numRuns: 100 }
    );
  });
});
