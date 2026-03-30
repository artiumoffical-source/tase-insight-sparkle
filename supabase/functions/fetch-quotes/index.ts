import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function toNis(raw: number): number {
  return raw > 1000 ? raw / 100 : raw;
}

async function fetchFromEodhd(symbol: string, apiKey: string): Promise<{ price: number; change: number } | null> {
  // Try real-time
  try {
    const resp = await fetch(`https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`);
    if (resp.ok) {
      const data = await resp.json();
      const rawPrice = Number(data?.close) || Number(data?.last) || Number(data?.previousClose) || Number(data?.open) || 0;
      if (rawPrice > 0) {
        return { price: toNis(rawPrice), change: Math.round((Number(data?.change_p) || 0) * 100) / 100 };
      }
    } else {
      await resp.text(); // consume body
    }
  } catch { /* fall through */ }

  // Try EOD
  try {
    const resp = await fetch(`https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&order=d&limit=2`);
    if (resp.ok) {
      const days = await resp.json();
      if (Array.isArray(days) && days.length > 0) {
        const rawPrice = Number(days[0].adjusted_close) || Number(days[0].close) || 0;
        if (rawPrice > 0) {
          const price = toNis(rawPrice);
          let change = 0;
          if (days.length > 1) {
            const prevRaw = Number(days[1].adjusted_close) || Number(days[1].close) || 0;
            if (prevRaw > 0) change = Math.round(((price - toNis(prevRaw)) / toNis(prevRaw)) * 10000) / 100;
          }
          return { price, change };
        }
      }
    } else {
      await resp.text();
    }
  } catch { /* fall through */ }

  return null;
}

async function fetchFromYahoo(symbol: string, ticker: string): Promise<{ price: number; change: number } | null> {
  try {
    // Map index tickers to Yahoo Finance symbols
    const indexMap: Record<string, string> = {
      "TA35": "%5ETA35",
      "TA125": "%5ETA125",
      "TABANK": "%5ETABNK",
    };
    const yahooSymbol = indexMap[ticker] || symbol;
    const resp = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${yahooSymbol}?interval=1d&range=2d`,
      {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AlphaMap/1.0)",
        },
      }
    );
    if (!resp.ok) {
      console.log(`[Yahoo] ${symbol} status=${resp.status}`);
      await resp.text();
      return null;
    }
    const json = await resp.json();
    const result = json?.chart?.result?.[0];
    if (!result) return null;

    const meta = result.meta;
    const price = Number(meta?.regularMarketPrice) || 0;
    const prevClose = Number(meta?.chartPreviousClose) || Number(meta?.previousClose) || 0;

    if (price > 0) {
      // Indices (TA35 etc) are in points, stocks are in agorot
      const isIndex = !!indexMap[ticker];
      const nisPrice = isIndex ? price : toNis(price);
      let change = 0;
      if (prevClose > 0) {
        const nisPrev = isIndex ? prevClose : toNis(prevClose);
        change = Math.round(((nisPrice - nisPrev) / nisPrev) * 10000) / 100;
      }
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
    if (!tickers || !/^[A-Z0-9,^]{1,600}$/.test(tickers)) {
      return new Response(JSON.stringify({ error: "Invalid tickers param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY") || "";
    const tickerList = tickers.split(",").slice(0, 50);

    const results = await Promise.all(
      tickerList.map(async (t) => {
        const symbol = t.includes(".") ? t : `${t}.TA`;

        // Try EODHD first (if key exists)
        if (apiKey) {
          const eodhd = await fetchFromEodhd(symbol, apiKey);
          if (eodhd) {
            console.log(`[OK-EODHD] ${t}: ${eodhd.price} (${eodhd.change}%)`);
            return { ticker: t, price: eodhd.price, change: eodhd.change, source: "eodhd", error: false };
          }
        }

        // Fallback: Yahoo Finance
        const yahoo = await fetchFromYahoo(symbol, t);
        if (yahoo) {
          console.log(`[OK-Yahoo] ${t}: ${yahoo.price} (${yahoo.change}%)`);
          return { ticker: t, price: yahoo.price, change: yahoo.change, source: "yahoo", error: false };
        }

        console.log(`[FAIL] ${t}: no data from any source`);
        return { ticker: t, price: 0, change: 0, error: true };
      })
    );

    return new Response(JSON.stringify({ quotes: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
