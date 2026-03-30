/** Simple SWR-style cache for stock data with localStorage persistence */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const CACHE_DURATIONS = {
  financials: 60 * 60 * 1000,  // 1 hour
  news: 60 * 60 * 1000,        // 1 hour
  quotes: 5 * 1000,            // 5 seconds
} as const;

type CacheType = keyof typeof CACHE_DURATIONS;

function cacheKey(type: CacheType, ticker: string): string {
  return `alphamap_${type}_${ticker}`;
}

export function getCached<T>(type: CacheType, ticker: string): T | null {
  try {
    const raw = localStorage.getItem(cacheKey(type, ticker));
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.timestamp > CACHE_DURATIONS[type]) {
      localStorage.removeItem(cacheKey(type, ticker));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCache<T>(type: CacheType, ticker: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    localStorage.setItem(cacheKey(type, ticker), JSON.stringify(entry));
  } catch {
    // localStorage full – silently ignore
  }
}

/** Pre-fetch financials for a ticker (called on hover) */
export function prefetchFinancials(ticker: string): void {
  const upper = ticker.toUpperCase().replace(/\.TA$/i, "");
  if (getCached("financials", upper)) return; // already cached

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !anonKey) return;

  fetch(
    `https://${projectId}.supabase.co/functions/v1/fetch-financials?ticker=${upper}`,
    { headers: { apikey: anonKey, "Content-Type": "application/json" } }
  )
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data) setCache("financials", upper, data);
    })
    .catch(() => {});
}

/** Pre-fetch news for a ticker (called on hover) */
export function prefetchNews(ticker: string): void {
  const upper = ticker.toUpperCase().replace(/\.TA$/i, "");
  if (getCached("news", upper)) return;

  const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!projectId || !anonKey) return;

  fetch(
    `https://${projectId}.supabase.co/functions/v1/fetch-news?ticker=${upper}`,
    { headers: { apikey: anonKey, "Content-Type": "application/json" } }
  )
    .then((r) => r.ok ? r.json() : null)
    .then((data) => {
      if (data) setCache("news", upper, data);
    })
    .catch(() => {});
}
