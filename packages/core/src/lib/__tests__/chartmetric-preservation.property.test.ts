/**
 * Property-Based Tests for Chartmetric Preservation
 * Feature: chartmetric-rate-limit-compliance
 *
 * Tests the PRESERVATION property: for all HTTP responses where status !== 429,
 * the behavior of cmGet() and getCmToken() must remain unchanged after the fix.
 *
 * These tests run against the UNFIXED (legacy) code and are EXPECTED TO PASS,
 * confirming the baseline behavior that must be preserved.
 *
 * **Validates: Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 3.6**
 */

import * as fc from "fast-check";
import { cmGetLegacy, getCmTokenLegacy } from "../chartmetric-legacy";

// ─── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Creates a mock fetch function that returns a Response with the given status and body.
 */
function mockFetch(status: number, body: any, throwError?: Error): typeof fetch {
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    if (throwError) throw throwError;
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };
}

/**
 * Arbitrary for generating non-429 HTTP error status codes.
 */
const nonRateLimitErrorStatus = fc.constantFrom(400, 401, 403, 404, 500, 502, 503);

/**
 * Arbitrary for generating 2xx success status codes.
 */
const successStatus = fc.constantFrom(200, 201, 202);

/**
 * Arbitrary for generating valid JSON objects to put in the .obj field.
 */
const objFieldValue = fc.oneof(
  fc.record({
    data: fc.array(fc.integer(), { minLength: 0, maxLength: 5 }),
  }),
  fc.record({
    name: fc.string({ minLength: 1, maxLength: 20 }),
    value: fc.integer(),
  }),
  fc.constant({ followers: 1000, listeners: 5000 }),
  fc.array(fc.record({ id: fc.integer(), name: fc.string() }), {
    minLength: 1,
    maxLength: 3,
  }),
  fc.constant("string-value"),
  fc.integer()
);

/**
 * Arbitrary for generating a valid API path.
 */
const apiPath = fc
  .tuple(fc.integer({ min: 1, max: 99999 }), fc.constantFrom("stat", "social", "playlists", "where-people-listen"))
  .map(([id, endpoint]) => `/api/artist/${id}/${endpoint}`);

/**
 * Arbitrary for generating a bearer token string.
 */
const bearerToken = fc
  .hexaString({ minLength: 10, maxLength: 40 })
  .filter((s) => s.length > 0);

// ─── Property Tests: cmGet Preservation ─────────────────────────────────────────

