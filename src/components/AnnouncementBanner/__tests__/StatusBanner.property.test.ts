/**
 * Property-Based Tests for StatusBanner (useStatusBanner / deriveStatusBanner)
 * Feature: maestra-pro-banner-and-benefits
 *
 * Tests the deriveStatusBanner pure function using fast-check.
 */

import * as fc from 'fast-check';
import { deriveStatusBanner, DeriveStatusBannerInput } from '../index';

/**
 * Property 1: Banner PRO nunca aparece para assinantes ativos
 *
 * Para qualquer estado de assinatura onde status === 'active', a função
 * deriveStatusBanner() SHALL retornar null, independente do pathname,
 * gracePeriodEndsAt, ou qualquer outro parâmetro.
 *
 * **Validates: Requirements 1.3, 2.4**
 */
describe('Feature: maestra-pro-banner-and-benefits, Property 1: Banner PRO nunca aparece para assinantes ativos', () => {
  test('deriveStatusBanner returns null for any subscription state with status === active', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary pathnames (including /artists and other routes)
        fc.oneof(
          fc.constant('/artists'),
          fc.constant('/'),
          fc.constant('/dashboard'),
          fc.constant('/artists/123/dashboard'),
          fc.constant('/catalogo'),
          fc.constant('/agenda'),
          fc.constant('/equipe'),
          fc.constant('/configuracoes'),
          fc.webUrl().map((url) => new URL(url).pathname)
        ),
        // Generate arbitrary gracePeriodEndsAt (null or ISO date string)
        fc.oneof(
          fc.constant(null),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map((d) => d.toISOString())
        ),
        // Generate arbitrary initialized states (both true and false)
        fc.boolean(),
        // Generate arbitrary paywallDisabled states
        fc.boolean(),
        (pathname, gracePeriodEndsAt, initialized, paywallDisabled) => {
          const input: DeriveStatusBannerInput = {
            status: 'active',
            initialized,
            gracePeriodEndsAt,
            hasSubscriptionId: true,
            pathname,
            paywallDisabled,
          };

          const result = deriveStatusBanner(input);

          // When status is 'active', the banner must NEVER appear.
          // The function should return null regardless of other inputs.
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deriveStatusBanner returns null for active status with various timestamps', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary "now" timestamps
        fc.integer({ min: 0, max: 2000000000000 }),
        // Generate pathnames that are NOT /assinatura or /pagamento
        fc.stringMatching(/^\/[a-z0-9\-/]{0,50}$/).filter(
          (p) => !p.startsWith('/assinatura') && !p.startsWith('/pagamento')
        ),
        // Generate gracePeriodEndsAt as ISO strings or null
        fc.oneof(
          fc.constant(null),
          fc.date({ min: new Date('2020-01-01'), max: new Date('2030-12-31') }).map((d) => d.toISOString())
        ),
        (now, pathname, gracePeriodEndsAt) => {
          const input: DeriveStatusBannerInput = {
            status: 'active',
            initialized: true,
            gracePeriodEndsAt,
            hasSubscriptionId: true,
            pathname: pathname || '/',
            paywallDisabled: false,
            now,
          };

          const result = deriveStatusBanner(input);

          // Active subscription means no banner ever
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

/**
 * Regressão: pagamento ÚNICO do perfil não pode parecer "assinatura Pro pendente".
 *
 * A linha em asaas_subscriptions criada pelo pagamento único (só com customer_id) tem
 * status='pending' por default, mas SEM asaas_subscription_id. Nesse caso o banner de
 * "Pagamento em análise" (kind 'pending') NÃO deve aparecer.
 */
describe('Regressão: pending sem asaas_subscription_id não vira banner pending', () => {
  test('status pending + hasSubscriptionId=false nunca retorna "pending"', () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^\/[a-z0-9\-/]{0,40}$/).filter(
          (p) => !p.startsWith('/assinatura') && !p.startsWith('/pagamento')
        ),
        (pathname) => {
          const result = deriveStatusBanner({
            status: 'pending',
            initialized: true,
            gracePeriodEndsAt: null,
            hasSubscriptionId: false,
            pathname: pathname || '/',
            paywallDisabled: false,
          });
          expect(result).not.toBe('pending');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('status pending + hasSubscriptionId=true retorna "pending" (assinatura real)', () => {
    const result = deriveStatusBanner({
      status: 'pending',
      initialized: true,
      gracePeriodEndsAt: null,
      hasSubscriptionId: true,
      pathname: '/artists/123/wizard',
      paywallDisabled: false,
    });
    expect(result).toBe('pending');
  });
});
