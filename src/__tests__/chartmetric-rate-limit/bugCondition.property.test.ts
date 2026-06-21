/**
 * Bug Condition Exploration Property Test
 * Feature: chartmetric-rate-limit-compliance
 *
 * Property 1: Expected Behavior - Rate Limit Compliance on 429
 *
 * These tests encode the EXPECTED (correct) behavior for the ChartmetricClient.
 * They were originally written to FAIL on the unfixed code (confirming the bug).
 * Now they should PASS on the fixed ChartmetricClient implementation.
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5**
 */

import * as fc from "fast-check";
import { ChartmetricClient } from "../../../supabase/functions/_shared/chartmetric-client";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Creates a mock fetch function that returns 429 on the first N calls,
 * then returns a successful response with the given data.
 * Uses a reset timestamp very close to now so delays are minimal for testing.
 */
function createMockFetchWith429ThenSuccess(
  numFailures: number,
  successData: any,
  resetTimestamp: number
): typeof fetch {
  let callCount = 0;
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    callCount++;
    if (callCount <= numFailures) {
      return new Response(JSON.stringify({ error: "Too Many Requests" }), {
        status: 429,
        headers: {
          "X-RateLimit-Limit": "100",
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(resetTimestamp),
        },
      });
    }
    return new Response(JSON.stringify({ obj: successData }), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "X-RateLimit-Limit": "100",
        "X-RateLimit-Remaining": "50",
        "X-RateLimit-Reset": String(resetTimestamp + 60),
      },
    });
  };
}

/**
 * Creates a mock fetch that records timestamps of each call.
 */
function createTimingMockFetch(
  timestamps: number[],
  responseData: any
): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    timestamps.push(Date.now());
    return new Response(JSON.stringify({ obj: responseData }), {
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

// ─── Property Tests ─────────────────────────────────────────────────────────────

/**
 * Property 1.1: When receiving HTTP 429 with X-RateLimit-Reset header,
 * ChartmetricClient.get() SHOULD retry after waiting and return the successful response (not null).
 *
 * **Validates: Requirements 2.1, 2.5**
 */
describe("Property 1.1: cmGet retries on 429 and returns data (not null)", () => {
  test("for any valid path and token, when API returns 429 then 200, client.get returns data", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate random API paths
        fc.integer({ min: 1, max: 99999 }).map((id) => `/api/artist/${id}/stat/spotify`),
        // Generate random response data
        fc.record({
          listeners: fc.nat(1_000_000),
          followers: fc.nat(10_000_000),
        }),
        async (path, expectedData) => {
          // Reset timestamp in the past so backoff uses 1s fallback, capped by maxBackoffMs
          const resetTimestamp = Math.floor(Date.now() / 1000);
          const mockFetch = createMockFetchWith429ThenSuccess(
            1,
            expectedData,
            resetTimestamp
          );

          const client = new ChartmetricClient({
            refreshToken: "test-refresh",
            maxRetries: 3,
            interRequestDelayMs: 0,
            maxBackoffMs: 500, // Cap backoff at 500ms for fast tests
            fetchFn: mockFetch,
          });
          client.setToken("test-token");

          const result = await client.get(path);

          // EXPECTED: client should retry after 429 and return the data
          expect(result).not.toBeNull();
          expect(result).toEqual(expectedData);
        }
      ),
      { numRuns: 20 }
    );
  }, 30000);
});

/**
 * Property 1.2: When X-RateLimit-Remaining <= 2, the next request should be
 * delayed until X-RateLimit-Reset timestamp (proactive pacing).
 *
 * **Validates: Requirements 2.2**
 */
