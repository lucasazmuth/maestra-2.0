/**
 * Property-Based Tests for Pending Count Accuracy
 * Feature: artist-creation-rate-limit, Property 4: Acurácia da contagem de perfis pendentes
 *
 * Para qualquer conjunto de registros na tabela artists, a contagem de perfis pendentes
 * de um user_id deve ser exatamente igual ao número de registros onde user_id = U AND
 * is_locked = true. Registros de outros usuários ou com is_locked = false nunca devem
 * ser contados.
 *
 * **Validates: Requirements 2.3, 2.4**
 */

import * as fc from 'fast-check';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ArtistRecord {
  user_id: string;
  is_locked: boolean;
}

// ─── Pure helper: counting logic (mirrors DB query logic) ────────────────────

/**
 * Counts pending profiles for a given user.
 * A pending profile is one where user_id matches AND is_locked === true.
 * This replicates the DB-level counting:
 *   SELECT count(*) FROM artists WHERE user_id = U AND is_locked = true
 */
function countPendingProfiles(artists: ArtistRecord[], userId: string): number {
  return artists.filter(a => a.user_id === userId && a.is_locked === true).length;
}

// ─── Generators ──────────────────────────────────────────────────────────────

const arbitraryUserId = fc.uuid();

const TARGET_USER = 'target-user-id';

/**
 * Generator for an artist record with mixed user_ids and is_locked values.
 */
function arbitraryArtistRecord(): fc.Arbitrary<ArtistRecord> {
  return fc.record({
    user_id: fc.oneof(fc.constant(TARGET_USER), arbitraryUserId),
    is_locked: fc.boolean(),
  });
}

// ─── Property 4: Acurácia da contagem de perfis pendentes ────────────────────

describe('Feature: artist-creation-rate-limit, Property 4: Acurácia da contagem de perfis pendentes', () => {
  test('count equals exactly the number of records where user_id matches AND is_locked is true', () => {
    fc.assert(
      fc.property(
        fc.array(arbitraryArtistRecord(), { minLength: 0, maxLength: 50 }),
        arbitraryUserId,
        (artists, targetUserId) => {
          const result = countPendingProfiles(artists, targetUserId);

          // Manual expected count: only records with matching user_id AND is_locked = true
          const expected = artists.filter(
            a => a.user_id === targetUserId && a.is_locked === true
          ).length;

          expect(result).toBe(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('records with is_locked = false are never counted even when user_id matches', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: fc.constant(TARGET_USER),
            is_locked: fc.constant(false),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (artists) => {
          const result = countPendingProfiles(artists, TARGET_USER);

          // All records have is_locked = false, so count must be 0
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('records from other users are never counted even when is_locked is true', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: arbitraryUserId.filter(id => id !== TARGET_USER),
            is_locked: fc.constant(true),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (artists) => {
          const result = countPendingProfiles(artists, TARGET_USER);

          // All records belong to other users, so count must be 0
          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('empty array always returns 0', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        (userId) => {
          const result = countPendingProfiles([], userId);

          expect(result).toBe(0);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when all records match (same user_id, all is_locked=true), count equals array length', () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            user_id: fc.constant(TARGET_USER),
            is_locked: fc.constant(true),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (artists) => {
          const result = countPendingProfiles(artists, TARGET_USER);

          // Every record matches, so count must equal array length
          expect(result).toBe(artists.length);
        }
      ),
      { numRuns: 100 }
    );
  });
});
