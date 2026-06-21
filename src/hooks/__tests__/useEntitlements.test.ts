/**
 * Unit Tests for deriveEntitlements
 * Feature: asaas-payment-e2e, Task 8.1
 *
 * Verifies the entitlements derivation logic:
 * - plan: 'pro' when PAYWALL_DISABLED, status 'active', or overdue within grace period
 * - plan: 'free' for all other cases
 * - When pro: all feature flags true, limits Infinity
 *
 * Validates: Requirements 6.6, 10.2
 */

// We test the pure function directly, which relies on the PAYWALL_DISABLED import.
// We'll mock the module for PAYWALL_DISABLED scenarios.

import { deriveEntitlements } from '../useEntitlements';

// By default, PAYWALL_DISABLED is false in test environment.
// We test PAYWALL_DISABLED=true scenarios in a separate describe block with module mock.

describe('deriveEntitlements (PAYWALL_DISABLED = false)', () => {
  const FIXED_NOW = new Date('2025-01-15T12:00:00Z').getTime();

  describe('plan: pro cases', () => {
    test('status active → pro', () => {
      const result = deriveEntitlements('active', null, FIXED_NOW);
      expect(result.plan).toBe('pro');
    });

    test('status overdue with gracePeriodEndsAt in the future → pro', () => {
      const futureGrace = '2025-01-20T12:00:00Z'; // 5 days after now
      const result = deriveEntitlements('overdue', futureGrace, FIXED_NOW);
      expect(result.plan).toBe('pro');
    });

    test('status overdue with gracePeriodEndsAt exactly at now → pro (boundary)', () => {
      const exactlyNow = new Date(FIXED_NOW).toISOString();
      const result = deriveEntitlements('overdue', exactlyNow, FIXED_NOW);
      expect(result.plan).toBe('pro');
    });
  });

  describe('plan: free cases', () => {
    test('status none → free', () => {
      const result = deriveEntitlements('none', null, FIXED_NOW);
      expect(result.plan).toBe('free');
    });

    test('status cancelled → free', () => {
      const result = deriveEntitlements('cancelled', null, FIXED_NOW);
      expect(result.plan).toBe('free');
    });

    test('status pending → free', () => {
      const result = deriveEntitlements('pending', null, FIXED_NOW);
      expect(result.plan).toBe('free');
    });

    test('status overdue with gracePeriodEndsAt in the past → free', () => {
      const pastGrace = '2025-01-10T12:00:00Z'; // 5 days before now
      const result = deriveEntitlements('overdue', pastGrace, FIXED_NOW);
      expect(result.plan).toBe('free');
    });

    test('status overdue with gracePeriodEndsAt null → free', () => {
      const result = deriveEntitlements('overdue', null, FIXED_NOW);
      expect(result.plan).toBe('free');
    });
  });

  describe('pro entitlements: isPro true, catálogo ilimitado', () => {
    test('active status gives full pro entitlements', () => {
      const result = deriveEntitlements('active', null, FIXED_NOW);
      expect(result.plan).toBe('pro');
      expect(result.isPro).toBe(true);
      expect(result.maxCatalogTracks).toBe(Infinity);
    });

    test('overdue within grace gives full pro entitlements', () => {
      const futureGrace = '2025-01-20T12:00:00Z';
      const result = deriveEntitlements('overdue', futureGrace, FIXED_NOW);
      expect(result.plan).toBe('pro');
      expect(result.isPro).toBe(true);
      expect(result.maxCatalogTracks).toBe(Infinity);
    });
  });

  describe('free entitlements: sem PRO, catálogo limitado', () => {
    test('sem PRO → isPro false e catálogo de 10 faixas', () => {
      const result = deriveEntitlements('none', null, FIXED_NOW);
      expect(result.plan).toBe('free');
      expect(result.isPro).toBe(false);
      expect(result.maxCatalogTracks).toBe(10);
    });
  });
});

describe('deriveEntitlements (PAYWALL_DISABLED = true)', () => {
  beforeEach(() => {
    jest.resetModules();
  });

  test('PAYWALL_DISABLED=true → always pro regardless of status', async () => {
    jest.doMock('../../constants/maestra', () => ({
      ...jest.requireActual('../../constants/maestra'),
      PAYWALL_DISABLED: true,
    }));

    const { deriveEntitlements: deriveFn } = await import('../useEntitlements');
    const FIXED_NOW = new Date('2025-01-15T12:00:00Z').getTime();

    // Even with status 'none', should return pro
    const result = deriveFn('none', null, FIXED_NOW);
    expect(result.plan).toBe('pro');
    expect(result.isPro).toBe(true);
    expect(result.maxCatalogTracks).toBe(Infinity);
  });

  test('PAYWALL_DISABLED=true → pro even when overdue past grace period', async () => {
    jest.doMock('../../constants/maestra', () => ({
      ...jest.requireActual('../../constants/maestra'),
      PAYWALL_DISABLED: true,
    }));

    const { deriveEntitlements: deriveFn } = await import('../useEntitlements');
    const FIXED_NOW = new Date('2025-01-15T12:00:00Z').getTime();
    const pastGrace = '2025-01-10T12:00:00Z';

    const result = deriveFn('overdue', pastGrace, FIXED_NOW);
    expect(result.plan).toBe('pro');
    expect(result.isPro).toBe(true);
    expect(result.maxCatalogTracks).toBe(Infinity);
  });
});
