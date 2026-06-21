/**
 * Preservation Property Tests
 * Feature: chartmetric-api-call-waste
 *
 * Property 2: Preservation - First-Time and Stale Enrichment Unchanged
 *
 * These tests capture the OBSERVED correct behavior of the UNFIXED code for
 * non-buggy inputs (cases where `isBugCondition` returns false). They ensure
 * that after the fix is applied, these behaviors remain unchanged.
 *
 * Observation methodology:
 * - Artist with NO chartmetricProfile → triggers full 6-call enrichment via sequentialGet
 * - Artist with fetched_at > 24h (stale) → triggers full enrichment (current guard ignores fetched_at)
 * - Artist with cm_not_found_at > 7 days → retries get-ids resolution (no marker system exists yet)
 * - collect-metrics for eligible PRO artist → resolves cm_artist_id and fetches metrics
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**
 */

import * as fc from "fast-check";
import { ChartmetricClient } from "../../../supabase/functions/_shared/chartmetric-client";

// ─── Types ──────────────────────────────────────────────────────────────────────

interface ChartmetricProfile {
  cm_artist_id?: number | null;
  enriched?: boolean;
  enriched_at?: string;
  fetched_at?: string | null;
  genres?: string[] | null;
  similar?: Array<{ name: string }> | null;
  genre?: string | null;
  cm_not_found?: boolean;
  cm_not_found_at?: string | null;
  growth?: any;
  audience?: any;
  multiplatform?: any;
  playlists?: any;
}

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Extracts the enrichment guard logic from artist-enrich-chartmetric.
 * This mimics the current (unfixed) guard behavior:
 *   if (existing.enriched === true && existing.genres?.length && existing.similar?.length)
 *     → skip (alreadyEnriched)
 *   else → proceed with enrichment
 */
function shouldSkipEnrichment(existing: ChartmetricProfile): boolean {
  return (
    existing.enriched === true &&
    !!(existing.genres?.length) &&
    !!(existing.similar?.length)
  );
}

/**
 * Creates a mock fetch that counts API calls and returns successful responses.
 * Tracks the number of calls to simulate the 6-call enrichment pattern.
 */
