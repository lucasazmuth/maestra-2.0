/**
 * Property-Based Tests for Restriction Priority and Cross-User Creation
 * Feature: artist-creation-rate-limit
 *
 * Tests:
 * - Property 7: Prioridade de restrições (pending_limit tem prioridade sobre cooldown)
 * - Property 1: Criação entre usuários distintos é sempre permitida
 * - Property 2: Auto-duplicidade é sempre bloqueada
 */

import * as fc from 'fast-check';
import { getRestrictionPriority } from '../rateLimitCalc';

// ─── Helper Functions (pure logic for Properties 1 & 2) ──────────────────────

interface ArtistProfile {
  user_id: string;
  spotify_artist_id: string;
}

/**
 * Checks if a (user_id, spotify_artist_id) combination already exists in the profiles list.
 * Returns true if the exact same user already has a profile for that artist (self-duplicate).
 */
function isSelfDuplicate(
  existingProfiles: ArtistProfile[],
  userId: string,
  spotifyId: string
): boolean {
  return existingProfiles.some(
    (p) => p.user_id === userId && p.spotify_artist_id === spotifyId
  );
}

/**
 * Determines if a user can create a profile for a given artist based on
 * the self-duplicate rule. A user can create only if there's no existing
 * profile with the same (user_id, spotify_artist_id).
 *
 * Note: This does NOT check rate limits — only the cross-user / self-duplicate logic.
 */
function canUserCreate(
  existingProfiles: ArtistProfile[],
  userId: string,
  spotifyId: string
): boolean {
  return !isSelfDuplicate(existingProfiles, userId, spotifyId);
}

// ─── Generators ───────────────────────────────────────────────────────────────

/**
 * Generator for non-empty user IDs (UUID-like strings).
 */
const arbitraryUserId = fc.uuid();

/**
 * Generator for non-empty Spotify artist IDs (alphanumeric strings like real Spotify IDs).
 */
const arbitrarySpotifyId = fc.string({ minLength: 10, maxLength: 22 });

/**
 * Generator for an artist profile record.
 */
const arbitraryProfile: fc.Arbitrary<ArtistProfile> = fc.record({
  user_id: arbitraryUserId,
  spotify_artist_id: arbitrarySpotifyId,
});

/**
 * Generator for a list of existing profiles.
 */
const arbitraryProfileList = fc.array(arbitraryProfile, { minLength: 0, maxLength: 20 });

// ─── Property 7: Prioridade de restrições ─────────────────────────────────────

/**
 * Property 7: Prioridade de restrições
 *
 * Para qualquer estado onde tanto o limite de pendentes quanto o cooldown estão ativos
 * simultaneamente, o sistema deve reportar a restrição de "pending_limit" como prioritária.
 *
 * **Validates: Requirements 5.3**
 */