describe("Property 1.2: Proactive pacing when X-RateLimit-Remaining is low", () => {
  test("when remaining <= 2, next request is delayed until reset time", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate remaining values in range [0, 2]
        fc.integer({ min: 0, max: 2 }),
        // Generate response data
        fc.record({
          data: fc.string({ minLength: 1, maxLength: 20 }),
        }),
        async (remaining, responseData) => {
          // Reset 1.5 seconds from now — enough to measure but within timeout
          const resetTimestamp = Math.floor(Date.now() / 1000) + 1.5;
          const timestamps: number[] = [];

          // Mock fetch that records timestamps and returns low remaining
          const mockFetch: typeof fetch = async (
            input: RequestInfo | URL,
            init?: RequestInit
          ): Promise<Response> => {
            timestamps.push(Date.now());
            return new Response(JSON.stringify({ obj: responseData }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "X-RateLimit-Limit": "100",
                "X-RateLimit-Remaining": String(remaining),
                "X-RateLimit-Reset": String(resetTimestamp),
              },
            });
          };

          const client = new ChartmetricClient({
            refreshToken: "test-refresh",
            pacingThreshold: 2,
            interRequestDelayMs: 0,
            maxBackoffMs: 5000,
            fetchFn: mockFetch,
          });
          client.setToken("test-token");

          // Make two sequential requests
          await client.get("/api/artist/123/stat/spotify");
          await client.get("/api/artist/456/stat/spotify");

          // EXPECTED: Second request should be delayed until resetTimestamp
          if (timestamps.length >= 2) {
            const gap = timestamps[1] - timestamps[0];
            // With remaining <= 2, there should be a meaningful delay (at least 500ms)
            expect(gap).toBeGreaterThanOrEqual(500);
          }
        }
      ),
      { numRuns: 5 }
    );
  }, 30000);
});

/**
 * Property 1.3: Parallel requests via sequentialGet should NOT fire simultaneously.
 * Bounded concurrency means requests are paced with delays between them.
 *
 * **Validates: Requirements 2.3, 2.4**
 */
describe("Property 1.3: Parallel requests are bounded/sequenced (not simultaneous)", () => {
  test("4 requests via sequentialGet do NOT all fire within 10ms", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate response data for each request
        fc.array(
          fc.record({ value: fc.nat(1000) }),
          { minLength: 4, maxLength: 4 }
        ),
        async (responseDatas) => {
          const timestamps: number[] = [];
          const mockFetch = createTimingMockFetch(timestamps, responseDatas[0]);

          const paths = [
            "/api/artist/100/stat/spotify",
            "/api/artist/100/where-people-listen",
            "/api/artist/100/social-audience-stats",
            "/api/artist/100/spotify/current/playlists",
          ];

          const client = new ChartmetricClient({
            refreshToken: "test-refresh",
            interRequestDelayMs: 50,
            fetchFn: mockFetch,
          });
          client.setToken("test-token");

          await client.sequentialGet(paths);

          // EXPECTED: Requests should be paced — total spread > 10ms
          expect(timestamps.length).toBe(4);
          const spread = timestamps[timestamps.length - 1] - timestamps[0];
          expect(spread).toBeGreaterThan(10);
        }
      ),
      { numRuns: 10 }
    );
  }, 15000);
});

/**
 * Property 1.4: When receiving multiple consecutive 429 responses,
 * exponential backoff should be applied between retries.
 *
 * **Validates: Requirements 2.5**
 */
describe("Property 1.4: Exponential backoff on consecutive 429 responses", () => {
  test("consecutive 429s result in non-null return after retries with backoff", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate number of consecutive 429s before success (1-3)
        fc.integer({ min: 1, max: 3 }),
        fc.record({ result: fc.string({ minLength: 1, maxLength: 10 }) }),
        async (numFailures, successData) => {
          // Reset in the past so fallback delay (1s) is used, capped by maxBackoffMs
          const resetTimestamp = Math.floor(Date.now() / 1000);
          const mockFetch = createMockFetchWith429ThenSuccess(
            numFailures,
            successData,
            resetTimestamp
          );

          const client = new ChartmetricClient({
            refreshToken: "test-refresh",
            maxRetries: 3,
            interRequestDelayMs: 0,
            maxBackoffMs: 500, // Cap backoff at 500ms for fast tests
            fetchFn: mockFetch,
          });
          client.setToken("test-token");

          const result = await client.get("/api/artist/123/stat/spotify");

          // EXPECTED: After retrying through the 429s, should return data
          expect(result).not.toBeNull();
          expect(result).toEqual(successData);
        }
      ),
      { numRuns: 10 }
    );
  }, 30000);
});
