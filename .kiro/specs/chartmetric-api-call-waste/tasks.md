# Implementation Plan

## Overview

Fix the Chartmetric API call waste bug by introducing a layered defense: (1) replace the flawed idempotency guard with a TTL-based freshness check, (2) persist `cm_not_found` markers when get-ids returns null, (3) add `enrichment_lock` for concurrency deduplication, (4) add frontend TTL gates in Wizard and ProfileUnlock, and (5) reuse persisted `cm_artist_id` in `collect-metrics`. The fix eliminates all unnecessary API calls while preserving first-time enrichment, stale-data refresh, and monthly metrics collection behavior.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1"] },
    { "id": 2, "tasks": ["3.2", "3.3", "3.4", "3.5"] },
    { "id": 3, "tasks": ["3.6", "3.7", "3.8"] },
    { "id": 4, "tasks": ["3.9", "3.10"] },
    { "id": 5, "tasks": ["4"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Wasteful API Calls on Fresh/Cached/Locked Data
  - **CRITICAL**: This test MUST FAIL on unfixed code — failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior — it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases:
    - Case A: Artist with `fetched_at` < 24h but `genres = null`, `similar = null` → current guard fails, triggers 6 API calls (should skip with `fresh_data`)
    - Case B: Artist where get-ids previously returned null → no `cm_not_found` marker persisted, calls API again (should skip with `not_found_cached`)
    - Case C: Two concurrent enrichment requests for same artist → both execute full 6 API calls (should deduplicate with `alreadyEnriched`)
  - **Bug Condition from design**: `isBugCondition(input)` where `hasNotFoundMarker OR isFresh OR concurrentDuplicate OR backendNoPro OR cmIdAlreadyResolved`
  - **Test structure**: Create a testable extraction of the enrichment guard logic from `supabase/functions/artist-enrich-chartmetric/index.ts`. Mock the Supabase client and ChartmetricClient to count API calls. For each bug condition input, assert `apiCallsMade = 0` and response is one of the early-exit responses
  - **Expected Behavior assertions** (from design):
    - When `fetched_at` is within 24h TTL → return `{ ok: true, skipped: "fresh_data" }` with 0 API calls
    - When `cm_not_found = true` and `cm_not_found_at` < 7 days → return `{ ok: true, skipped: "not_found_cached" }` with 0 API calls
    - When `enrichment_lock` is active (< 2 min old) → return `{ ok: true, alreadyEnriched: true }` with 0 API calls
  - Run test on UNFIXED code
  - **EXPECTED OUTCOME**: Test FAILS (this is correct — proves the bug exists because current guard uses `enriched && genres?.length && similar?.length` instead of TTL)
  - Document counterexamples found: e.g., artist Heinzy with `fetched_at = 2026-06-20T18:53:53` (fresh) but `genres = null` triggers full enrichment
  - Mark task complete when test is written, run, and failure is documented
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 2.1, 2.2, 2.3, 2.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - First-Time and Stale Enrichment Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - **Observe behavior on UNFIXED code for non-buggy inputs** (cases where `isBugCondition` returns false):
    - Observe: Artist with NO `chartmetricProfile` at all → triggers full 6-call enrichment via `sequentialGet`, persists `cm_artist_id`, `enriched`, `enriched_at`, all fields
    - Observe: Artist with `fetched_at` > 24h (stale) → triggers full enrichment and updates profile
    - Observe: Artist with `cm_not_found_at` > 7 days → retries get-ids resolution
    - Observe: `collect-metrics` for eligible PRO artist (snapshot >= 30 days) → resolves cm_artist_id and fetches metrics normally
  - **Write property-based tests capturing observed behavior**:
    - Property: For all inputs with NO `chartmetricProfile` (or `fetched_at = null`), enrichment proceeds and makes 6 API calls via `sequentialGet`
    - Property: For all inputs with `fetched_at` > 24h, enrichment proceeds and updates `fetched_at`/`enriched_at`
    - Property: For all inputs where `cm_not_found_at` > 7 days, a retry of get-ids is attempted
    - Property: `collect-metrics` still fetches metrics for eligible PRO artists with snapshot >= 30 days
  - **Test structure**: Extract the guard logic and mock dependencies. Generate random `chartmetricProfile` states where `isBugCondition = false` (no `fetched_at`, or `fetched_at` > 24h, or `cm_not_found_at` > 7 days). Assert enrichment proceeds (API calls made, result contains enrichment data)
  - Run tests on UNFIXED code
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - Mark task complete when tests are written, run, and passing on unfixed code
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 3. Fix for Chartmetric API call waste elimination

  - [x] 3.1 Update `ChartmetricProfile` interface with new fields
    - Add `cm_not_found?: boolean` field to the interface
    - Add `cm_not_found_at?: string` field (ISO timestamp — when the "not found" status was recorded)
    - Add `enrichment_lock?: string | null` field (ISO timestamp for concurrency deduplication)
    - File: `src/interfaces/maestra.ts` (ChartmetricProfile interface, line ~180)
    - _Bug_Condition: isBugCondition(input) — new fields enable the TTL, not-found, and lock checks_
    - _Expected_Behavior: Interface supports all new guard fields for layered defense_
    - _Preservation: Existing fields remain unchanged, new fields are optional_
    - _Requirements: 2.1, 2.2, 2.5_

  - [x] 3.2 Replace idempotency guard with TTL check in `artist-enrich-chartmetric`
    - Remove the flawed guard: `if (existing.enriched === true && existing.genres?.length && existing.similar?.length)`
    - Replace with TTL-based freshness check:
      ```typescript
      const TTL_HOURS = 24;
      const isFresh = existing.fetched_at &&
        (Date.now() - new Date(existing.fetched_at).getTime()) < TTL_HOURS * 3600_000;
      if (isFresh) return json({ ok: true, skipped: "fresh_data" });
      ```
    - File: `supabase/functions/artist-enrich-chartmetric/index.ts` (line ~45, after fetching artist)
    - _Bug_Condition: isBugCondition(input) where profile.fetched_at IS NOT NULL AND hoursSince(profile.fetched_at) < 24_
    - _Expected_Behavior: When data is fresh (< 24h), return `{ ok: true, skipped: "fresh_data" }` with 0 API calls_
    - _Preservation: When fetched_at is null or > 24h, enrichment proceeds normally (3.1, 3.4)_
    - _Requirements: 2.2, 2.3, 3.1, 3.4_

  - [x] 3.3 Add `cm_not_found` marker persistence and check
    - BEFORE calling `resolveCmId`, check if `cm_not_found = true` and `cm_not_found_at` < 7 days → return `{ ok: true, skipped: "not_found_cached" }`
    - If `cm_not_found_at` > 7 days, clear the marker fields and allow retry
    - WHEN `resolveCmId()` returns null, persist `{ cm_not_found: true, cm_not_found_at: new Date().toISOString() }` in `content.chartmetricProfile` via database update before returning
    - Return `{ ok: true, skipped: "not_found_cached" }` after persisting marker
    - File: `supabase/functions/artist-enrich-chartmetric/index.ts`
    - _Bug_Condition: isBugCondition(input) where profile.cm_not_found = true AND daysSince(profile.cm_not_found_at) < 7_
    - _Expected_Behavior: When not-found is cached (< 7d), return early with 0 API calls; when expired (>= 7d), retry_
    - _Preservation: First-time resolution (no marker) still calls get-ids; markers > 7d allow retry (3.6)_
    - _Requirements: 2.1, 3.1, 3.6_

  - [x] 3.4 Add `enrichment_lock` for concurrency deduplication
    - After TTL and not-found checks pass, check if `enrichment_lock` exists and is < 2 minutes old → return `{ ok: true, alreadyEnriched: true }`
    - Write `enrichment_lock: new Date().toISOString()` to `content.chartmetricProfile` before making API calls
    - Use content re-read + merge pattern to avoid clobber when writing lock
    - File: `supabase/functions/artist-enrich-chartmetric/index.ts`
    - _Bug_Condition: isBugCondition(input) where concurrentLockActive = true (lock < 2 min)_
    - _Expected_Behavior: When lock is active (< 2 min), return `{ ok: true, alreadyEnriched: true }` with 0 API calls_
    - _Preservation: Expired locks (> 2 min) do not block enrichment_
    - _Requirements: 2.5_

  - [x] 3.5 Update `fetched_at` on successful enrichment and clear lock
    - In the merged profile object (after all API calls succeed), set `fetched_at: new Date().toISOString()`
    - Clear `enrichment_lock: null` in the merged profile
    - Clear `cm_not_found: undefined` and `cm_not_found_at: undefined` if enrichment succeeds (artist was found)
    - File: `supabase/functions/artist-enrich-chartmetric/index.ts` (merge section, ~line 110)
    - _Bug_Condition: fetched_at enables the TTL guard for subsequent calls_
    - _Expected_Behavior: After successful enrichment, fetched_at is always set, enabling TTL check on next call_
    - _Preservation: All other merged fields (genres, similar, growth, audience, etc.) remain unchanged (3.5)_
    - _Requirements: 2.2, 2.3_

  - [x] 3.6 Add frontend TTL gate in Wizard
    - Replace the condition `if (!c.chartmetricProfile?.genre || !c.chartmetricProfile?.similar?.length)` with TTL-based check
    - New logic:
      ```typescript
      const cm = c.chartmetricProfile;
      const isStale = !cm?.fetched_at ||
        (Date.now() - new Date(cm.fetched_at).getTime()) > 24 * 3600_000;
      const isNotFoundCached = cm?.cm_not_found && cm?.cm_not_found_at &&
        (Date.now() - new Date(cm.cm_not_found_at).getTime()) < 7 * 86400_000;
      if (isStale && !isNotFoundCached) {
        supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId: artist.id } }).catch(() => {});
      }
      ```
    - File: `src/pages/Wizard/index.tsx` (line ~108, inside `useEffect`)
    - _Bug_Condition: Frontend trigger fires unconditionally for artists without genres/similar (always true for small artists)_
    - _Expected_Behavior: Frontend only triggers enrichment when data is actually stale (> 24h or absent) AND not cached as not-found_
    - _Preservation: First-time fetch (no chartmetricProfile or no fetched_at) still triggers enrichment (3.1)_
    - _Requirements: 2.3, 3.1, 3.4_

  - [x] 3.7 Add TTL check in ProfileUnlock before triggering enrichment
    - In the `finish` function, add freshness check before invoking `artist-enrich-chartmetric`
    - New logic:
      ```typescript
      const cm = artist?.content?.chartmetricProfile;
      const isStale = !cm?.fetched_at ||
        (Date.now() - new Date(cm.fetched_at).getTime()) > 24 * 3600_000;
      if (isStale) {
        supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId } }).catch(() => {});
      }
      ```
    - File: `src/pages/ProfileUnlock/index.tsx` (line ~104, inside `finish`)
    - _Bug_Condition: ProfileUnlock triggers enrichment unconditionally on every payment completion_
    - _Expected_Behavior: ProfileUnlock only triggers enrichment when data is stale (> 24h or absent)_
    - _Preservation: First-time enrichment after payment still works when no fetched_at exists (3.2)_
    - _Requirements: 2.4, 3.2_

  - [x] 3.8 Reuse persisted `cm_artist_id` in `collect-metrics`
    - Modify `fetchMetricsFromChartmetric` function signature to accept optional `storedCmId` parameter:
      ```typescript
      async function fetchMetricsFromChartmetric(
        spotifyArtistId: string, client: ChartmetricClient, storedCmId?: number | null
      ): Promise<MetricsSnapshot | null> {
        const cmId = storedCmId ?? await resolveCmId(spotifyArtistId, client);
        // ... rest unchanged
      }
      ```
    - In the artist processing loop, read `cm_artist_id` from artist content and pass to function:
      ```typescript
      const storedCmId = (artist as any).content?.chartmetricProfile?.cm_artist_id ?? null;
      const metrics = await fetchMetricsFromChartmetric(artist.spotify_artist_id, client, storedCmId);
      ```
    - File: `supabase/functions/collect-metrics/index.ts`
    - _Bug_Condition: isBugCondition(input) where profile.cm_artist_id IS NOT NULL but get-ids is still called_
    - _Expected_Behavior: When cm_artist_id is persisted, skip get-ids API call entirely_
    - _Preservation: When cm_artist_id is not stored (null), still resolves via API as before (3.3)_
    - _Requirements: 2.6, 3.3_

  - [x] 3.9 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Wasteful API Calls Eliminated
    - **IMPORTANT**: Re-run the SAME test from task 1 — do NOT write a new test
    - The test from task 1 encodes the expected behavior (0 API calls when bug condition holds)
    - When this test passes, it confirms:
      - Fresh data (fetched_at < 24h) returns `{ ok: true, skipped: "fresh_data" }`
      - Not-found cached (< 7d) returns `{ ok: true, skipped: "not_found_cached" }`
      - Lock active (< 2min) returns `{ ok: true, alreadyEnriched: true }`
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.5_

  - [x] 3.10 Verify preservation tests still pass
    - **Property 2: Preservation** - First-Time and Stale Enrichment Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 — do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm all tests still pass after fix:
      - First-time enrichment (no chartmetricProfile) still triggers full 6-call enrichment
      - Stale data refresh (fetched_at > 24h) still triggers enrichment
      - Not-found retry after 7 days still allows resolution attempt
      - collect-metrics for PRO artists still collects metrics normally
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

- [x] 4. Checkpoint - Ensure all tests pass
  - Run full test suite to ensure no regressions
  - Verify Property 1 (Bug Condition) test passes — wasteful API calls eliminated
  - Verify Property 2 (Preservation) tests pass — existing behavior unchanged
  - Verify TypeScript compilation succeeds (no type errors from interface changes in `src/interfaces/maestra.ts`)
  - Verify frontend pages compile without errors (`src/pages/Wizard/index.tsx`, `src/pages/ProfileUnlock/index.tsx`)
  - Verify Edge Functions have no import/type errors (`supabase/functions/artist-enrich-chartmetric/index.ts`, `supabase/functions/collect-metrics/index.ts`)
  - Ask the user if questions arise

## Notes

- The TTL constant (24 hours) and not-found retry period (7 days) are hardcoded but could be extracted to environment variables if needed later
- The `enrichment_lock` uses a simple timestamp approach — it's not a distributed lock but sufficient for the typical 2-second gap between concurrent triggers
- Tests mock the Supabase client and ChartmetricClient to avoid real API calls during testing
- The frontend TTL gate is a best-effort optimization — the backend TTL check is the authoritative guard
- Property-based tests should generate random `chartmetricProfile` states with varying `fetched_at` ages, `cm_not_found` states, and `enrichment_lock` timestamps
- The `collect-metrics` change is backward-compatible: when `storedCmId` is null/undefined, it falls back to resolving via API
