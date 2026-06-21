/**
 * Shared Chartmetric HTTP Client with Rate-Limit Compliance
 *
 * This module replaces the duplicated `cmGet()` / `getCmToken()` functions in
 * `artist-enrich-chartmetric` and `collect-metrics` Edge Functions.
 *
 * Features:
 * - 429 detection and retry with X-RateLimit-Reset (Task 3.2)
 * - Proactive pacing using X-RateLimit-Remaining (Task 3.3)
 * - Exponential backoff with jitter (Task 3.4)
 * - Authenticated GET with rate-limit handling (Task 3.5)
 * - Sequential execution with pacing (Task 3.6)
 *
 * Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 3.1, 3.2, 3.3
 */

const CM_BASE = "https://api.chartmetric.com";

// ─── Configuration Interface (Task 3.1) ─────────────────────────────────────────

export interface ChartmetricClientConfig {
  refreshToken: string;
  maxRetries?: number;          // default: 3
  pacingThreshold?: number;     // default: 2 (remaining requests before proactive pause)
  maxBackoffMs?: number;        // default: 30000
  interRequestDelayMs?: number; // default: 200 (minimum gap between requests)
  /** Injectable fetch function for testability */
  fetchFn?: typeof fetch;
  /**
   * Hook chamado uma vez por chamada GET de dados (não inclui o token), para logging de consumo.
   * Fire-and-forget — não deve lançar nem retornar Promise aguardada.
   */
  onCall?: (entry: { endpoint: string; ok: boolean; statusCode: number | null; durationMs: number }) => void;
}

// ─── ChartmetricClient Class ─────────────────────────────────────────────────────

export class ChartmetricClient {
  private readonly refreshToken: string;
  private readonly maxRetries: number;
  private readonly pacingThreshold: number;
  private readonly maxBackoffMs: number;
  private readonly interRequestDelayMs: number;
  private readonly fetchFn: typeof fetch;
  private readonly onCall?: ChartmetricClientConfig["onCall"];

  // Internal rate-limit state (Task 3.1)
  private remaining: number | null = null;
  private resetAt: number | null = null;
  private consecutiveRetries: number = 0;

  // Track last request time for inter-request delay
  private lastRequestTime: number = 0;

  // Cached access token
  private accessToken: string | null = null;

  constructor(config: ChartmetricClientConfig) {
    this.refreshToken = config.refreshToken;
    this.maxRetries = config.maxRetries ?? 3;
    this.pacingThreshold = config.pacingThreshold ?? 2;
    this.maxBackoffMs = config.maxBackoffMs ?? 30000;
    this.interRequestDelayMs = config.interRequestDelayMs ?? 200;
    this.fetchFn = config.fetchFn ?? fetch;
    this.onCall = config.onCall;
  }

  /** Notifica o hook de logging sem nunca quebrar o fluxo. */
  private report(endpoint: string, ok: boolean, statusCode: number | null, startedAt: number): void {
    if (!this.onCall) return;
    try {
      this.onCall({ endpoint, ok, statusCode, durationMs: Date.now() - startedAt });
    } catch {
      /* logging nunca afeta a chamada */
    }
  }

  // ─── Token Management (Task 3.1) ───────────────────────────────────────────────

