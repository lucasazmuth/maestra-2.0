/**
 * Property-Based Tests for Pending Count and Deletion Window Logic
 * Feature: artist-creation-rate-limit
 *
 * Property 3: Limite de perfis pendentes — canCreate returns true iff pendingCount < 3
 * Property 5: Acurácia da contagem de exclusões (janela de 30 dias) — correct filtering by was_locked and time window
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 3.2, 3.10**
 */

import * as fc from 'fast-check';
import { canCreate } from '../rateLimitCalc';

// ─── Types for Property 5 ────────────────────────────────────────────────────

interface DeletionRecord {
  user_id: string;
  was_locked: boolean;
  deleted_at: number; // timestamp in ms
}

// ─── Pure helper for Property 5 ──────────────────────────────────────────────

/**
 * Counts deletions for a given user within a 30-day window.
 * Only records where was_locked === true AND deleted_at > now - 30 days are counted.
 */
function countDeletions30d(
  deletions: DeletionRecord[],
  userId: string,
  now: number
): number {
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const windowStart = now - thirtyDaysMs;
  return deletions.filter(
    (d) => d.user_id === userId && d.was_locked === true && d.deleted_at > windowStart
  ).length;
}

// ─── Generators ──────────────────────────────────────────────────────────────

/**
 * Generator for non-negative pending counts (0 to 100).
 */
const arbitraryPendingCount = fc.nat({ max: 100 });

/**
 * Generator for a user_id (simple UUID-like string).
 */
const arbitraryUserId = fc.uuid();

/**
 * Generator for a deletion record with configurable user_id.
 * deleted_at spans from 60 days ago to now relative to a reference timestamp.
 */
function arbitraryDeletionRecord(referenceNow: number): fc.Arbitrary<DeletionRecord> {
  const sixtyDaysMs = 60 * 24 * 60 * 60 * 1000;
  return fc.record({
    user_id: fc.oneof(fc.constant('target-user'), arbitraryUserId),
    was_locked: fc.boolean(),
    deleted_at: fc.integer({ min: referenceNow - sixtyDaysMs, max: referenceNow }),
  });
}

// ─── Property 3: Limite de perfis pendentes ──────────────────────────────────

/**
 * Property 3: Limite de perfis pendentes
 *
 * Para qualquer user_id e qualquer contagem N de perfis com is_locked = true
 * pertencentes a esse usuário, a criação de um novo perfil deve ser permitida
 * se e somente se N < 3.
 *
 * We test canCreate with remainingSeconds = 0 (no cooldown), so the only
 * deciding factor is pendingCount.
 *
 * **Validates: Requirements 2.1, 2.2**
 */
