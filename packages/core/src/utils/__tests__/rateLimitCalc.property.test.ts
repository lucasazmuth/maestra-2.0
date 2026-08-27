/**
 * Property-Based Tests for Rate Limit Calculation Functions
 * Feature: artist-creation-rate-limit, Property 6: Cálculo determinístico do cooldown
 *
 * **Validates: Requirements 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 4.3**
 *
 * Property statement:
 * "Para qualquer contagem de exclusões D nos últimos 30 dias e qualquer last_created_at,
 *  o cooldown aplicável deve ser: 0 se D=0, 600s se D=1, 86400s se 2≤D≤4, 604800s se D≥5.
 *  O tempo restante deve ser max(0, cooldown - (now - last_created_at))."
 */

import * as fc from 'fast-check';
import { computeCooldown, computeRemainingSeconds } from '../rateLimitCalc';

describe('Feature: artist-creation-rate-limit, Property 6: Cálculo determinístico do cooldown', () => {
  describe('computeCooldown — deterministic mapping from deletion count to cooldown', () => {
    it('for ANY non-negative integer D, computeCooldown(D) returns exactly one of {0, 600, 86400, 604800}', () => {
      fc.assert(
        fc.property(
          fc.nat(), // non-negative integer
          (deletionCount) => {
            const result = computeCooldown(deletionCount);
            expect([0, 600, 86400, 604800]).toContain(result);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('D=0 → cooldown is 0', () => {
      fc.assert(
        fc.property(
          fc.constant(0),
          (d) => {
            expect(computeCooldown(d)).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('D=1 → cooldown is 600s', () => {
      fc.assert(
        fc.property(
          fc.constant(1),
          (d) => {
            expect(computeCooldown(d)).toBe(600);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('2≤D≤4 → cooldown is 86400s', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 4 }),
          (d) => {
            expect(computeCooldown(d)).toBe(86400);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('D≥5 → cooldown is 604800s', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 5, max: 10000 }),
          (d) => {
            expect(computeCooldown(d)).toBe(604800);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('computeCooldown is monotonically non-decreasing (more deletions → same or higher cooldown)', () => {
      fc.assert(
        fc.property(
          fc.nat(10000),
          fc.nat(10000),
          (a, b) => {
            const lower = Math.min(a, b);
            const higher = Math.max(a, b);
            expect(computeCooldown(higher)).toBeGreaterThanOrEqual(computeCooldown(lower));
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('computeRemainingSeconds — deterministic remaining time calculation', () => {
    it('for ANY valid lastCreatedAt and now (now >= lastCreatedAt), remaining equals max(0, cooldown - floor((now - lastCreatedAt) / 1000))', () => {
      fc.assert(
        fc.property(
          // Generate a base timestamp (within a reasonable range)
          fc.integer({ min: 0, max: 2_000_000_000_000 }),
          // Generate elapsed milliseconds (0 to ~35 days in ms)
          fc.nat(3_024_000_000),
          // Generate a cooldown from the valid set
          fc.constantFrom(0, 600, 86400, 604800),
          (baseMs, elapsedMs, cooldownSeconds) => {
            const lastCreatedAt = new Date(baseMs);
            const now = new Date(baseMs + elapsedMs);

            const result = computeRemainingSeconds(lastCreatedAt, cooldownSeconds, now);
            const elapsedSeconds = Math.floor(elapsedMs / 1000);
            const expected = Math.max(0, cooldownSeconds - elapsedSeconds);

            expect(result).toBe(expected);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('result is always >= 0', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2_000_000_000_000 }),
          fc.nat(3_024_000_000),
          fc.constantFrom(0, 600, 86400, 604800),
          (baseMs, elapsedMs, cooldownSeconds) => {
            const lastCreatedAt = new Date(baseMs);
            const now = new Date(baseMs + elapsedMs);

            const result = computeRemainingSeconds(lastCreatedAt, cooldownSeconds, now);
            expect(result).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('when cooldownSeconds is 0, remaining is always 0 regardless of dates', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 0, max: 2_000_000_000_000 }),
          fc.nat(3_024_000_000),
          (baseMs, elapsedMs) => {
            const lastCreatedAt = new Date(baseMs);
            const now = new Date(baseMs + elapsedMs);

            const result = computeRemainingSeconds(lastCreatedAt, 0, now);
            expect(result).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
