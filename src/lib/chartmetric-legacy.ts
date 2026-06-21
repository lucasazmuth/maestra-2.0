/**
 * Chartmetric Legacy Functions (Testable Extraction)
 *
 * These are pure extractions of the original cmGet() and getCmToken() logic
 * from the Edge Functions, adapted for testability in Jest.
 * They encode the CURRENT (unfixed) behavior to serve as an oracle for
 * preservation property tests.
 *
 * The original code lives in:
 * - supabase/functions/artist-enrich-chartmetric/index.ts
 * - supabase/functions/collect-metrics/index.ts
 */

/**
 * Original cmGet() logic — authenticated GET to Chartmetric API.
 * Behavior:
 * - On 2xx: parse JSON, return .obj field (or null if absent)
 * - On any non-2xx (including 429): return null
 * - On network error / exception: return null
 */
export async function cmGetLegacy(
  path: string,
  token: string,
  baseUrl: string = "https://api.chartmetric.com",
  fetchFn: typeof fetch = fetch
): Promise<any | null> {
  try {
    const res = await fetchFn(`${baseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    return (await res.json())?.obj ?? null;
  } catch (e) {
    return null;
  }
}

/**
 * Original getCmToken() logic — obtain access token via refresh token.
 * Behavior:
 * - If no refresh token: return null
 * - On successful POST to /api/token: return data.token or null
 * - On non-2xx response: return null
 * - On network error / exception: return null
 */
export async function getCmTokenLegacy(
  refreshToken: string | null | undefined,
  baseUrl: string = "https://api.chartmetric.com",
  fetchFn: typeof fetch = fetch
): Promise<string | null> {
  if (!refreshToken) return null;
  try {
    const res = await fetchFn(`${baseUrl}/api/token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshtoken: refreshToken }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.token ?? null;
  } catch (e) {
    return null;
  }
}
