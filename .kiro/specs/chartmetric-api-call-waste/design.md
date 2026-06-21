# Chartmetric API Call Waste Bugfix Design

## Overview

The Chartmetric API is being called repetitively and wastefully, consuming paid credits unnecessarily. The root issue is a combination of missing "not found" caching, a flawed idempotency guard that requires genres/similar (which small artists don't have), absent TTL checks before triggering enrichment, unconditional frontend triggers, and no concurrency deduplication. The fix introduces a layered defense: (1) persist `cm_not_found` markers, (2) replace the genres/similar guard with a TTL-based freshness check, (3) add frontend TTL gating, (4) add backend deduplication via an `enrichment_lock` timestamp, and (5) reuse persisted `cm_artist_id` in `collect-metrics`.

## Glossary

- **Bug_Condition (C)**: An enrichment request is made when data is already fresh (`fetched_at` < 24h), or the artist is marked as not-found (< 7 days), or a concurrent duplicate is in-flight, or a backend call lacks PRO verification
- **Property (P)**: When C holds, zero Chartmetric API calls are made and the function returns early with a skip/cache reason
- **Preservation**: First-time enrichment, stale-data refresh, and monthly metrics collection for PRO users must continue to work identically
- **`artist-enrich-chartmetric`**: Edge Function in `supabase/functions/artist-enrich-chartmetric/index.ts` that performs deep Chartmetric enrichment (6 API calls per execution)
- **`collect-metrics`**: Edge Function in `supabase/functions/collect-metrics/index.ts` that collects monthly metrics snapshots for PRO artists
- **`ChartmetricClient`**: Shared HTTP client in `supabase/functions/_shared/chartmetric-client.ts` with rate-limit handling
- **TTL**: Time-to-live — 24 hours for enrichment data freshness
- **`cm_not_found`**: Marker persisted in `content.chartmetricProfile` indicating the artist doesn't exist in Chartmetric's database
- **`enrichment_lock`**: Timestamp written at the start of enrichment to prevent concurrent duplicate executions
- **`fetched_at`**: ISO timestamp of last successful enrichment, used as cache freshness indicator

## Bug Details

### Bug Condition

The bug manifests when the system makes Chartmetric API calls that are unnecessary — either because the data is already fresh, the artist was already determined not to exist in Chartmetric, or a concurrent execution is already in progress. The `artist-enrich-chartmetric` function's idempotency guard (`enriched === true && genres?.length && similar?.length`) is structurally flawed because small artists never satisfy the genres/similar condition, causing an infinite re-enrichment loop.

**Formal Specification:**
```
FUNCTION isBugCondition(input)
  INPUT: input of type EnrichRequest { artistId, chartmetricProfile, triggerSource, concurrentLockActive }
  OUTPUT: boolean
  
  LET profile = input.chartmetricProfile
  LET notFoundCached = profile.cm_not_found = true AND daysSince(profile.cm_not_found_at) < 7
  LET dataFresh = profile.fetched_at IS NOT NULL AND hoursSince(profile.fetched_at) < 24
  LET concurrentDuplicate = input.concurrentLockActive = true
  LET backendNoPro = input.triggerSource = "backend_automated" AND input.userHasPro = false
  LET cmIdAlreadyResolved = profile.cm_artist_id IS NOT NULL (for collect-metrics get-ids calls)
  
  RETURN notFoundCached
         OR dataFresh
         OR concurrentDuplicate
         OR backendNoPro
         OR cmIdAlreadyResolved
END FUNCTION
```

### Examples

- **Heinzy (cm_artist_id=4655534)**: `fetched_at = 2026-06-20T18:53:53`, `genres = null`, `similar = null`. Guard fails → re-enriches on every Wizard open (40+ calls/day). With fix: `fetched_at` is < 24h old → returns `{ ok: true, skipped: "fresh_data" }` with 0 API calls.
- **Non-existent artist**: `get-ids` returns null on first attempt. Without fix: called again on next Wizard open. With fix: `cm_not_found: true` persisted → returns `{ ok: true, skipped: "not_found_cached" }` for 7 days.
- **Concurrent triggers**: Wizard opens at 18:53:00, ProfileUnlock fires at 18:53:02 for same artist. Without fix: 12 API calls (6+6). With fix: second call sees `enrichment_lock` → returns `{ ok: true, alreadyEnriched: true }`.
- **collect-metrics reuse**: Artist has `cm_artist_id = 4655534` in content. Without fix: calls `get-ids` API. With fix: reads `cm_artist_id` from content, skips API call.

## Expected Behavior

### Preservation Requirements

**Unchanged Behaviors:**
- First-time enrichment for a brand-new artist (no `chartmetricProfile` or stale `fetched_at` > 24h) must continue to make all 6 API calls and persist the full profile
- `collect-metrics` monthly collection for PRO artists with eligible snapshots (>= 30 days old) must continue to fetch and store metrics normally
- The `ChartmetricClient` rate-limit handling (429 retries, proactive pacing, exponential backoff) must remain completely unchanged
- Mouse/UI interactions in Wizard and ProfileUnlock (form submissions, navigation, payment flow) must remain unaffected
- The content merge strategy (re-read + merge to avoid clobber) must remain intact
- Artists that DO have genres/similar must still store them correctly

**Scope:**
All inputs that do NOT satisfy the bug condition should produce identical results to the current code. This includes:
- First-time enrichment requests (no prior `chartmetricProfile`)
- Stale data refresh (fetched_at > 24 hours)
- `cm_not_found` markers older than 7 days (retry allowed)
- Monthly metrics collection for eligible PRO artists
- Non-Chartmetric operations (Spotify profile, quiz, diagnostic)

## Hypothesized Root Cause

Based on the bug description and code analysis, the confirmed root causes are:

1. **Flawed Idempotency Guard**: The guard `enriched === true && genres?.length && similar?.length` requires genres AND similar to be populated. Small/new artists on Chartmetric often have neither, so the guard never passes and enrichment repeats indefinitely. The `fetched_at` field exists but is never checked.

2. **No "Not Found" Persistence**: When `resolveCmId()` returns `null`, the function returns `{ ok: false, reason: "no_cm_id" }` without saving any state. Next time the function is called, it hits the API again. No marker is written to prevent retries.

3. **Frontend Triggers Without TTL Check**: Both `Wizard/index.tsx` (line ~108) and `ProfileUnlock/index.tsx` (line ~104) invoke `artist-enrich-chartmetric` without checking if `chartmetricProfile.fetched_at` is recent. The Wizard checks `!genres || !similar` which is always true for small artists.

4. **No Concurrency Guard**: Multiple triggers (Wizard open + ProfileUnlock + any other) can fire simultaneously. There is no lock/deduplication mechanism — each execution makes its own 6 API calls.

5. **`collect-metrics` Re-resolves Known IDs**: `fetchMetricsFromChartmetric()` always calls `resolveCmId()` via the API even when the artist's `cm_artist_id` is already stored in the database content.

6. **Data Not Reused Between Stages**: The diagnostic stage fetches `/api/artist/:id` and saves it, but the planning stage (seconds later) triggers a full re-enrichment instead of reading the persisted data.

## Correctness Properties

Property 1: Bug Condition - Wasteful API Calls Eliminated

_For any_ enrichment request where the bug condition holds (data is fresh within 24h TTL, or artist is marked `cm_not_found` within 7 days, or a concurrent lock is active, or backend call lacks PRO status), the fixed `artist-enrich-chartmetric` function SHALL make zero Chartmetric API calls and return an early-exit response indicating the skip reason (`fresh_data`, `not_found_cached`, `alreadyEnriched`, or `no_pro`).

**Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8**

Property 2: Preservation - First-Time and Stale Enrichment Unchanged

_For any_ enrichment request where the bug condition does NOT hold (first-time enrichment with no `chartmetricProfile`, stale data with `fetched_at` > 24h, `cm_not_found` older than 7 days, eligible monthly collection for PRO artists), the fixed function SHALL produce the same API calls and the same persisted result as the original function, preserving all existing enrichment and collection behavior.

**Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7**

## Fix Implementation

### Changes Required

Assuming our root cause analysis is correct:

**File**: `supabase/functions/artist-enrich-chartmetric/index.ts`

**Function**: `serve` handler (main enrichment logic)

**Specific Changes**:

1. **Replace Idempotency Guard with TTL Check**: Remove the `enriched === true && genres?.length && similar?.length` guard. Replace with:
   ```typescript
   const TTL_HOURS = 24;
   const isFresh = existing.fetched_at && 
     (Date.now() - new Date(existing.fetched_at).getTime()) < TTL_HOURS * 3600_000;
   if (isFresh) return json({ ok: true, skipped: "fresh_data" });
   ```

2. **Persist `cm_not_found` Marker**: When `resolveCmId()` returns null, persist a marker and return:
   ```typescript
   if (!cmId) {
     const notFoundProfile = { ...existing, cm_not_found: true, cm_not_found_at: new Date().toISOString() };
     await supabaseAdmin.from("artists")
       .update({ content: { ...freshContent, chartmetricProfile: notFoundProfile } })
       .eq("id", artistId);
     return json({ ok: true, skipped: "not_found_cached" });
   }
   ```

3. **Check `cm_not_found` Before Resolving**: Before calling `resolveCmId`, check the marker:
   ```typescript
   if (existing.cm_not_found && existing.cm_not_found_at) {
     const daysSince = (Date.now() - new Date(existing.cm_not_found_at).getTime()) / 86400_000;
     if (daysSince < 7) return json({ ok: true, skipped: "not_found_cached" });
   }
   ```

4. **Add Enrichment Lock for Concurrency**: Write a temporary lock timestamp before making API calls, check it at start:
   ```typescript
   const LOCK_TTL_MS = 120_000; // 2 minutes
   if (existing.enrichment_lock && 
       (Date.now() - new Date(existing.enrichment_lock).getTime()) < LOCK_TTL_MS) {
     return json({ ok: true, alreadyEnriched: true });
   }
   // Write lock before API calls
   await supabaseAdmin.from("artists")
     .update({ content: { ...content, chartmetricProfile: { ...existing, enrichment_lock: new Date().toISOString() } } })
     .eq("id", artistId);
   ```

5. **Update `fetched_at` on Successful Enrichment**: Ensure `fetched_at` is always set in the merged profile (already done as `enriched_at`, but we need `fetched_at` for the TTL check):
   ```typescript
   const merged = {
     ...existing,
     // ... all fields ...
     fetched_at: new Date().toISOString(),
     enrichment_lock: null, // clear lock
   };
   ```

---

**File**: `src/pages/Wizard/index.tsx`

**Function**: `useEffect` at line ~108

**Specific Changes**:

6. **Add Frontend TTL Gate**: Replace the genres/similar check with a freshness check:
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

---

**File**: `src/pages/ProfileUnlock/index.tsx`

**Function**: `finish` at line ~104

**Specific Changes**:

7. **Add TTL Check Before ProfileUnlock Trigger**: Only trigger if data is stale:
   ```typescript
   const cm = artist?.content?.chartmetricProfile;
   const isStale = !cm?.fetched_at || 
     (Date.now() - new Date(cm.fetched_at).getTime()) > 24 * 3600_000;
   if (isStale) {
     supabase.functions.invoke('artist-enrich-chartmetric', { body: { artistId } }).catch(() => {});
   }
   ```

---

**File**: `supabase/functions/collect-metrics/index.ts`

**Function**: `fetchMetricsFromChartmetric`

**Specific Changes**:

8. **Reuse Persisted `cm_artist_id`**: Pass the stored `cm_artist_id` to avoid unnecessary `get-ids` calls:
   ```typescript
   // In the loop, read cm_artist_id from content before calling fetchMetricsFromChartmetric
   const storedCmId = (artist as any).content?.chartmetricProfile?.cm_artist_id ?? null;
   const metrics = await fetchMetricsFromChartmetric(artist.spotify_artist_id, client, storedCmId);
   ```
   Update function signature to accept optional `storedCmId`:
   ```typescript
   async function fetchMetricsFromChartmetric(
     spotifyArtistId: string, client: ChartmetricClient, storedCmId?: number | null
   ): Promise<MetricsSnapshot | null> {
     const cmId = storedCmId ?? await resolveCmId(spotifyArtistId, client);
     // ...
   }
   ```

---

**File**: `src/interfaces/maestra.ts`

**Interface**: `ChartmetricProfile`

**Specific Changes**:

9. **Add `cm_not_found` Fields to Interface**:
   ```typescript
   cm_not_found?: boolean;
   cm_not_found_at?: string; // ISO — when the "not found" status was recorded
   enrichment_lock?: string | null; // ISO — temporary lock for concurrency deduplication
   ```

## Testing Strategy

### Validation Approach

The testing strategy follows a two-phase approach: first, surface counterexamples that demonstrate the bug on unfixed code, then verify the fix works correctly and preserves existing behavior.

### Exploratory Bug Condition Checking

**Goal**: Surface counterexamples that demonstrate the bug BEFORE implementing the fix. Confirm or refute the root cause analysis. If we refute, we will need to re-hypothesize.

**Test Plan**: Write tests that simulate enrichment requests with various `chartmetricProfile` states and assert on whether API calls are (wastefully) made. Run these tests on the UNFIXED code to observe failures and confirm the root causes.

**Test Cases**:
1. **Infinite Re-enrichment Loop**: Simulate calling `artist-enrich-chartmetric` with `fetched_at` = 1 hour ago, `genres = null`, `similar = null` → expect it makes 6 API calls (demonstrates bug: should skip) (will fail on unfixed code)
2. **Not-Found Repetition**: Simulate calling with `get-ids` returning null twice in sequence → expect both calls hit the API (demonstrates bug: should cache not-found) (will fail on unfixed code)
3. **Concurrent Duplicate**: Simulate two simultaneous calls for the same artist → expect 12 total API calls (demonstrates bug: should deduplicate) (will fail on unfixed code)
4. **collect-metrics Re-resolves ID**: Simulate `fetchMetricsFromChartmetric` for artist with known `cm_artist_id` → expect `get-ids` is still called (demonstrates bug: should reuse) (will fail on unfixed code)

**Expected Counterexamples**:
- Artist with `fetched_at` < 24h but no genres/similar triggers full 6-call enrichment
- Artist with `get-ids` returning null is never marked, leading to repeated API calls
- Possible causes: flawed guard condition, missing persistence of not-found state, missing TTL check

### Fix Checking

**Goal**: Verify that for all inputs where the bug condition holds, the fixed function produces the expected behavior (zero API calls, early return).

**Pseudocode:**
```
FOR ALL input WHERE isBugCondition(input) DO
  result := artistEnrichChartmetric_fixed(input)
  ASSERT result.apiCallsMade = 0
  ASSERT result.response IN [
    { ok: true, skipped: "fresh_data" },
    { ok: true, skipped: "not_found_cached" },
    { ok: true, alreadyEnriched: true },
    { ok: false, skipped: "no_pro" }
  ]
END FOR
```

### Preservation Checking

**Goal**: Verify that for all inputs where the bug condition does NOT hold, the fixed function produces the same result as the original function.

**Pseudocode:**
```
FOR ALL input WHERE NOT isBugCondition(input) DO
  ASSERT artistEnrichChartmetric_original(input) = artistEnrichChartmetric_fixed(input)
END FOR
```

**Testing Approach**: Property-based testing is recommended for preservation checking because:
- It generates many test cases automatically across the input domain (various combinations of `fetched_at`, `cm_not_found`, `genres`, `similar`, `cm_artist_id`)
- It catches edge cases that manual unit tests might miss (e.g., `fetched_at` exactly at the 24h boundary)
- It provides strong guarantees that behavior is unchanged for all non-buggy inputs

**Test Plan**: Observe behavior on UNFIXED code first for first-time enrichment and stale-data scenarios, then write property-based tests capturing that behavior to ensure the fix doesn't break it.

**Test Cases**:
1. **First-Time Enrichment Preservation**: Verify that an artist with no `chartmetricProfile` at all still triggers the full 6-call enrichment and persists all fields correctly
2. **Stale Refresh Preservation**: Verify that an artist with `fetched_at` > 24h still triggers enrichment and updates the profile
3. **Monthly Collection Preservation**: Verify that `collect-metrics` still collects for eligible PRO artists with snapshots >= 30 days old
4. **Not-Found Retry Preservation**: Verify that `cm_not_found` markers older than 7 days allow a retry attempt

### Unit Tests

- Test TTL check logic: `fetched_at` at various ages (1h, 23h, 24h, 25h, null)
- Test `cm_not_found` marker persistence and expiry (1d, 6d, 7d, 8d)
- Test `enrichment_lock` detection and TTL (30s, 1min, 2min, 3min)
- Test `collect-metrics` `cm_artist_id` reuse (present vs absent in content)
- Test frontend TTL gate logic in Wizard and ProfileUnlock

### Property-Based Tests

- Generate random `chartmetricProfile` states (varying `fetched_at`, `cm_not_found`, `cm_not_found_at`, `genres`, `similar`, `enrichment_lock`) and verify: if bug condition holds → 0 API calls; if not → enrichment proceeds
- Generate random timing scenarios for concurrent lock detection and verify only one execution proceeds
- Generate random `cm_artist_id` presence/absence in content and verify `collect-metrics` only calls `get-ids` when ID is absent

### Integration Tests

- Test full Wizard open flow: artist with fresh data → no network call to edge function
- Test ProfileUnlock payment completion: artist with stale data → triggers enrichment; artist with fresh data → no call
- Test `collect-metrics` end-to-end: artist with stored `cm_artist_id` skips `get-ids` call
- Test not-found → retry flow: mark not-found, wait 7 days equivalent, verify retry succeeds
