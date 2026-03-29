import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const FALLBACK_TICKERS = [
  "LUMI", "POLI", "TEVA", "ICL", "ESLT",
  "AZRG", "DSCT", "MZTF", "NICE", "BEZQ",
];

function pickPrice(data: any): number {
  return (
    Number(data?.close) ||
    Number(data?.last) ||
    Number(data?.previousClose) ||
    Number(data?.previous_close) ||
    Number(data?.adjusted_close) ||
    Number(data?.open) ||
    0
  );
}

function pickChange(data: any): number {
  const cp = Number(data?.change_p);
  if (cp && cp !== 0) return cp;
  const changePercent = Number(data?.changePercent);
  if (changePercent && changePercent !== 0) return changePercent;
  // Manual calc from previousClose vs close
  const close = Number(data?.close) || Number(data?.last) || 0;
  const prev = Number(data?.previousClose) || Number(data?.previous_close) || 0;
  if (prev > 0 && close > 0 && close !== prev) {
    return ((close - prev) / prev) * 100;
  }
  return 0;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("EODHD_API_KEY");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let enriched: Array<{
      ticker: string; name: string; logoUrl: string | null;
      price: number; change: number;
    }> = [];

    // Strategy 1: Real-time quotes
    if (apiKey) {
      const results = await Promise.all(
        FALLBACK_TICKERS.map(async (ticker) => {
          try {
            const resp = await fetch(
              `https://eodhd.com/api/real-time/${ticker}.TA?api_token=${apiKey}&fmt=json`
            );
            if (!resp.ok) {
              console.error(`RT error for ${ticker}: ${resp.status}`);
              return null;
            }
            const data = await resp.json();
            console.log(`RT ${ticker}:`, JSON.stringify(data));
            const price = pickPrice(data);
            const change = pickChange(data);
            if (price <= 0) return null;
            return { ticker, price, change: Math.round(change * 100) / 100 };
          } catch (e) {
            console.error(`Error fetching RT ${ticker}:`, e);
            return null;
          }
        })
      );

      const valid = results.filter(Boolean) as Array<{ ticker: string; price: number; change: number }>;
      console.log(`Got valid RT data for ${valid.length}/${FALLBACK_TICKERS.length} tickers`);

      if (valid.length > 0) {
        const { data: symbols } = await supabase
          .from("tase_symbols")
          .select("ticker, name, logo_url")
          .in("ticker", valid.map(v => v.ticker));

        const symMap: Record<string, { name: string; logoUrl: string | null }> = {};
        if (symbols) {
          for (const s of symbols) {
            symMap[s.ticker] = { name: s.name || s.ticker, logoUrl: s.logo_url };
          }
        }

        enriched = valid.map(v => ({
          ...v,
          name: symMap[v.ticker]?.name || v.ticker,
          logoUrl: symMap[v.ticker]?.logoUrl || null,
        }));
      }
    }

    // Strategy 2: DB fallback
    if (enriched.length === 0) {
      console.log("Using tase_symbols DB fallback");
      const { data: dbRows } = await supabase
        .from("tase_symbols")
        .select("ticker, name, logo_url")
        .in("ticker", FALLBACK_TICKERS);

      if (dbRows && dbRows.length > 0) {
        enriched = dbRows.map(r => ({
          ticker: r.ticker,
          name: r.name || r.ticker,
          logoUrl: r.logo_url,
          price: 0,
          change: 0,
        }));
      }
    }

    const sorted = [...enriched].sort((a, b) => b.change - a.change);
    const gainers = sorted.filter(s => s.change >= 0).slice(0, 5);
    const losersPool = sorted.filter(s => s.change < 0);
    const losers = losersPool.length >= 3
      ? losersPool.slice(-5).reverse()
      : sorted.slice(-5).reverse();

    return new Response(JSON.stringify({
      gainers: gainers.length > 0 ? gainers : sorted.slice(0, 5),
      losers,
      marketOpen: false,
      lastDate: new Date().toISOString().split("T")[0],
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Market trends error:", err);
    return new Response(JSON.stringify({
      error: "Internal server error",
      gainers: [], losers: [], marketOpen: false,
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