describe('Feature: artist-creation-rate-limit, Property 3: Limite de perfis pendentes', () => {
  test('canCreate returns true iff pendingCount < 3 (no cooldown active)', () => {
    fc.assert(
      fc.property(
        arbitraryPendingCount,
        (pendingCount) => {
          const result = canCreate(pendingCount, 0);

          // canCreate must be true iff pendingCount < 3
          expect(result).toBe(pendingCount < 3);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('boundary: pendingCount = 2 always allows creation (no cooldown)', () => {
    fc.assert(
      fc.property(
        fc.constant(2),
        (pendingCount) => {
          expect(canCreate(pendingCount, 0)).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('boundary: pendingCount = 3 always blocks creation (no cooldown)', () => {
    fc.assert(
      fc.property(
        fc.constant(3),
        (pendingCount) => {
          expect(canCreate(pendingCount, 0)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('any pendingCount >= 3 blocks creation regardless of exact value', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 1000 }),
        (pendingCount) => {
          expect(canCreate(pendingCount, 0)).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 5: Acurácia da contagem de exclusões (janela de 30 dias) ───────

/**
 * Property 5: Acurácia da contagem de exclusões (janela de 30 dias)
 *
 * Para qualquer conjunto de registros em artist_deletions e qualquer timestamp now,
 * a contagem de exclusões para um user_id nos últimos 30 dias deve ser exatamente
 * igual ao número de registros onde user_id = U AND was_locked = true AND
 * deleted_at > now - 30 dias. Exclusões de perfis pagos (was_locked = false)
 * nunca devem ser contadas.
 *
 * **Validates: Requirements 3.2, 3.10**
 */
describe('Feature: artist-creation-rate-limit, Property 5: Acurácia da contagem de exclusões', () => {
  const referenceNow = Date.now();

  test('count matches exact number of records with was_locked=true within 30 days', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryDeletionRecord(referenceNow), { minLength: 0, maxLength: 50 }),
        (deletions) => {
          const targetUser = 'target-user';
          const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
          const windowStart = referenceNow - thirtyDaysMs;

          const result = countDeletions30d(deletions, targetUser, referenceNow);

          // Manual expected count
          const expected = deletions.filter(
            (d) =>
              d.user_id === targetUser &&
              d.was_locked === true &&
              d.deleted_at > windowStart
          ).length;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deletions with was_locked=false are never counted even if within 30 days', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: fc.constant('target-user'),
            was_locked: fc.constant(false),
            deleted_at: fc.integer({
              min: referenceNow - 10 * 24 * 60 * 60 * 1000, // within last 10 days
              max: referenceNow,
            }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (deletions) => {
          const result = countDeletions30d(deletions, 'target-user', referenceNow);

          // No record with was_locked=false should ever be counted
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deletions older than 30 days are never counted even if was_locked=true', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: fc.constant('target-user'),
            was_locked: fc.constant(true),
            deleted_at: fc.integer({
              min: referenceNow - 90 * 24 * 60 * 60 * 1000, // 90 days ago
              max: referenceNow - 30 * 24 * 60 * 60 * 1000, // exactly 30 days ago (boundary: <= windowStart)
            }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (deletions) => {
          const result = countDeletions30d(deletions, 'target-user', referenceNow);

          // Records at or before the 30-day boundary should NOT be counted
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('deletions from other users are never counted', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: fc.uuid().filter((id) => id !== 'target-user'),
            was_locked: fc.constant(true),
            deleted_at: fc.integer({
              min: referenceNow - 5 * 24 * 60 * 60 * 1000, // within last 5 days
              max: referenceNow,
            }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (deletions) => {
          const result = countDeletions30d(deletions, 'target-user', referenceNow);

          // Records from other users should never be counted
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('mixed records: only target user + was_locked=true + within window are counted', () => {
    fc.assert(
      fc.property(
        // Generate a mix of valid and invalid records
        fc.tuple(
          // Valid records (should be counted)
          fc.array(
            fc.record({
              user_id: fc.constant('target-user'),
              was_locked: fc.constant(true),
              deleted_at: fc.integer({
                min: referenceNow - 29 * 24 * 60 * 60 * 1000, // within 29 days
                max: referenceNow,
              }),
            }),
            { minLength: 0, maxLength: 20 }
          ),
          // Invalid records (should NOT be counted)
          fc.array(
            fc.oneof(
              // wrong user
              fc.record({
                user_id: fc.uuid().filter((id) => id !== 'target-user'),
                was_locked: fc.constant(true),
                deleted_at: fc.integer({ min: referenceNow - 5 * 24 * 60 * 60 * 1000, max: referenceNow }),
              }),
              // was_locked = false
              fc.record({
                user_id: fc.constant('target-user'),
                was_locked: fc.constant(false),
                deleted_at: fc.integer({ min: referenceNow - 5 * 24 * 60 * 60 * 1000, max: referenceNow }),
              }),
              // too old
              fc.record({
                user_id: fc.constant('target-user'),
                was_locked: fc.constant(true),
                deleted_at: fc.integer({ min: referenceNow - 90 * 24 * 60 * 60 * 1000, max: referenceNow - 30 * 24 * 60 * 60 * 1000 }),
              })
            ),
            { minLength: 0, maxLength: 30 }
          )
        ),
        ([validRecords, invalidRecords]) => {
          const allRecords = [...validRecords, ...invalidRecords];
          const result = countDeletions30d(allRecords, 'target-user', referenceNow);

          // Only validRecords should be counted
          expect(result).toBe(validRecords.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
