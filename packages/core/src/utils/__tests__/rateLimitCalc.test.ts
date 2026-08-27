/**
 * Unit Tests for Rate Limit Calculation Functions
 * Feature: artist-creation-rate-limit
 *
 * Tests specific examples and edge cases for the pure rate limit utility functions.
 */

import {
  computeCooldown,
  computeRemainingSeconds,
  canCreate,
  getRestrictionPriority,
  formatRemainingTime,
} from '../rateLimitCalc';

// ─── computeCooldown ──────────────────────────────────────────────────────────

describe('computeCooldown', () => {
  test('0 deletions → 0 seconds (no cooldown)', () => {
    expect(computeCooldown(0)).toBe(0);
  });

  test('1 deletion → 600 seconds (10 minutes)', () => {
    expect(computeCooldown(1)).toBe(600);
  });

  test('2 deletions → 86400 seconds (24 hours)', () => {
    expect(computeCooldown(2)).toBe(86400);
  });

  test('3 deletions → 86400 seconds (24 hours)', () => {
    expect(computeCooldown(3)).toBe(86400);
  });

  test('4 deletions → 86400 seconds (24 hours)', () => {
    expect(computeCooldown(4)).toBe(86400);
  });

  test('5 deletions → 604800 seconds (7 days)', () => {
    expect(computeCooldown(5)).toBe(604800);
  });

  test('100 deletions → 604800 seconds (7 days)', () => {
    expect(computeCooldown(100)).toBe(604800);
  });

  test('negative deletionCount → 0 seconds', () => {
    expect(computeCooldown(-1)).toBe(0);
  });
});

// ─── computeRemainingSeconds ──────────────────────────────────────────────────

describe('computeRemainingSeconds', () => {
  test('returns 0 when cooldownSeconds is 0', () => {
    const lastCreated = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-01T00:00:01Z');
    expect(computeRemainingSeconds(lastCreated, 0, now)).toBe(0);
  });

  test('returns full cooldown when just created', () => {
    const now = new Date('2024-01-01T12:00:00Z');
    const lastCreated = new Date('2024-01-01T12:00:00Z');
    expect(computeRemainingSeconds(lastCreated, 600, now)).toBe(600);
  });

  test('returns remaining time correctly', () => {
    const lastCreated = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T12:05:00Z'); // 300 seconds later
    expect(computeRemainingSeconds(lastCreated, 600, now)).toBe(300);
  });

  test('returns 0 when cooldown has fully elapsed', () => {
    const lastCreated = new Date('2024-01-01T12:00:00Z');
    const now = new Date('2024-01-01T12:15:00Z'); // 900 seconds later, cooldown is 600
    expect(computeRemainingSeconds(lastCreated, 600, now)).toBe(0);
  });

  test('returns 0 when now is far past cooldown', () => {
    const lastCreated = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-02-01T00:00:00Z'); // 31 days later
    expect(computeRemainingSeconds(lastCreated, 86400, now)).toBe(0);
  });

  test('handles 7-day cooldown correctly', () => {
    const lastCreated = new Date('2024-01-01T00:00:00Z');
    const now = new Date('2024-01-04T00:00:00Z'); // 3 days later
    // 604800 - 259200 = 345600 (4 days remaining)
    expect(computeRemainingSeconds(lastCreated, 604800, now)).toBe(345600);
  });
});

// ─── canCreate ────────────────────────────────────────────────────────────────

describe('canCreate', () => {
  test('allows creation when pendingCount < 3 and no cooldown', () => {
    expect(canCreate(0, 0)).toBe(true);
    expect(canCreate(1, 0)).toBe(true);
    expect(canCreate(2, 0)).toBe(true);
  });

  test('blocks creation when pendingCount >= 3', () => {
    expect(canCreate(3, 0)).toBe(false);
    expect(canCreate(4, 0)).toBe(false);
    expect(canCreate(100, 0)).toBe(false);
  });

  test('blocks creation when cooldown is active', () => {
    expect(canCreate(0, 1)).toBe(false);
    expect(canCreate(0, 600)).toBe(false);
    expect(canCreate(2, 300)).toBe(false);
  });

  test('blocks creation when both restrictions apply', () => {
    expect(canCreate(3, 600)).toBe(false);
    expect(canCreate(5, 86400)).toBe(false);
  });
});

// ─── getRestrictionPriority ───────────────────────────────────────────────────

describe('getRestrictionPriority', () => {
  test('returns null when no restrictions', () => {
    expect(getRestrictionPriority(false, false)).toBeNull();
  });

  test('returns pending_limit when only pending is blocked', () => {
    expect(getRestrictionPriority(true, false)).toBe('pending_limit');
  });

  test('returns cooldown when only cooldown is blocked', () => {
    expect(getRestrictionPriority(false, true)).toBe('cooldown');
  });

  test('returns pending_limit when both are blocked (pending has priority)', () => {
    expect(getRestrictionPriority(true, true)).toBe('pending_limit');
  });
});

// ─── formatRemainingTime ──────────────────────────────────────────────────────

describe('formatRemainingTime', () => {
  // Minutes
  test('formats 60 seconds as "1 minuto"', () => {
    expect(formatRemainingTime(60)).toBe('1 minuto');
  });

  test('formats 1 second as "1 minuto" (rounds up)', () => {
    expect(formatRemainingTime(1)).toBe('1 minuto');
  });

  test('formats 120 seconds as "2 minutos"', () => {
    expect(formatRemainingTime(120)).toBe('2 minutos');
  });

  test('formats 600 seconds as "10 minutos"', () => {
    expect(formatRemainingTime(600)).toBe('10 minutos');
  });

  test('formats 3599 seconds as "60 minutos" (just under 1 hour threshold)', () => {
    expect(formatRemainingTime(3599)).toBe('60 minutos');
  });

  // Hours
  test('formats 3600 seconds as "1 hora"', () => {
    expect(formatRemainingTime(3600)).toBe('1 hora');
  });

  test('formats 7200 seconds as "2 horas"', () => {
    expect(formatRemainingTime(7200)).toBe('2 horas');
  });

  test('formats 3601 seconds as "2 horas" (rounds up)', () => {
    expect(formatRemainingTime(3601)).toBe('2 horas');
  });

  test('formats 86399 seconds as "24 horas" (just under 1 day threshold)', () => {
    expect(formatRemainingTime(86399)).toBe('24 horas');
  });

  // Days
  test('formats 86400 seconds as "1 dia"', () => {
    expect(formatRemainingTime(86400)).toBe('1 dia');
  });

  test('formats 172800 seconds as "2 dias"', () => {
    expect(formatRemainingTime(172800)).toBe('2 dias');
  });

  test('formats 604800 seconds as "7 dias"', () => {
    expect(formatRemainingTime(604800)).toBe('7 dias');
  });

  test('formats 86401 seconds as "2 dias" (rounds up)', () => {
    expect(formatRemainingTime(86401)).toBe('2 dias');
  });
});
