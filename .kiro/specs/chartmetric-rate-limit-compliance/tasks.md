# Tasks

## Overview

Fix the Chartmetric API rate limit non-compliance bug by creating a shared HTTP client module with 429 retry, proactive pacing, exponential backoff, and sequential execution. Migrate both `artist-enrich-chartmetric` and `collect-metrics` Edge Functions to use the shared module.

## Task Dependency Graph

```json
{
  "waves": [
    { "id": 0, "tasks": ["1", "2"] },
    { "id": 1, "tasks": ["3.1", "3.2", "3.3", "3.4", "3.5", "3.6"] },
    { "id": 2, "tasks": ["4.1", "4.2", "4.3", "5.1", "5.2", "5.3", "5.4"] },
    { "id": 3, "tasks": ["6.1", "6.2"] },
    { "id": 4, "tasks": ["7"] }
  ]
}
```

## Tasks

- [x] 1. Write bug condition exploration test
  - **Property 1: Bug Condition** - Rate Limit Non-Compliance on 429
  - **CRITICAL**: This test MUST FAIL on unfixed code - failure confirms the bug exists
  - **DO NOT attempt to fix the test or the code when it fails**
  - **NOTE**: This test encodes the expected behavior - it will validate the fix when it passes after implementation
  - **GOAL**: Surface counterexamples that demonstrate the bug exists
  - **Scoped PBT Approach**: Scope the property to concrete failing cases: mock API returns 429 with `X-RateLimit-Reset` header, assert that `cmGet()` retries after waiting and does NOT return `null` immediately
  - Test that `cmGet(path, token)` when receiving HTTP 429 with `X-RateLimit-Reset` header:
    - Reads the `X-RateLimit-Reset` header
    - Waits until the reset timestamp
    - Retries the request (with exponential backoff on subsequent 429s)
    - Returns the successful response data (not `null`)
  - Test that when `X-RateLimit-Remaining <= 2`, the next request is delayed until `X-RateLimit-Reset`
  - Test that parallel requests via `Promise.all` are NOT fired simultaneously (bounded concurrency)
  - Run test on UNFIXED code - expect FAILURE (this confirms the bug exists)
  - **EXPECTED OUTCOME**: Test FAILS because current `cmGet()` returns `null` on 429 without retry, ignores all rate limit headers, and fires requests in parallel without pacing
  - Document counterexamples found:
    - `cmGet("/api/artist/123/stat/spotify", token)` receives 429 → returns `null` immediately (no retry)
    - `X-RateLimit-Remaining: 0` in response headers → next request fires immediately (no pacing)
    - `Promise.all([cmGet(...), cmGet(...), cmGet(...), cmGet(...)])` fires all 4 in < 10ms
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_

