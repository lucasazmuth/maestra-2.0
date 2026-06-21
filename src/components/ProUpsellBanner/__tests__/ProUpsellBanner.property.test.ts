/**
 * Property-Based Tests for ProUpsellBanner visibility
 * Feature: maestra-pro-banner-and-benefits
 *
 * Tests the shouldShowProUpsellBanner pure function using fast-check.
 */

import * as fc from 'fast-check';
import { shouldShowProUpsellBanner, ProUpsellVisibilityInput } from '../index';

/**
 * Property 2: Banner de upsell no Dashboard — visibilidade condicional
 *
 * Para qualquer combinação de (isPaid, isPro), o ProUpsellBanner SHALL ser
 * renderizado se e somente se isPaid === true && isPro === false.
 *
 * **Validates: Requirements 2.1, 2.4, 2.5**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 2: Banner upsell visibilidade condicional', () => {
  test('shouldShowProUpsellBanner returns true if and only if isPaid === true && isPro === false', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary boolean combinations of (isPaid, isPro)
        fc.boolean(),
        fc.boolean(),
        (isPaid, isPro) => {
          const input: ProUpsellVisibilityInput = { isPaid, isPro };
          const result = shouldShowProUpsellBanner(input);

          // The banner must be visible if and only if isPaid && !isPro
          const expected = isPaid === true && isPro === false;
          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('banner is never shown when isPro is true, regardless of isPaid', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isPaid) => {
          const input: ProUpsellVisibilityInput = { isPaid, isPro: true };
          const result = shouldShowProUpsellBanner(input);

          // Requirement 2.4: PRO accounts must NEVER see the upsell banner
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('banner is never shown when isPaid is false, regardless of isPro', () => {
    fc.assert(
      fc.property(
        fc.boolean(),
        (isPro) => {
          const input: ProUpsellVisibilityInput = { isPaid: false, isPro };
          const result = shouldShowProUpsellBanner(input);

          // Requirement 2.5: non-paid profiles must NEVER see the upsell banner
          expect(result).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});
