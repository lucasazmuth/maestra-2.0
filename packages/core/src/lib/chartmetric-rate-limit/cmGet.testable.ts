/**
 * Testable extraction of the `cmGet()` function from the Edge Functions.
 *
 * This mirrors the CURRENT (buggy) implementation exactly:
 * - Does NOT check for HTTP 429
 * - Does NOT read rate limit headers
 * - Does NOT retry on failure
 * - Returns `null` for any non-ok response
 *
 * This module exists so Jest can import and test the behavior
 * without needing Deno runtime or live Edge Function environment.
 */

const CM_BASE = "https://api.chartmetric.com";

/**
 * Performs an authenticated GET request to the Chartmetric API.
 * Current (buggy) behavior: returns null on ANY non-ok response including 429.
 *
 * @param fetchFn - Injectable fetch function (for testability)
 */
export async function cmGet(
  path: string,
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<any | null> {
  try {
    const res = await fetchFn(`${CM_BASE}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json())?.obj ?? null;
  } catch (e) {
    console.error("cmGet", path, (e as Error).message);
    return null;
  }
}

/**
 * Executes multiple cmGet calls in parallel (current buggy behavior).
 * No pacing, no concurrency control, no rate limit awareness.
 */
export async function cmGetParallel(
  paths: string[],
  token: string,
  fetchFn: typeof fetch = fetch
): Promise<(any | null)[]> {
  return Promise.all(paths.map((path) => cmGet(path, token, fetchFn)));
}