- [x] 2. Write preservation property tests (BEFORE implementing fix)
  - **Property 2: Preservation** - Non-429 Response Handling Unchanged
  - **IMPORTANT**: Follow observation-first methodology
  - Observe behavior on UNFIXED code for non-buggy inputs (responses that are NOT 429):
    - Observe: `cmGet("/api/artist/123/stat/spotify", token)` with 200 response containing `{ obj: { data: ... } }` → returns `{ data: ... }`
    - Observe: `cmGet("/api/artist/123/stat/spotify", token)` with 200 response containing `{ obj: null }` → returns `null`
    - Observe: `cmGet("/api/artist/123/stat/spotify", token)` with 400 response → returns `null`
    - Observe: `cmGet("/api/artist/123/stat/spotify", token)` with 500 response → returns `null`
    - Observe: `cmGet("/api/artist/123/stat/spotify", token)` with 403 response → returns `null`
    - Observe: `getCmToken()` with valid refresh token → returns access token string
    - Observe: `getCmToken()` without refresh token → returns `null`
  - Write property-based test: for all HTTP responses where status !== 429, the new `ChartmetricClient.get()` produces the same result as the original `cmGet()`:
    - For any 2xx response with JSON body containing `.obj` field → returns the `.obj` value
    - For any 2xx response with JSON body without `.obj` field → returns `null`
    - For any non-429 error status (400, 401, 403, 500, 502, 503) → returns `null`
    - For any network error / fetch exception → returns `null`
  - Write property-based test: `getToken()` produces same result as original `getCmToken()`:
    - Valid refresh token → returns token string
    - Missing refresh token → returns `null`
    - Token endpoint returns error → returns `null`
  - Verify tests PASS on UNFIXED code (using the original `cmGet()` behavior as oracle)
  - **EXPECTED OUTCOME**: Tests PASS (confirms baseline behavior to preserve)
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 3. Create shared ChartmetricClient module

  - [x] 3.1 Create `supabase/functions/_shared/chartmetric-client.ts` with ChartmetricClient class
    - Implement `ChartmetricClientConfig` interface with: `refreshToken`, `maxRetries` (default: 3), `pacingThreshold` (default: 2), `maxBackoffMs` (default: 30000), `interRequestDelayMs` (default: 200)
    - Implement internal state: `remaining: number | null`, `resetAt: number | null`, `consecutiveRetries: number`
    - Implement `getToken(): Promise<string | null>` — authenticate via `/api/token` with refresh token (same logic as existing `getCmToken()` / `cmToken()`)
    - _Bug_Condition: isBugCondition(request) where request does NOT check for 429, ignores rate limit headers, has no pacing, no backoff_
    - _Expected_Behavior: ChartmetricClient reads headers, retries on 429, paces proactively, applies exponential backoff_
    - _Preservation: getToken() returns same results as getCmToken() for all inputs_
    - _Requirements: 2.1, 2.2, 2.5, 3.3_

  - [x] 3.2 Implement 429 detection and retry with `X-RateLimit-Reset`
    - After each `fetch()`, check `response.status === 429`
    - Read `X-RateLimit-Reset` header (epoch seconds) → calculate delay as `resetAt - Date.now()/1000`
    - Sleep for the calculated delay, then retry
    - Maximum of 3 retries per individual request (configurable via `maxRetries`)
    - If all retries exhausted, return `null`
    - _Bug_Condition: hasNo429Handling := request does NOT check for response.status === 429_
    - _Expected_Behavior: On 429, read X-RateLimit-Reset, wait, retry up to maxRetries_
    - _Requirements: 2.1, 2.5_

  - [x] 3.3 Implement proactive pacing using `X-RateLimit-Remaining`
    - After each response (2xx or 429), read `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers
    - Update internal state (`remaining`, `resetAt`)
    - If `remaining <= pacingThreshold` (default: 2), sleep until `resetAt` before next request
    - Implement `waitIfNeeded(): Promise<void>` method for callers to use between batches
    - _Bug_Condition: ignoresRateLimitHeaders := request does NOT read X-RateLimit-Remaining or X-RateLimit-Reset_
    - _Expected_Behavior: When remaining <= threshold, pause until reset window_
    - _Requirements: 2.2, 2.4_

  - [x] 3.4 Implement exponential backoff with jitter
    - Base delay: value from `X-RateLimit-Reset` or 1 second if header is absent
    - Multiplier: `2^attempt` (1s, 2s, 4s, 8s...)
    - Jitter: ±10% random to avoid thundering herd
    - Max delay cap: 30 seconds (configurable via `maxBackoffMs`)
    - _Bug_Condition: noBackoff := on repeated 429 responses, no exponential wait is applied_
    - _Expected_Behavior: Delay between retries grows exponentially with jitter, capped at maxBackoffMs_
    - _Requirements: 2.5_

  - [x] 3.5 Implement `get(path: string): Promise<any | null>` method
    - Authenticated GET with rate-limit handling
    - On 2xx: parse `.obj` from JSON body and return (preserves existing behavior)
    - On non-429 error: return `null` (preserves existing behavior)
    - On 429: trigger retry logic from 3.2
    - After each response: update pacing state from 3.3
    - Apply `interRequestDelayMs` minimum gap between requests
    - _Preservation: For non-429 responses, result is identical to original cmGet()_
    - _Requirements: 2.1, 2.2, 2.5, 3.1, 3.2_

  - [x] 3.6 Implement `sequentialGet(paths: string[]): Promise<(any | null)[]>`
    - Execute requests one at a time with pacing between them based on rate limit state
    - Apply `interRequestDelayMs` between each request
    - Call `waitIfNeeded()` between requests to respect proactive pacing
    - _Bug_Condition: noPacing := concurrentRequests > 1 AND no delay between sequential requests_
    - _Expected_Behavior: Requests execute sequentially with rate-limit-aware delays_
    - _Requirements: 2.3, 2.4_

- [x] 4. Migrate `artist-enrich-chartmetric` to shared module

  - [x] 4.1 Replace local `cmToken()` and `cmGet()` with shared `ChartmetricClient`
    - Import `ChartmetricClient` from `../_shared/chartmetric-client.ts`
    - Instantiate client with `CHARTMETRIC_REFRESH_TOKEN`
    - Replace `cmToken()` call with `client.getToken()`
    - Replace `resolveCmId()` to use `client.get()` instead of local `cmGet()`
    - _Preservation: Authentication flow, error returns, and data structure unchanged_
    - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2, 3.3, 3.5_

  - [x] 4.2 Replace `Promise.all([cmGet(...), ...])` with `client.sequentialGet([...])`
    - Replace the parallel 4-request `Promise.all` (spStat, wpl, social, playlists) with `client.sequentialGet(paths)`
    - Destructure results maintaining same variable names
    - All downstream parsing logic (growth, audience, multiplatform, playlists) remains unchanged
    - _Bug_Condition: Promise.all fires 4 requests simultaneously exceeding sliding window_
    - _Expected_Behavior: Requests execute sequentially with rate-limit-aware pacing_
    - _Preservation: Data extraction, parsing, and persistence logic unchanged_
    - _Requirements: 2.3, 3.1, 3.4, 3.5_

  - [x] 4.3 Remove local `cmGet()`, `cmToken()`, and `resolveCmId()` functions
    - Delete the local function definitions that are now replaced by the shared module
    - Keep all other helper functions (`json`, CORS headers, etc.) intact
    - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Migrate `collect-metrics` to shared module with inter-artist delay

  - [x] 5.1 Replace local `getCmToken()` and `cmGet()` with shared `ChartmetricClient`
    - Import `ChartmetricClient` from `../_shared/chartmetric-client.ts`
    - Instantiate client with `CHARTMETRIC_REFRESH_TOKEN`
    - Replace `getCmToken()` call with `client.getToken()`
    - Replace `resolveCmId()` to use `client.get()` instead of local `cmGet()`
    - _Preservation: Token flow, error handling, and return values unchanged_
    - _Requirements: 2.1, 2.2, 2.4, 3.1, 3.2, 3.3, 3.6_

  - [x] 5.2 Replace `Promise.all` in `fetchMetricsFromChartmetric` with `client.sequentialGet()`
    - Replace the parallel 3-request `Promise.all` (spStat, wpl, artistInfo) with `client.sequentialGet(paths)`
    - Destructure results maintaining same variable names
    - All downstream parsing logic (monthly_listeners, followers, topCities, growthData) remains unchanged
    - _Bug_Condition: Promise.all fires 3 requests per artist × N artists without pacing_
    - _Expected_Behavior: Requests execute sequentially with rate-limit-aware delays_
    - _Preservation: Metrics extraction, delta calculation, and snapshot insertion unchanged_
    - _Requirements: 2.4, 3.1, 3.4_

  - [x] 5.3 Add inter-artist delay in the processing loop
    - After processing each artist in the `for` loop, call `client.waitIfNeeded()`
    - This inserts a dynamic delay based on `X-RateLimit-Remaining` between artists
    - If remaining is low, waits until reset before processing next artist
    - Minimum 500ms delay between artists regardless of rate limit state
    - _Bug_Condition: Batch of 20 artists fires ~60-80 requests without delay_
    - _Expected_Behavior: Inter-artist delay gates throughput on X-RateLimit-Remaining_
    - _Requirements: 2.4_

  - [x] 5.4 Remove local `getCmToken()`, `cmGet()`, and `resolveCmId()` functions
    - Delete the local function definitions that are now replaced by the shared module
    - Keep all other helper functions (`json`, `isProActive`, `fetchEligibleArtists`, `calculateDeltas`, `daysBetween`, etc.) intact
    - _Requirements: 2.1, 2.2, 2.4_

- [x] 6. Verify fix with exploration and preservation tests

  - [x] 6.1 Verify bug condition exploration test now passes
    - **Property 1: Expected Behavior** - Rate Limit Compliance on 429
    - **IMPORTANT**: Re-run the SAME test from task 1 - do NOT write a new test
    - The test from task 1 encodes the expected behavior (retry on 429, read headers, pacing, backoff)
    - When this test passes, it confirms:
      - 429 responses trigger retry with proper delay
      - `X-RateLimit-Reset` header is read and respected
      - Exponential backoff is applied for consecutive 429s
      - Requests are not fired in parallel without pacing
    - Run bug condition exploration test from step 1
    - **EXPECTED OUTCOME**: Test PASSES (confirms bug is fixed)
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

  - [x] 6.2 Verify preservation tests still pass
    - **Property 2: Preservation** - Non-429 Response Handling Unchanged
    - **IMPORTANT**: Re-run the SAME tests from task 2 - do NOT write new tests
    - Run preservation property tests from step 2
    - **EXPECTED OUTCOME**: Tests PASS (confirms no regressions)
    - Confirm:
      - 2xx responses still parse `.obj` and return data
      - Non-429 errors still return `null`
      - Token authentication flow unchanged
      - Data persistence structure unchanged
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6_

- [x] 7. Checkpoint - Ensure all tests pass
  - Run full test suite including exploration and preservation tests
  - Verify no regressions in existing functionality
  - Confirm rate limit compliance works end-to-end
  - Ensure all tests pass, ask the user if questions arise

## Notes

- The shared module file `supabase/functions/_shared/chartmetric-client.ts` is the foundation — all migrations depend on it
- Tests use mocked HTTP responses (no live API calls during testing)
- The Deno runtime in Supabase Edge Functions supports standard `fetch` and `setTimeout`/timers
- Property-based tests should generate random HTTP status codes, header values, and JSON bodies
- Inter-request delay and backoff values are configurable to allow fast test execution with short delays
