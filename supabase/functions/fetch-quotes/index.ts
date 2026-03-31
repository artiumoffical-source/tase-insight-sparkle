import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toNis(raw: number): number {
  return raw > 1000 ? raw / 100 : raw;
}

function isSaneChange(change: number): boolean {
  return Math.abs(change) <= 50;
}

// --- In-memory micro-cache (1.5s TTL) ---
interface CacheEntry {
  data: { price: number; change: number; source: string };
  ts: number;
}
const quoteCache = new Map<string, CacheEntry>();
const CACHE_TTL = 1500; // ms

function getCached(symbol: string): CacheEntry["data"] | null {
  const e = quoteCache.get(symbol);
  if (e && Date.now() - e.ts < CACHE_TTL) return e.data;
  return null;
}

function putCache(symbol: string, data: CacheEntry["data"]) {
  quoteCache.set(symbol, { data, ts: Date.now() });
  // Evict old entries periodically
  if (quoteCache.size > 200) {
    const now = Date.now();
    for (const [k, v] of quoteCache) {
      if (now - v.ts > CACHE_TTL * 4) quoteCache.delete(k);
    }
  }
}

async function fetchFromEodhd(symbol: string, apiKey: string): Promise<{ price: number; change: number } | null> {
  try {
    const resp = await fetch(`https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`);
    if (resp.status === 429) { console.warn(`EODHD 429 for ${symbol}`); return null; }
    if (resp.ok) {
      const data = await resp.json();
      const rawPrice = Number(data?.close) || Number(data?.last) || Number(data?.previousClose) || Number(data?.open) || 0;
      if (rawPrice > 0) {
        const price = toNis(rawPrice);
        const change = Math.round((Number(data?.change_p) || 0) * 100) / 100;
        if (!isSaneChange(change)) return null;
        return { price, change };
      }
    } else { await resp.text(); }
  } catch { /* fall through */ }

  try {
    const resp = await fetch(`https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&order=d&limit=2`);
    if (resp.ok) {
      const days = await resp.json();
      if (Array.isArray(days) && days.length >= 2) {
        const rawPrice = Number(days[0].adjusted_close) || Number(days[0].close) || 0;
        const prevRaw = Number(days[1].adjusted_close) || Number(days[1].close) || 0;
        if (rawPrice > 0 && prevRaw > 0) {
          const price = toNis(rawPrice);
          const prev = toNis(prevRaw);
          const change = Math.round(((price - prev) / prev) * 10000) / 100;
          if (!isSaneChange(change)) return null;
          return { price, change };
        }
      }
    } else { await resp.text(); }
  } catch { /* fall through */ }

  return null;
}

async function fetchFromYahoo(symbol: string, ticker: string): Promise<{ price: number; change: number } | null> {
  try {
    const indexMap: Record<string, string> = {
      "TA35": "TA35.TA", "TA90": "TA90.TA", "TABANKS": "TA-BANKS.TA", "TATECH": "TA-TECH.TA",
    };
    const yahooSymbol = indexMap[ticker] || symbol;
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d&_ts=${Date.now()}`,
      { headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaMap/1.0)" } }
    );
    if (!resp.ok) { await resp.text(); return null; }
    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const rawPrice = Number(meta?.regularMarketPrice) || 0;
    const rawPrevClose = Number(meta?.chartPreviousClose) || Number(meta?.previousClose) || 0;

    if (rawPrice > 0 && rawPrevClose > 0) {
      const isIndex = !!indexMap[ticker];
      const nisPrice = isIndex ? rawPrice : toNis(rawPrice);
      const nisPrev = isIndex ? rawPrevClose : toNis(rawPrevClose);
      const change = Math.round(((nisPrice - nisPrev) / nisPrev) * 10000) / 100;
      if (!isSaneChange(change)) return null;
      return { price: nisPrice, change };
    }
  } catch (e) {
    console.log(`[Yahoo] ${symbol} exception: ${e}`);
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tickers = url.searchParams.get("tickers");
    if (!tickers || tickers.length > 600) {
      return new Response(JSON.stringify({ error: "Invalid tickers param" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY") || "";
    const tickerList = tickers.split(",").slice(0, 50);

    const results = await Promise.all(
      tickerList.map(async (t) => {
        const symbol = t.includes(".") ? t : `${t}.TA`;

        // Check micro-cache first
        const cached = getCached(symbol);
        if (cached) {
          return { ticker: t, price: cached.price, change: cached.change, source: cached.source + "-cache", error: false };
        }

        if (apiKey) {
          const eodhd = await fetchFromEodhd(symbol, apiKey);
          if (eodhd) {
            putCache(symbol, { ...eodhd, source: "eodhd" });
            return { ticker: t, price: eodhd.price, change: eodhd.change, source: "eodhd", error: false };
          }
        }

        const yahoo = await fetchFromYahoo(symbol, t);
        if (yahoo) {
          putCache(symbol, { ...yahoo, source: "yahoo" });
          return { ticker: t, price: yahoo.price, change: yahoo.change, source: "yahoo", error: false };
        }

        return { ticker: t, price: 0, change: 0, error: true };
      })
    );

    return new Response(JSON.stringify({ quotes: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
