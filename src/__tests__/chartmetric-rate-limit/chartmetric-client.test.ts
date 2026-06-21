/**
 * Unit Tests for ChartmetricClient
 * Feature: chartmetric-rate-limit-compliance
 *
 * Validates the shared ChartmetricClient module implementation:
 * - Task 3.1: Class structure and config
 * - Task 3.2: 429 detection and retry
 * - Task 3.3: Proactive pacing
 * - Task 3.4: Exponential backoff with jitter
 * - Task 3.5: get() method behavior
 * - Task 3.6: sequentialGet() method
 *
 * **Validates: Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3**
 */

import { ChartmetricClient, ChartmetricClientConfig } from "../../../supabase/functions/_shared/chartmetric-client";

// ─── Helpers ────────────────────────────────────────────────────────────────────

function createMockFetch(responses: Array<{ status: number; body: any; headers?: Record<string, string> }>): typeof fetch {
  let callIndex = 0;
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    const responseSpec = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(responseSpec.body), {
      status: responseSpec.status,
      headers: {
        "Content-Type": "application/json",
        ...(responseSpec.headers ?? {}),
      },
    });
  };
}

function createTimedMockFetch(timestamps: number[], responses: Array<{ status: number; body: any; headers?: Record<string, string> }>): typeof fetch {
  let callIndex = 0;
  return async (_input: RequestInfo | URL, _init?: RequestInit): Promise<Response> => {
    timestamps.push(Date.now());
    const responseSpec = responses[callIndex] ?? responses[responses.length - 1];
    callIndex++;
    return new Response(JSON.stringify(responseSpec.body), {
      status: responseSpec.status,
      headers: {
        "Content-Type": "application/json",
        ...(responseSpec.headers ?? {}),
      },
    });
  };
}

// ─── Task 3.1: Class Structure and Config ────────────────────────────────────────

describe("Task 3.1: ChartmetricClient class structure", () => {
  test("constructor sets defaults correctly", () => {
    const client = new ChartmetricClient({
      refreshToken: "test-refresh",
      fetchFn: createMockFetch([]),
    });
    expect(client).toBeInstanceOf(ChartmetricClient);
  });

  test("getToken() returns token on successful auth", async () => {
    const mockFetch = createMockFetch([
      { status: 200, body: { token: "access-token-123" } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "my-refresh-token",
      fetchFn: mockFetch,
    });
    const token = await client.getToken();
    expect(token).toBe("access-token-123");
  });

  test("getToken() returns null when refresh token is empty", async () => {
    const client = new ChartmetricClient({
      refreshToken: "",
      fetchFn: createMockFetch([]),
    });
    const token = await client.getToken();
    expect(token).toBeNull();
  });

  test("getToken() returns null on failed auth response", async () => {
    const mockFetch = createMockFetch([
      { status: 401, body: { error: "unauthorized" } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "bad-token",
      fetchFn: mockFetch,
    });
    const token = await client.getToken();
    expect(token).toBeNull();
  });

  test("getToken() returns null on network error", async () => {
    const mockFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const client = new ChartmetricClient({
      refreshToken: "my-token",
      fetchFn: mockFetch,
    });
    const token = await client.getToken();
    expect(token).toBeNull();
  });
});

// ─── Task 3.2: 429 Detection and Retry ──────────────────────────────────────────

describe("Task 3.2: 429 detection and retry", () => {
  test("retries on 429 and returns data after successful retry", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 1;
    const mockFetch = createMockFetch([
      { status: 429, body: { error: "rate limited" }, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 200, body: { obj: { data: "success" } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime + 60) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      maxRetries: 3,
      interRequestDelayMs: 0,
      maxBackoffMs: 2000,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat/spotify");
    expect(result).toEqual({ data: "success" });
  });

  test("returns null after maxRetries exhausted", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 1;
    const mockFetch = createMockFetch([
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      maxRetries: 3,
      interRequestDelayMs: 0,
      maxBackoffMs: 100, // Keep it short for testing
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat/spotify");
    expect(result).toBeNull();
  }, 10000);

  test("uses X-RateLimit-Reset header for delay calculation", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now
    const timestamps: number[] = [];
    const mockFetch = createTimedMockFetch(timestamps, [
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 200, body: { obj: { ok: true } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime + 60) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      maxRetries: 3,
      interRequestDelayMs: 0,
      maxBackoffMs: 5000,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    await client.get("/api/artist/123/stat/spotify");

    expect(timestamps.length).toBe(2);
    const gap = timestamps[1] - timestamps[0];
    // Should wait based on reset header — at least 1 second (2s base minus elapsed, with jitter)
    expect(gap).toBeGreaterThanOrEqual(500);
  }, 10000);
});

// ─── Task 3.3: Proactive Pacing ─────────────────────────────────────────────────

describe("Task 3.3: Proactive pacing", () => {
  test("waitIfNeeded() pauses when remaining <= threshold", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 2; // 2 seconds from now (enough buffer for test setup)
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { a: 1 } }, headers: { "X-RateLimit-Remaining": "1", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { b: 2 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime + 60) } },
    ]);
    const timestamps: number[] = [];
    const wrappedFetch: typeof fetch = async (input, init) => {
      timestamps.push(Date.now());
      return mockFetch(input, init!);
    };

    const client = new ChartmetricClient({
      refreshToken: "token",
      pacingThreshold: 2,
      interRequestDelayMs: 0,
      fetchFn: wrappedFetch,
    });
    client.setToken("access-token");

    // First request: remaining=1 (below threshold)
    await client.get("/api/artist/1/stat");
    // Second request: should pause until resetAt
    await client.get("/api/artist/2/stat");

    expect(timestamps.length).toBe(2);
    const gap = timestamps[1] - timestamps[0];
    // Should wait until resetAt (~1-2 seconds depending on elapsed time)
    expect(gap).toBeGreaterThanOrEqual(800);
  }, 10000);

  test("waitIfNeeded() does not pause when remaining > threshold", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { a: 1 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { b: 2 } }, headers: { "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": String(resetTime) } },
    ]);
    const timestamps: number[] = [];
    const wrappedFetch: typeof fetch = async (input, init) => {
      timestamps.push(Date.now());
      return mockFetch(input, init!);
    };

    const client = new ChartmetricClient({
      refreshToken: "token",
      pacingThreshold: 2,
      interRequestDelayMs: 0,
      fetchFn: wrappedFetch,
    });
    client.setToken("access-token");

    await client.get("/api/artist/1/stat");
    await client.get("/api/artist/2/stat");

    expect(timestamps.length).toBe(2);
    const gap = timestamps[1] - timestamps[0];
    // Should NOT wait a full second — just the inter-request delay (0ms in this config)
    expect(gap).toBeLessThan(500);
  });
});