describe("Property 2: Preservation - cmGet Non-429 Response Handling", () => {
  /**
   * Property 2a: For any 2xx response with JSON body containing .obj field,
   * cmGetLegacy returns the .obj value.
   *
   * **Validates: Requirements 3.1**
   */
  test("2xx response with .obj field → returns .obj value", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiPath,
        bearerToken,
        successStatus,
        objFieldValue,
        async (path, token, status, objValue) => {
          const body = { obj: objValue };
          const fetchMock = mockFetch(status, body);
          const result = await cmGetLegacy(path, token, "https://api.chartmetric.com", fetchMock);

          // Original behavior: return (await res.json())?.obj ?? null
          const expected = objValue ?? null;
          expect(result).toEqual(expected);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2b: For any 2xx response with JSON body WITHOUT .obj field,
   * cmGetLegacy returns null.
   *
   * **Validates: Requirements 3.1**
   */
  test("2xx response without .obj field → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiPath,
        bearerToken,
        successStatus,
        fc.record({ data: fc.string(), name: fc.string() }),
        async (path, token, status, bodyWithoutObj) => {
          const fetchMock = mockFetch(status, bodyWithoutObj);
          const result = await cmGetLegacy(path, token, "https://api.chartmetric.com", fetchMock);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2c: For any non-429 error status (400, 401, 403, 500, 502, 503),
   * cmGetLegacy returns null.
   *
   * **Validates: Requirements 3.2**
   */
  test("non-429 error status → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiPath,
        bearerToken,
        nonRateLimitErrorStatus,
        async (path, token, status) => {
          const fetchMock = mockFetch(status, { error: "something went wrong" });
          const result = await cmGetLegacy(path, token, "https://api.chartmetric.com", fetchMock);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2d: For any network error / fetch exception,
   * cmGetLegacy returns null.
   *
   * **Validates: Requirements 3.2**
   */
  test("network error / fetch exception → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiPath,
        bearerToken,
        fc.constantFrom(
          "ECONNREFUSED",
          "ETIMEDOUT",
          "ENOTFOUND",
          "Network request failed",
          "socket hang up"
        ),
        async (path, token, errorMsg) => {
          const fetchMock = mockFetch(0, null, new Error(errorMsg));
          const result = await cmGetLegacy(path, token, "https://api.chartmetric.com", fetchMock);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2e: Comprehensive non-429 status coverage.
   * For ANY HTTP status code that is not 429 and not 2xx, returns null.
   *
   * **Validates: Requirements 3.2**
   */
  test("any non-2xx non-429 status → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        apiPath,
        bearerToken,
        fc
          .integer({ min: 300, max: 599 })
          .filter((s) => s !== 429),
        async (path, token, status) => {
          const fetchMock = mockFetch(status, { obj: { data: "should not be returned" } });
          const result = await cmGetLegacy(path, token, "https://api.chartmetric.com", fetchMock);
          expect(result).toBeNull();
        }
      ),
      { numRuns: 100 }
    );
  });
});

// ─── Property Tests: getCmToken Preservation ────────────────────────────────────

describe("Property 2: Preservation - getCmToken Response Handling", () => {
  /**
   * Property 2f: Valid refresh token with successful response → returns token string.
   *
   * **Validates: Requirements 3.3**
   */
  test("valid refresh token + 200 response → returns token string", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 10, maxLength: 50 }),
        fc.hexaString({ minLength: 10, maxLength: 100 }),
        async (refreshToken, tokenValue) => {
          const fetchMock = mockFetch(200, { token: tokenValue });
          const result = await getCmTokenLegacy(
            refreshToken,
            "https://api.chartmetric.com",
            fetchMock
          );
          expect(result).toBe(tokenValue);
        }
      ),
      { numRuns: 100 }
    );
  });

  /**
   * Property 2g: Missing/null/undefined refresh token → returns null immediately.
   *
   * **Validates: Requirements 3.6**
   */
  test("missing refresh token → returns null without making request", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(null, undefined, ""),
        async (refreshToken) => {
          let fetchCalled = false;
          const fetchMock: typeof fetch = async () => {
            fetchCalled = true;
            return new Response("", { status: 200 });
          };
          const result = await getCmTokenLegacy(
            refreshToken as any,
            "https://api.chartmetric.com",
            fetchMock
          );
          expect(result).toBeNull();
          expect(fetchCalled).toBe(false);
        }
      ),
      { numRuns: 10 }
    );
  });

  /**
   * Property 2h: Token endpoint returns error status → returns null.
   *
   * **Validates: Requirements 3.3**
   */
  test("token endpoint returns error → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 10, maxLength: 50 }),
        fc.constantFrom(400, 401, 403, 500, 502, 503),
        async (refreshToken, errorStatus) => {
          const fetchMock = mockFetch(errorStatus, { error: "auth failed" });
          const result = await getCmTokenLegacy(
            refreshToken,
            "https://api.chartmetric.com",
            fetchMock
          );
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2i: Token endpoint returns 200 but no token field → returns null.
   *
   * **Validates: Requirements 3.3**
   */
  test("token endpoint returns 200 but no token field → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 10, maxLength: 50 }),
        fc.record({ access_key: fc.string(), expires: fc.integer() }),
        async (refreshToken, bodyWithoutToken) => {
          const fetchMock = mockFetch(200, bodyWithoutToken);
          const result = await getCmTokenLegacy(
            refreshToken,
            "https://api.chartmetric.com",
            fetchMock
          );
          expect(result).toBeNull();
        }
      ),
      { numRuns: 50 }
    );
  });

  /**
   * Property 2j: Token endpoint throws network error → returns null.
   *
   * **Validates: Requirements 3.3**
   */
  test("token endpoint network error → returns null", async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.hexaString({ minLength: 10, maxLength: 50 }),
        fc.constantFrom("ECONNREFUSED", "ETIMEDOUT", "Network error"),
        async (refreshToken, errorMsg) => {
          const fetchMock = mockFetch(0, null, new Error(errorMsg));
          const result = await getCmTokenLegacy(
            refreshToken,
            "https://api.chartmetric.com",
            fetchMock
          );
          expect(result).toBeNull();
        }
      ),
      { numRuns: 30 }
    );
  });
});