describe('Feature: artist-creation-rate-limit, Property 7: Prioridade de restrições', () => {
  test('when both pending_limit and cooldown are active, pending_limit has priority', () => {
    fc.assert(
      fc.property(
        // Generate arbitrary context around the state (doesn't change the boolean inputs)
        fc.record({
          pendingCount: fc.integer({ min: 3, max: 100 }),
          cooldownRemaining: fc.integer({ min: 1, max: 604800 }),
          deletions30d: fc.integer({ min: 1, max: 50 }),
        }),
        (_context) => {
          // When BOTH are blocked simultaneously
          const result = getRestrictionPriority(true, true);

          // pending_limit MUST always be the reported restriction
          expect(result).toBe('pending_limit');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when only pending_limit is active, returns pending_limit', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 100 }),
        (_pendingCount) => {
          const result = getRestrictionPriority(true, false);
          expect(result).toBe('pending_limit');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when only cooldown is active, returns cooldown', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 604800 }),
        (_cooldownRemaining) => {
          const result = getRestrictionPriority(false, true);
          expect(result).toBe('cooldown');
        }
      ),
      { numRuns: 100 }
    );
  });

  test('when neither restriction is active, returns null', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 2 }),
        (_pendingCount) => {
          const result = getRestrictionPriority(false, false);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 1: Criação entre usuários distintos é sempre permitida ──────────

/**
 * Property 1: Criação entre usuários distintos é sempre permitida
 *
 * Para qualquer par de user_id distintos e qualquer spotify_artist_id válido, se o
 * primeiro usuário já possui um perfil para esse artista, o segundo usuário deve
 * conseguir criar um perfil para o mesmo artista sem bloqueio.
 *
 * **Validates: Requirements 1.1, 1.3**
 */
describe('Feature: artist-creation-rate-limit, Property 1: Criação entre usuários distintos é sempre permitida', () => {
  test('distinct users never block each other for the same spotify_artist_id', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        arbitraryUserId,
        arbitrarySpotifyId,
        arbitraryProfileList,
        (userA, userB, spotifyId, otherProfiles) => {
          // Pre-condition: user IDs must be distinct
          fc.pre(userA !== userB);

          // User A already has the profile
          const existingProfiles: ArtistProfile[] = [
            ...otherProfiles,
            { user_id: userA, spotify_artist_id: spotifyId },
          ];

          // User B (different user) must be able to create the same artist profile
          const canBCreate = canUserCreate(existingProfiles, userB, spotifyId);
          expect(canBCreate).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('a user with profiles does not affect another users ability to create any profile', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        arbitraryUserId,
        fc.array(arbitrarySpotifyId, { minLength: 1, maxLength: 5 }),
        arbitrarySpotifyId,
        (userA, userB, userASpotifyIds, newSpotifyId) => {
          // Pre-condition: users must be distinct
          fc.pre(userA !== userB);

          // User A has multiple profiles
          const existingProfiles: ArtistProfile[] = userASpotifyIds.map((sid) => ({
            user_id: userA,
            spotify_artist_id: sid,
          }));

          // User B is never blocked by user A's profiles (self-duplicate check is per-user)
          const canBCreate = canUserCreate(existingProfiles, userB, newSpotifyId);
          expect(canBCreate).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property 2: Auto-duplicidade é sempre bloqueada ──────────────────────────

/**
 * Property 2: Auto-duplicidade é sempre bloqueada
 *
 * Para qualquer user_id e spotify_artist_id, se já existe um registro com essa
 * combinação exata, uma tentativa de criação com os mesmos valores deve ser rejeitada.
 *
 * **Validates: Requirements 1.2**
 */
describe('Feature: artist-creation-rate-limit, Property 2: Auto-duplicidade é sempre bloqueada', () => {
  test('same user_id + spotify_artist_id is always detected as self-duplicate', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        arbitrarySpotifyId,
        arbitraryProfileList,
        (userId, spotifyId, otherProfiles) => {
          // The profile already exists for this user
          const existingProfiles: ArtistProfile[] = [
            ...otherProfiles,
            { user_id: userId, spotify_artist_id: spotifyId },
          ];

          // Self-duplicate MUST be detected
          const isDuplicate = isSelfDuplicate(existingProfiles, userId, spotifyId);
          expect(isDuplicate).toBe(true);

          // Creation MUST be blocked
          const canCreate = canUserCreate(existingProfiles, userId, spotifyId);
          expect(canCreate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('self-duplicate holds regardless of other users profiles in the list', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        arbitrarySpotifyId,
        fc.array(arbitraryUserId, { minLength: 0, maxLength: 10 }),
        (userId, spotifyId, otherUserIds) => {
          // Multiple other users also have the same spotify artist
          const existingProfiles: ArtistProfile[] = [
            // The target user has the profile
            { user_id: userId, spotify_artist_id: spotifyId },
            // Other users also have profiles for the same artist
            ...otherUserIds
              .filter((uid) => uid !== userId)
              .map((uid) => ({ user_id: uid, spotify_artist_id: spotifyId })),
          ];

          // Self-duplicate for the target user MUST still be detected
          const isDuplicate = isSelfDuplicate(existingProfiles, userId, spotifyId);
          expect(isDuplicate).toBe(true);

          // Creation MUST be blocked for the target user
          const canCreate = canUserCreate(existingProfiles, userId, spotifyId);
          expect(canCreate).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  test('non-duplicate combination is not blocked', () => {
    fc.assert(
      fc.property(
        arbitraryUserId,
        arbitrarySpotifyId,
        arbitrarySpotifyId,
        (userId, existingSpotifyId, newSpotifyId) => {
          // Pre-condition: the spotify IDs must be different
          fc.pre(existingSpotifyId !== newSpotifyId);

          // User has a profile but for a DIFFERENT artist
          const existingProfiles: ArtistProfile[] = [
            { user_id: userId, spotify_artist_id: existingSpotifyId },
          ];

          // A different artist should NOT be blocked
          const isDuplicate = isSelfDuplicate(existingProfiles, userId, newSpotifyId);
          expect(isDuplicate).toBe(false);

          // Creation should be allowed
          const canCreate = canUserCreate(existingProfiles, userId, newSpotifyId);
          expect(canCreate).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });
});