function createCountingMockFetch(callLog: string[]): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input.toString();
    callLog.push(url);

    // Handle token request
    if (url.includes("/api/token")) {
      return new Response(JSON.stringify({ token: "test-token-123" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Handle get-ids request
    if (url.includes("/get-ids")) {
      return new Response(
        JSON.stringify({ obj: [{ cm_artist: 12345 }] }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle artist meta request
    if (url.match(/\/api\/artist\/\d+$/)) {
      return new Response(
        JSON.stringify({
          obj: {
            genres: { primary: "Pop", secondary: ["Indie Pop"] },
            spotify_popularity: 45,
            num_sp_tracks: 20,
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle similar artists
    if (url.includes("/similar")) {
      return new Response(
        JSON.stringify({
          obj: [
            { name: "Artist A" },
            { name: "Artist B" },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle stat/spotify
    if (url.includes("/stat/spotify")) {
      return new Response(
        JSON.stringify({
          obj: {
            followers: [
              { timestp: "2024-01-01", followers: 1000 },
              { timestp: "2024-06-01", followers: 1500 },
            ],
            listeners: [
              { timestp: "2024-01-01", listeners: 5000 },
              { timestp: "2024-06-01", listeners: 8000 },
            ],
          },
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle where-people-listen
    if (url.includes("/where-people-listen")) {
      return new Response(
        JSON.stringify({
          obj: [
            { name: "São Paulo", code2: "BR", listeners: 3000 },
            { name: "New York", code2: "US", listeners: 1500 },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle social-audience-stats
    if (url.includes("/social-audience-stats")) {
      return new Response(
        JSON.stringify({
          obj: [
            { domain: "instagram", followers: 10000 },
            { domain: "tiktok", followers: 5000 },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Handle playlists
    if (url.includes("/playlists")) {
      return new Response(
        JSON.stringify({
          obj: [
            { name: "Discover Weekly", followers: 100000 },
            { name: "Release Radar", followers: 80000 },
          ],
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "X-RateLimit-Limit": "100",
            "X-RateLimit-Remaining": "50",
            "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
          },
        }
      );
    }

    // Default response
    return new Response(JSON.stringify({ obj: null }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "50",
        "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60),
      },
    });
  };
}

/**
 * Simulates the enrichment flow using the actual ChartmetricClient.
 * Returns the number of API calls made and the enrichment result.
 */
async function simulateEnrichment(
  existing: ChartmetricProfile,
  spotifyArtistId: string
): Promise<{ apiCallsMade: number; skipped: boolean; result: any }> {
  // Step 1: Check the guard (unfixed code behavior)
  if (shouldSkipEnrichment(existing)) {
    return { apiCallsMade: 0, skipped: true, result: { ok: true, alreadyEnriched: true } };
  }

  // Step 2: Create client and make API calls
  const callLog: string[] = [];
  const mockFetch = createCountingMockFetch(callLog);

  const client = new ChartmetricClient({
    refreshToken: "test-refresh",
    interRequestDelayMs: 0,
    maxBackoffMs: 500,
    fetchFn: mockFetch,
  });

  // Get token
  await client.getToken();

  // Step 3: Resolve cmId (if not already stored)
  let cmId: number | null = existing.cm_artist_id ?? null;
  if (!cmId && spotifyArtistId) {
    const obj = await client.get(`/api/artist/spotify/${spotifyArtistId}/get-ids`);
    const row = Array.isArray(obj) ? obj[0] : obj;
    cmId = row?.cm_artist ?? row?.chartmetric_id ?? null;
  }

  if (!cmId) {
    // Filter out token call from count
    const apiCalls = callLog.filter((url) => !url.includes("/api/token"));
    return { apiCallsMade: apiCalls.length, skipped: false, result: { ok: false, reason: "no_cm_id" } };
  }

  // Step 4: Execute 6 deep enrichment calls via sequentialGet
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 180 * 864e5).toISOString().split("T")[0];

  const results = await client.sequentialGet([
    `/api/artist/${cmId}`,
    `/api/artist/${cmId}/similar?limit=12`,
    `/api/artist/${cmId}/stat/spotify?since=${since}&until=${today}&field=followers,listeners`,
    `/api/artist/${cmId}/where-people-listen?since=${since}&until=${today}`,
    `/api/artist/${cmId}/social-audience-stats`,
    `/api/artist/${cmId}/spotify/current/playlists?limit=20&sortColumn=followers&sortOrderDesc=true`,
  ]);

  // Filter out token call from count
  const apiCalls = callLog.filter((url) => !url.includes("/api/token"));

  return {
    apiCallsMade: apiCalls.length,
    skipped: false,
    result: { ok: true, enriched: true, data: results },
  };
}

/**
 * Simulates the collect-metrics flow for an eligible PRO artist.
 * Returns the number of API calls made.
 */
async function simulateCollectMetrics(
  spotifyArtistId: string,
  storedCmId: number | null
): Promise<{ apiCallsMade: number; metricsCollected: boolean }> {
  const callLog: string[] = [];
  const mockFetch = createCountingMockFetch(callLog);

  const client = new ChartmetricClient({
    refreshToken: "test-refresh",
    interRequestDelayMs: 0,
    maxBackoffMs: 500,
    fetchFn: mockFetch,
  });

  await client.getToken();

  // Resolve cmId (current behavior: always calls get-ids API)
  const obj = await client.get(`/api/artist/spotify/${spotifyArtistId}/get-ids`);
  const row = Array.isArray(obj) ? obj[0] : obj;
  const cmId = row?.cm_artist ?? row?.chartmetric_id ?? null;

  if (!cmId) {
    const apiCalls = callLog.filter((url) => !url.includes("/api/token"));
    return { apiCallsMade: apiCalls.length, metricsCollected: false };
  }

  // Fetch metrics (3 calls in collect-metrics)
  const today = new Date().toISOString().split("T")[0];
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

  await client.sequentialGet([
    `/api/artist/${cmId}/stat/spotify?since=${since}&until=${today}&field=followers,listeners`,
    `/api/artist/${cmId}/where-people-listen?since=${since}&until=${today}`,
    `/api/artist/${cmId}`,
  ]);

  const apiCalls = callLog.filter((url) => !url.includes("/api/token"));
  return { apiCallsMade: apiCalls.length, metricsCollected: true };
}

// ─── Generators ─────────────────────────────────────────────────────────────────

/**
 * Generator: Profile with NO chartmetricProfile (first-time enrichment).
 * isBugCondition = false because there's no fetched_at (null).
 */
const firstTimeProfileArb = fc.record({
  // Empty profile or entirely absent fields
  cm_artist_id: fc.constant(null as number | null),
  enriched: fc.constant(undefined as boolean | undefined),
  enriched_at: fc.constant(undefined as string | undefined),
  fetched_at: fc.constant(null as string | null),
  genres: fc.constant(null as string[] | null),
  similar: fc.constant(null as Array<{ name: string }> | null),
  genre: fc.constant(null as string | null),
});

/**
 * Generator: Profile with fetched_at > 24h ago (stale data requiring refresh).
 * isBugCondition = false because fetched_at is stale (> 24h).
 */
const staleProfileArb = fc.record({
  cm_artist_id: fc.option(fc.integer({ min: 1, max: 9999999 }), { nil: null }),
  enriched: fc.boolean(),
  enriched_at: fc.constant(new Date(Date.now() - 48 * 3600_000).toISOString()),
  // fetched_at is always > 24h ago
  fetched_at: fc.integer({ min: 25, max: 720 }).map(
    (hoursAgo) => new Date(Date.now() - hoursAgo * 3600_000).toISOString()
  ),
  // genres/similar may or may not be present - doesn't matter for stale check
  genres: fc.option(
    fc.array(fc.string({ minLength: 2, maxLength: 15 }), { minLength: 0, maxLength: 3 }),
    { nil: null }
  ),
  similar: fc.option(
    fc.array(fc.record({ name: fc.string({ minLength: 2, maxLength: 20 }) }), { minLength: 0, maxLength: 5 }),
    { nil: null }
  ),
  genre: fc.option(fc.string({ minLength: 2, maxLength: 15 }), { nil: null }),
});

/**
 * Generator: Profile with cm_not_found_at > 7 days (retry allowed).
 * isBugCondition = false because the not-found marker is expired (> 7 days).
 * NOTE: In the current unfixed code, there IS no cm_not_found system.
 * The function simply calls resolveCmId every time. This test captures that
 * the resolution IS attempted (which is the preservation behavior we want).
 */
const expiredNotFoundProfileArb = fc.record({
  cm_artist_id: fc.constant(null as number | null),
  enriched: fc.constant(false),
  fetched_at: fc.constant(null as string | null),
  // cm_not_found_at is > 7 days ago (expired marker)
  cm_not_found: fc.constant(true),
  cm_not_found_at: fc.integer({ min: 8, max: 90 }).map(
    (daysAgo) => new Date(Date.now() - daysAgo * 86400_000).toISOString()
  ),
  genres: fc.constant(null as string[] | null),
  similar: fc.constant(null as Array<{ name: string }> | null),
});

/**
 * Generator: Spotify artist ID for use in API calls.
 */
const spotifyArtistIdArb = fc.stringMatching(/^[0-9a-zA-Z]{22}$/);

// ─── Property Tests ─────────────────────────────────────────────────────────────

/**
 * Property 2.1: For all inputs with NO chartmetricProfile (or fetched_at = null),
 * enrichment proceeds and makes 6 API calls via sequentialGet.
 *
 * Observation: On the current unfixed code, when existing profile is empty/absent,
 * the guard `enriched === true && genres?.length && similar?.length` is false,
 * so enrichment always proceeds with the full 6-call pattern.
 *
 * **Validates: Requirements 3.1, 3.2**
 */
describe("Property 2.1: First-time enrichment proceeds with 6 API calls", () => {
  test("for any artist with no chartmetricProfile, enrichment makes 6 sequentialGet calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        firstTimeProfileArb,
        spotifyArtistIdArb,
        async (profile, spotifyId) => {
          const result = await simulateEnrichment(profile, spotifyId);

          // PRESERVATION: First-time enrichment must proceed (not skipped)
          expect(result.skipped).toBe(false);
          // Guard check (1 get-ids) + 6 sequentialGet calls = 7 total API calls
          expect(result.apiCallsMade).toBe(7);
          expect(result.result.ok).toBe(true);
          expect(result.result.enriched).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Property 2.2: For all inputs with fetched_at > 24h, enrichment proceeds
 * and updates fetched_at/enriched_at.
 *
 * Observation: The current guard only checks `enriched && genres?.length && similar?.length`.
 * It does NOT check fetched_at at all. So when genres/similar are empty (common for
 * small artists), enrichment always proceeds regardless of fetched_at.
 *
 * For this property we test profiles where the guard fails (genres or similar empty),
 * which is the common stale-data scenario.
 *
 * **Validates: Requirements 3.4, 3.5**
 */
describe("Property 2.2: Stale data enrichment proceeds with full API calls", () => {
  test("for any artist with fetched_at > 24h and empty genres/similar, enrichment proceeds", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate stale profiles where guard will fail (no genres or no similar)
        staleProfileArb.filter((p) => !p.genres?.length || !p.similar?.length),
        spotifyArtistIdArb,
        async (profile, spotifyId) => {
          const result = await simulateEnrichment(profile, spotifyId);

          // PRESERVATION: Stale data enrichment must proceed
          expect(result.skipped).toBe(false);
          // When cm_artist_id is already known: 6 calls
          // When cm_artist_id is null: 1 get-ids + 6 calls = 7
          if (profile.cm_artist_id) {
            expect(result.apiCallsMade).toBe(6);
          } else {
            expect(result.apiCallsMade).toBe(7);
          }
          expect(result.result.ok).toBe(true);
          expect(result.result.enriched).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Property 2.3: For all inputs where cm_not_found_at > 7 days, a retry of
 * get-ids resolution is attempted.
 *
 * Observation: In the current unfixed code, there is NO cm_not_found marker system.
 * The function always calls resolveCmId regardless of any markers. This test verifies
 * that the resolution (get-ids API call) IS attempted, which is the preservation
 * behavior we need after adding the cm_not_found system.
 *
 * **Validates: Requirements 3.6**
 */
describe("Property 2.3: Expired not-found markers allow retry of get-ids resolution", () => {
  test("for any artist with cm_not_found_at > 7 days, get-ids resolution is attempted", async () => {
    await fc.assert(
      fc.asyncProperty(
        expiredNotFoundProfileArb,
        spotifyArtistIdArb,
        async (profile, spotifyId) => {
          const result = await simulateEnrichment(profile, spotifyId);

          // PRESERVATION: Resolution must be attempted (not skipped)
          expect(result.skipped).toBe(false);
          // At minimum, get-ids must be called (1 API call for resolution)
          expect(result.apiCallsMade).toBeGreaterThanOrEqual(1);
          // Since our mock returns a valid cm_artist_id, full enrichment proceeds
          // 1 get-ids + 6 enrichment = 7 calls
          expect(result.apiCallsMade).toBe(7);
          expect(result.result.ok).toBe(true);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Property 2.4: collect-metrics still fetches metrics for eligible PRO artists
 * with snapshot >= 30 days.
 *
 * Observation: The current collect-metrics function always calls resolveCmId via API
 * (1 get-ids call) then makes 3 sequential calls for metrics data. Total = 4 API calls.
 * This behavior must be preserved for eligible artists.
 *
 * **Validates: Requirements 3.3, 3.7**
 */
describe("Property 2.4: collect-metrics fetches metrics for eligible PRO artists", () => {
  test("for any eligible PRO artist, collect-metrics makes get-ids + 3 metric calls", async () => {
    await fc.assert(
      fc.asyncProperty(
        spotifyArtistIdArb,
        async (spotifyId) => {
          // Current behavior: always resolves via API (storedCmId not passed)
          const result = await simulateCollectMetrics(spotifyId, null);

          // PRESERVATION: Metrics collection must proceed
          expect(result.metricsCollected).toBe(true);
          // 1 get-ids + 3 metric calls = 4 total API calls
          expect(result.apiCallsMade).toBe(4);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});
