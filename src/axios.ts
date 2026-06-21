import Axios from 'axios';
import { getSpotifyToken, refreshSpotifyToken } from './lib/spotifyToken';
import { cacheGet, cacheSet } from './utils/cache';

const path = 'https://api.spotify.com/v1' as const;

const axios = Axios.create({
  baseURL: path,
  headers: {},
});

// --- Global concurrency limiter --------------------------------------------------------------
// Several screens (Home, Artist) fan out many requests at once, and dev StrictMode doubles
// them. Spotify's tightened Feb-2026 rate limits 429 on those bursts. Cap how many requests are
// in flight at once so traffic is smoothed instead of bursted; the rest queue and drain as
// slots free up. Combined with the 429 backoff below, this keeps the app under the limit.
const MAX_CONCURRENT = 3;
let activeRequests = 0;
const waiters: Array<() => void> = [];

const acquireSlot = () =>
  new Promise<void>((resolve) => {
    if (activeRequests < MAX_CONCURRENT) {
      activeRequests++;
      resolve();
    } else {
      waiters.push(() => {
        activeRequests++;
        resolve();
      });
    }
  });

const releaseSlot = () => {
  activeRequests = Math.max(0, activeRequests - 1);
  waiters.shift()?.();
};

// --- IndexedDB response cache ----------------------------------------------------------------
// Catalog data (artists/albums/tracks) is immutable, so cache GETs of it in IndexedDB and serve
// from there on repeat views and across reloads. This is the real fix for the rate limiting:
// navigating back to a page, or hard-refreshing, no longer re-hits the network. Only static
// catalog GETs are cached — user state (/me/*), search, and all mutations always hit the API.
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // catalog is static; 24h is safe
const CACHEABLE_PATH = /^\/(artists|albums|tracks)(\/|$)/;

const isCacheableGet = (config: any) =>
  (config.method || 'get').toLowerCase() === 'get' && CACHEABLE_PATH.test(config.url || '');

const cacheKeyFor = (config: any) =>
  `${config.url}?${JSON.stringify(config.params || {})}`;

axios.interceptors.request.use(async (config) => {
  await acquireSlot();

  // Token app-only do Spotify (Client Credentials), obtido via Edge Function spotify-app-token.
  const token = await getSpotifyToken();
  if (token) {
    config.headers = config.headers || {};
    (config.headers as any)['Authorization'] = 'Bearer ' + token;
  }

  if (isCacheableGet(config)) {
    const key = cacheKeyFor(config);
    const entry = await cacheGet(key);
    if (entry && entry.expiry > Date.now()) {
      // Cache hit — short-circuit the network by serving from a one-off adapter. The response
      // still flows through the response interceptor below (so the slot is released normally).
      (config as any).adapter = async () => ({
        data: entry.data,
        status: 200,
        statusText: 'OK (cache)',
        headers: {},
        config,
        request: {},
      });
    } else {
      // Mark for storing once the network response comes back.
      (config as any).__cacheKey = key;
    }
  }

  return config;
});

axios.interceptors.response.use(
  (response) => {
    releaseSlot();

    const key = (response.config as any).__cacheKey;
    if (key && response.status === 200) {
      void cacheSet(key, { data: response.data, expiry: Date.now() + CACHE_TTL_MS });
    }
    return response;
  },
  async (error) => {
    // Release this attempt's slot first so a retry (and other queued requests) can proceed.
    releaseSlot();

    const response = error?.response;
    const config = error?.config;

    // Network error / no response — nothing to recover from.
    if (!response || !config) return Promise.reject(error);

    if (response.status === 401 && !config.__retriedAuth) {
      config.__retriedAuth = true;
      const token = await refreshSpotifyToken();
      if (!token) return Promise.reject(error);
      config.headers = config.headers || {};
      config.headers['Authorization'] = 'Bearer ' + token;
      return axios(config);
    }

    // 429 Too Many Requests: Spotify's tightened (Feb 2026) rate limits are easy to trip when
    // a page fires a burst of calls (and dev StrictMode doubles them). Back off for the
    // server-specified `Retry-After`, then retry — bounded so we never loop forever.
    if (response.status === 429) {
      config.__retryCount = (config.__retryCount || 0) + 1;
      // Only one retry: during a global cooldown, re-issuing many times just adds load and
      // prolongs the penalty window.
      if (config.__retryCount > 1) return Promise.reject(error);
      const retryAfter = Number(response.headers?.['retry-after']);
      const waitMs = Math.min((Number.isFinite(retryAfter) ? retryAfter : 1) * 1000, 10000);
      await new Promise((resolve) => setTimeout(resolve, Math.max(waitMs, 500)));
      return axios(config);
    }

    // 502/503/504 — Spotify occasionally returns transient server errors. Retry up to 2 times
    // with exponential backoff before surfacing the failure to the UI.
    if ([502, 503, 504].includes(response.status)) {
      config.__serverRetryCount = (config.__serverRetryCount || 0) + 1;
      if (config.__serverRetryCount > 2) return Promise.reject(error);
      const backoffMs = config.__serverRetryCount * 1500; // 1.5s, 3s
      await new Promise((resolve) => setTimeout(resolve, backoffMs));
      return axios(config);
    }

    return Promise.reject(error);
  }
);

export default axios;