// ─── Task 3.4: Exponential Backoff ──────────────────────────────────────────────

describe("Task 3.4: Exponential backoff with jitter", () => {
  test("delays increase on consecutive 429 responses", async () => {
    // Use no X-RateLimit-Reset header to force 1s base delay (predictable)
    const timestamps: number[] = [];
    const mockFetch = createTimedMockFetch(timestamps, [
      { status: 429, body: {}, headers: { "X-RateLimit-Remaining": "0" } },
      { status: 429, body: {}, headers: { "X-RateLimit-Remaining": "0" } },
      { status: 200, body: { obj: { done: true } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60) } },
    ]);

    const client = new ChartmetricClient({
      refreshToken: "token",
      maxRetries: 3,
      interRequestDelayMs: 0,
      maxBackoffMs: 10000,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat");
    expect(result).toEqual({ done: true });
    expect(timestamps.length).toBe(3);

    // With no reset header: attempt 0 → 1s * 2^0 = 1s, attempt 1 → 1s * 2^1 = 2s
    const gap1 = timestamps[1] - timestamps[0];
    const gap2 = timestamps[2] - timestamps[1];
    // Second gap should be noticeably larger than first (exponential growth)
    expect(gap2).toBeGreaterThan(gap1 * 1.5); // 2x factor minus jitter tolerance
  }, 15000);

  test("backoff is capped at maxBackoffMs", async () => {
    // Reset time very far in the future to force large base delay
    const resetTime = Math.floor(Date.now() / 1000) + 600;
    const timestamps: number[] = [];
    const mockFetch = createTimedMockFetch(timestamps, [
      { status: 429, body: {}, headers: { "X-RateLimit-Reset": String(resetTime), "X-RateLimit-Remaining": "0" } },
      { status: 200, body: { obj: { ok: true } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime + 60) } },
    ]);

    const maxBackoff = 2000; // 2 seconds cap
    const client = new ChartmetricClient({
      refreshToken: "token",
      maxRetries: 3,
      interRequestDelayMs: 0,
      maxBackoffMs: maxBackoff,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    await client.get("/api/test");

    const gap = timestamps[1] - timestamps[0];
    // Should be capped at ~2s (with some tolerance for jitter and timer imprecision)
    expect(gap).toBeLessThanOrEqual(maxBackoff + 300);
    expect(gap).toBeGreaterThanOrEqual(maxBackoff * 0.85); // jitter lower bound
  }, 10000);
});

// ─── Task 3.5: get() Method Behavior ────────────────────────────────────────────

describe("Task 3.5: get() method preservation and behavior", () => {
  test("returns .obj from 2xx response", async () => {
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { followers: 1000 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat");
    expect(result).toEqual({ followers: 1000 });
  });

  test("returns null for 2xx response without .obj field", async () => {
    const mockFetch = createMockFetch([
      { status: 200, body: { data: "no obj" }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(Math.floor(Date.now() / 1000) + 60) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat");
    expect(result).toBeNull();
  });

  test("returns null for non-429 error status", async () => {
    const mockFetch = createMockFetch([
      { status: 500, body: { error: "internal" }, headers: {} },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat");
    expect(result).toBeNull();
  });

  test("returns null on network error", async () => {
    const errorFetch: typeof fetch = async () => {
      throw new Error("ECONNREFUSED");
    };
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: errorFetch,
    });
    client.setToken("access-token");

    const result = await client.get("/api/artist/123/stat");
    expect(result).toBeNull();
  });

  test("returns null when no token is set", async () => {
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { data: "test" } } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    // Don't set a token
    const result = await client.get("/api/artist/123/stat");
    expect(result).toBeNull();
  });

  test("applies interRequestDelayMs between requests", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    const timestamps: number[] = [];
    const mockFetch = createTimedMockFetch(timestamps, [
      { status: 200, body: { obj: { a: 1 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { b: 2 } }, headers: { "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": String(resetTime) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 200,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    await client.get("/api/artist/1/stat");
    await client.get("/api/artist/2/stat");

    const gap = timestamps[1] - timestamps[0];
    expect(gap).toBeGreaterThanOrEqual(180); // 200ms with small tolerance
  });
});

// ─── Task 3.6: sequentialGet() ──────────────────────────────────────────────────

describe("Task 3.6: sequentialGet()", () => {
  test("executes requests sequentially and returns results in order", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { id: 1 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { id: 2 } }, headers: { "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { id: 3 } }, headers: { "X-RateLimit-Remaining": "48", "X-RateLimit-Reset": String(resetTime) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const results = await client.sequentialGet(["/path/1", "/path/2", "/path/3"]);
    expect(results).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  test("requests are NOT fired simultaneously (sequential execution)", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    const timestamps: number[] = [];
    const mockFetch = createTimedMockFetch(timestamps, [
      { status: 200, body: { obj: { a: 1 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { b: 2 } }, headers: { "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { c: 3 } }, headers: { "X-RateLimit-Remaining": "48", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { d: 4 } }, headers: { "X-RateLimit-Remaining": "47", "X-RateLimit-Reset": String(resetTime) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 50,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    await client.sequentialGet(["/p/1", "/p/2", "/p/3", "/p/4"]);

    expect(timestamps.length).toBe(4);
    // Total spread should be > 100ms (at least 3 gaps of 50ms each)
    const spread = timestamps[3] - timestamps[0];
    expect(spread).toBeGreaterThan(100);
  });

  test("handles empty paths array", async () => {
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: createMockFetch([]),
    });
    client.setToken("access-token");

    const results = await client.sequentialGet([]);
    expect(results).toEqual([]);
  });

  test("returns null for failed requests within sequence", async () => {
    const resetTime = Math.floor(Date.now() / 1000) + 60;
    const mockFetch = createMockFetch([
      { status: 200, body: { obj: { id: 1 } }, headers: { "X-RateLimit-Remaining": "50", "X-RateLimit-Reset": String(resetTime) } },
      { status: 500, body: { error: "fail" }, headers: { "X-RateLimit-Remaining": "49", "X-RateLimit-Reset": String(resetTime) } },
      { status: 200, body: { obj: { id: 3 } }, headers: { "X-RateLimit-Remaining": "48", "X-RateLimit-Reset": String(resetTime) } },
    ]);
    const client = new ChartmetricClient({
      refreshToken: "token",
      interRequestDelayMs: 0,
      fetchFn: mockFetch,
    });
    client.setToken("access-token");

    const results = await client.sequentialGet(["/path/1", "/path/2", "/path/3"]);
    expect(results).toEqual([{ id: 1 }, null, { id: 3 }]);
  });
});
