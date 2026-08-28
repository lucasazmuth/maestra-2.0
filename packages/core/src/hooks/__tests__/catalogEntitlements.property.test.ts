/**
 * Property-Based Tests for Catalog Limit & Entitlements Derivation
 * Feature: maestra-pro-banner-and-benefits
 *
 * Tests deriveCanAddTrack and deriveEntitlements pure functions using fast-check.
 *
 * Property 4: Limite de catálogo aplicado corretamente
 * Property 3: Derivação de entitlements é determinística e consistente
 */

import * as fc from 'fast-check';
import { deriveCanAddTrack } from '../useCanAddTrack';
import { deriveEntitlements, FREE_MAX_CATALOG_TRACKS } from '../useEntitlements';
import type { SubscriptionState } from '../../store/slices/subscription';

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generator for valid subscription statuses.
 */
const subscriptionStatusArb: fc.Arbitrary<SubscriptionState['status']> = fc.constantFrom(
  'active',
  'overdue',
  'cancelled',
  'pending',
  'none'
);

/**
 * Generator for gracePeriodEndsAt (null or ISO date string).
 */
const gracePeriodArb: fc.Arbitrary<string | null> = fc.oneof(
  fc.constant(null),
  fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map((d) => d.toISOString())
);

/**
 * Generator for "now" timestamps (valid Date range).
 */
const nowArb: fc.Arbitrary<number> = fc.date({
  min: new Date('2020-01-01'),
  max: new Date('2030-12-31'),
}).map((d) => d.getTime());

// ─── Property 4 ───────────────────────────────────────────────────────────────

/**
 * Property 4: Limite de catálogo aplicado corretamente
 *
 * Para qualquer perfil com n faixas ativas, se a conta não é PRO e n >= 10,
 * uma tentativa de adição SHALL ser rejeitada e o total de faixas ativas
 * SHALL permanecer n.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 4: Limite de catálogo aplicado corretamente', () => {
  test('addition is rejected when !isPro && n >= 10', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary track counts (0..1000)
        fc.nat(1000),
        // Generate isPro boolean
        fc.boolean(),
        (n, isPro) => {
          const maxCatalogTracks = isPro ? Infinity : FREE_MAX_CATALOG_TRACKS;
          const result = deriveCanAddTrack(n, maxCatalogTracks);

          if (!isPro && n >= 10) {
            // Non-PRO with 10 or more active tracks: addition must be rejected
            expect(result.canAdd).toBe(false);
            expect(result.shouldShowUpsell).toBe(true);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('PRO accounts can always add tracks regardless of count', () => {
    fc.assert(
      fc.property(
        // Generate large track counts to stress test PRO unlimited
        fc.nat(10000),
        (n) => {
          const maxCatalogTracks = Infinity; // PRO
          const result = deriveCanAddTrack(n, maxCatalogTracks);

          // PRO accounts should never be blocked
          expect(result.canAdd).toBe(true);
          expect(result.shouldShowUpsell).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('non-PRO accounts with fewer than 10 tracks can add', () => {
    fc.assert(
      fc.property(
        // Generate track counts strictly below 10
        fc.integer({ min: 0, max: 9 }),
        (n) => {
          const maxCatalogTracks = FREE_MAX_CATALOG_TRACKS; // non-PRO
          const result = deriveCanAddTrack(n, maxCatalogTracks);

          // Below limit: addition is allowed
          expect(result.canAdd).toBe(true);
          expect(result.shouldShowUpsell).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('track count is never mutated by the gate function', () => {
    fc.assert(
      fc.property(
        fc.nat(1000),
        fc.boolean(),
        (n, isPro) => {
          const maxCatalogTracks = isPro ? Infinity : FREE_MAX_CATALOG_TRACKS;
          const result = deriveCanAddTrack(n, maxCatalogTracks);

          // The function must preserve the original count (no side-effect)
          expect(result.currentCount).toBe(n);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 3 ───────────────────────────────────────────────────────────────

/**
 * Property 3: Derivação de entitlements é determinística e consistente
 *
 * Para qualquer estado de assinatura (status, gracePeriodEndsAt, now), a função
 * deriveEntitlements SHALL retornar o mesmo resultado dado os mesmos inputs,
 * e isPro === true implica maxCatalogTracks === Infinity.
 *
 * **Validates: Requirements 4.1, 4.2, 4.3**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 3: Derivação de entitlements determinística e consistente', () => {
  test('same inputs always produce same output (determinism)', () => {
    fc.assert(
      fc.property(
        subscriptionStatusArb,
        gracePeriodArb,
        nowArb,
        (status, gracePeriodEndsAt, now) => {
          const result1 = deriveEntitlements(status, gracePeriodEndsAt, now);
          const result2 = deriveEntitlements(status, gracePeriodEndsAt, now);

          // Determinism: identical inputs produce identical outputs
          expect(result1.plan).toBe(result2.plan);
          expect(result1.isPro).toBe(result2.isPro);
          expect(result1.maxCatalogTracks).toBe(result2.maxCatalogTracks);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isPro === true implies maxCatalogTracks === Infinity', () => {
    fc.assert(
      fc.property(
        subscriptionStatusArb,
        gracePeriodArb,
        nowArb,
        (status, gracePeriodEndsAt, now) => {
          const result = deriveEntitlements(status, gracePeriodEndsAt, now);

          if (result.isPro) {
            expect(result.maxCatalogTracks).toBe(Infinity);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('isPro === false implies maxCatalogTracks === 10', () => {
    fc.assert(
      fc.property(
        subscriptionStatusArb,
        gracePeriodArb,
        nowArb,
        (status, gracePeriodEndsAt, now) => {
          const result = deriveEntitlements(status, gracePeriodEndsAt, now);

          if (!result.isPro) {
            expect(result.maxCatalogTracks).toBe(FREE_MAX_CATALOG_TRACKS);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  test('plan is always consistent with isPro flag', () => {
    fc.assert(
      fc.property(
        subscriptionStatusArb,
        gracePeriodArb,
        nowArb,
        (status, gracePeriodEndsAt, now) => {
          const result = deriveEntitlements(status, gracePeriodEndsAt, now);

          if (result.isPro) {
            expect(result.plan).toBe('pro');
          } else {
            expect(result.plan).toBe('free');
          }
        }
      ),
      { numRuns: 100 }
    );
  });
});