  /**
   * Obtém access token via refresh token.
   * Preserves original getCmToken() / cmToken() behavior:
   * - If no refresh token: return null
   * - On successful POST to /api/token: return data.token or null
   * - On non-2xx response: return null
   * - On network error: return null
   */
  async getToken(): Promise<string | null> {
    if (!this.refreshToken) return null;
    try {
      const res = await this.fetchFn(`${CM_BASE}/api/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refreshtoken: this.refreshToken }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const token = data.token ?? null;
      this.accessToken = token;
      return token;
    } catch (e) {
      return null;
    }
  }

  // ─── Proactive Pacing (Task 3.3) ───────────────────────────────────────────────

  /**
   * Updates internal rate-limit state from response headers.
   * Called after every response (2xx or 429).
   */
  private updateRateLimitState(response: Response): void {
    const remainingHeader = response.headers.get("X-RateLimit-Remaining");
    const resetHeader = response.headers.get("X-RateLimit-Reset");

    if (remainingHeader !== null) {
      const parsed = parseInt(remainingHeader, 10);
      if (!isNaN(parsed)) {
        this.remaining = parsed;
      }
    }

    if (resetHeader !== null) {
      const parsed = parseFloat(resetHeader);
      if (!isNaN(parsed)) {
        this.resetAt = parsed;
      }
    }
  }

  /**
   * Pauses if remaining quota is at or below the pacing threshold.
   * Callers should invoke this between batches or between artists in a loop.
   */
  async waitIfNeeded(): Promise<void> {
    if (
      this.remaining !== null &&
      this.resetAt !== null &&
      this.remaining <= this.pacingThreshold
    ) {
      const nowSec = Date.now() / 1000;
      const delayMs = Math.max(0, (this.resetAt - nowSec) * 1000);
      if (delayMs > 0) {
        await this.sleep(delayMs);
      }
      // After waiting, reset state so we don't re-wait unnecessarily
      this.remaining = null;
      this.resetAt = null;
    }
  }

  // ─── Exponential Backoff with Jitter (Task 3.4) ─────────────────────────────────

  /**
   * Calculates the delay for a retry attempt using exponential backoff with jitter.
   *
   * - Base delay: value from X-RateLimit-Reset or 1 second if header is absent
   * - Multiplier: 2^attempt (1s, 2s, 4s, 8s...)
   * - Jitter: ±10% random to avoid thundering herd
   * - Max delay cap: maxBackoffMs (default 30s)
   */
  private calculateBackoffDelay(attempt: number, resetAtEpoch: number | null): number {
    // Base delay from X-RateLimit-Reset header or 1 second fallback
    let baseDelayMs: number;
    if (resetAtEpoch !== null) {
      const nowSec = Date.now() / 1000;
      baseDelayMs = Math.max(0, (resetAtEpoch - nowSec) * 1000);
      // If the reset time is in the past or 0, use 1 second fallback
      if (baseDelayMs <= 0) {
        baseDelayMs = 1000;
      }
    } else {
      baseDelayMs = 1000;
    }

    // Exponential multiplier: 2^attempt
    const multiplier = Math.pow(2, attempt);
    let delayMs = baseDelayMs * multiplier;

    // Apply jitter: ±10%
    const jitterFactor = 1 + (Math.random() * 0.2 - 0.1); // 0.9 to 1.1
    delayMs = delayMs * jitterFactor;

    // Cap at maxBackoffMs
    delayMs = Math.min(delayMs, this.maxBackoffMs);

    return delayMs;
  }

  // ─── Core GET Method (Task 3.5) ─────────────────────────────────────────────────

  /**
   * Authenticated GET with rate-limit handling.
   *
   * - On 2xx: parse `.obj` from JSON body and return (preserves existing behavior)
   * - On non-429 error: return `null` (preserves existing behavior)
   * - On 429: trigger retry logic with exponential backoff
   * - After each response: update pacing state
   * - Apply interRequestDelayMs minimum gap between requests
   *
   * Preservation: For non-429 responses, result is identical to original cmGet()
   */
  async get(path: string): Promise<any | null> {
    // Ensure we have a token
    if (!this.accessToken) {
      return null;
    }

    // Apply inter-request delay
    await this.applyInterRequestDelay();

    // Proactive pacing: wait if remaining is low before making request
    await this.waitIfNeeded();

    const startedAt = Date.now();
    let attempt = 0;

    while (attempt <= this.maxRetries) {
      try {
        const res = await this.fetchFn(`${CM_BASE}${path}`, {
          headers: { Authorization: `Bearer ${this.accessToken}` },
        });

        // Record request time
        this.lastRequestTime = Date.now();

        // Update rate-limit state from response headers (Task 3.3)
        this.updateRateLimitState(res);

        // 429 detection and retry (Task 3.2)
        if (res.status === 429) {
          attempt++;
          this.consecutiveRetries = attempt;

          if (attempt > this.maxRetries) {
            // All retries exhausted — return null
            this.consecutiveRetries = 0;
            this.report(path, false, 429, startedAt);
            return null;
          }

          // Calculate backoff delay using X-RateLimit-Reset
          const resetHeader = res.headers.get("X-RateLimit-Reset");
          const resetEpoch = resetHeader !== null ? parseFloat(resetHeader) : null;
          const delayMs = this.calculateBackoffDelay(attempt - 1, resetEpoch);

          await this.sleep(delayMs);
          continue;
        }

        // Success path: reset consecutive retries
        this.consecutiveRetries = 0;

        // Non-429 error: return null (preserves original cmGet() behavior)
        if (!res.ok) {
          this.report(path, false, res.status, startedAt);
          return null;
        }

        // 2xx: parse .obj from JSON body (preserves original cmGet() behavior)
        const json = await res.json();
        this.report(path, true, res.status, startedAt);
        return json?.obj ?? null;
      } catch (e) {
        // Network error / exception: return null (preserves original cmGet() behavior)
        this.consecutiveRetries = 0;
        this.report(path, false, null, startedAt);
        return null;
      }
    }

    // Should not reach here, but safety net
    this.consecutiveRetries = 0;
    return null;
  }

  // ─── Sequential GET (Task 3.6) ─────────────────────────────────────────────────

  /**
   * Execute requests one at a time with pacing between them.
   *
   * - Apply interRequestDelayMs between each request
   * - Call waitIfNeeded() between requests to respect proactive pacing
   */
  async sequentialGet(paths: string[]): Promise<(any | null)[]> {
    const results: (any | null)[] = [];

    for (let i = 0; i < paths.length; i++) {
      // Wait if rate-limit state indicates we should pause
      if (i > 0) {
        await this.waitIfNeeded();
      }

      const result = await this.get(paths[i]);
      results.push(result);
    }

    return results;
  }

  // ─── Internal Helpers ───────────────────────────────────────────────────────────

  /**
   * Applies the minimum inter-request delay to avoid bursting.
   */
  private async applyInterRequestDelay(): Promise<void> {
    if (this.lastRequestTime > 0) {
      const elapsed = Date.now() - this.lastRequestTime;
      const remaining = this.interRequestDelayMs - elapsed;
      if (remaining > 0) {
        await this.sleep(remaining);
      }
    }
  }

  /**
   * Sleep helper using standard setTimeout.
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Set the access token directly (useful after calling getToken()).
   */
  setToken(token: string): void {
    this.accessToken = token;
  }
}
