import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Well-known high-volume TASE tickers to scan
const SCAN_TICKERS = [
  "TEVA", "LUMI", "POLI", "ICL", "ESLT", "NICE", "BEZQ", "AZRG",
  "DSCT", "HARL", "MZTF", "FIBI", "CLIS", "MGDL", "PHOE", "CEL",
  "PTNR", "AMOT", "GZIT", "SHPG", "DLEKG", "ELCO", "ORA", "SPNS",
  "ISOP",
];

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured", gainers: [], losers: [], marketOpen: false }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch last 2 trading days of EOD data per ticker to compute change
    const results = await Promise.all(
      SCAN_TICKERS.map(async (ticker) => {
        try {
          // Get last 5 calendar days to ensure we capture at least 2 trading days
          const to = new Date();
          const from = new Date();
          from.setDate(from.getDate() - 10);
          const fromStr = from.toISOString().split("T")[0];
          const toStr = to.toISOString().split("T")[0];

          const resp = await fetch(
            `https://eodhd.com/api/eod/${ticker}.TA?api_token=${apiKey}&fmt=json&from=${fromStr}&to=${toStr}&order=d`
          );
          if (!resp.ok) {
            console.error(`EOD error for ${ticker}: ${resp.status}`);
            return null;
          }
          const data = await resp.json();
          if (!Array.isArray(data) || data.length < 1) return null;

          const latest = data[0]; // most recent trading day
          const prev = data.length >= 2 ? data[1] : null;

          const close = Number(latest.close) || Number(latest.adjusted_close) || 0;
          const prevClose = prev ? (Number(prev.close) || Number(prev.adjusted_close) || 0) : close;
          const volume = Number(latest.volume) || 0;

          if (close <= 0) return null;

          const change = prevClose > 0 ? ((close - prevClose) / prevClose) * 100 : 0;
          const latestDate = latest.date || "";

          return {
            ticker,
            price: close,
            change: Math.round(change * 100) / 100,
            volume,
            date: latestDate,
          };
        } catch (e) {
          console.error(`Error fetching ${ticker}:`, e);
          return null;
        }
      })
    );

    const valid = results.filter(Boolean) as Array<{
      ticker: string; price: number; change: number; volume: number; date: string;
    }>;

    console.log(`Got valid EOD data for ${valid.length}/${SCAN_TICKERS.length} tickers`);

    // Determine if market is open: check if latest data date is today
    const today = new Date().toISOString().split("T")[0];
    const latestDate = valid.length > 0 ? valid[0].date : "";
    const marketOpen = latestDate === today;

    // Fetch logos from exchange symbol list (this endpoint works on all plans)
    let logoMap: Record<string, { name: string; logoUrl: string | null }> = {};
    try {
      const symResp = await fetch(
        `https://eodhd.com/api/exchange-symbol-list/TA?api_token=${apiKey}&fmt=json`
      );
      if (symResp.ok) {
        const symbols = await symResp.json();
        if (Array.isArray(symbols)) {
          for (const s of symbols) {
            const code = String(s.Code || "").toUpperCase();
            if (code) {
              logoMap[code] = {
                name: s.Name || code,
                logoUrl: s.LogoURL ? `https://eodhd.com${s.LogoURL}` : null,
              };
            }
          }
        }
      }
    } catch (e) {
      console.error("Symbol list fetch error:", e);
    }

    // Enrich with names/logos
    const enriched = valid.map((s) => ({
      ...s,
      name: logoMap[s.ticker]?.name || s.ticker,
      logoUrl: logoMap[s.ticker]?.logoUrl || null,
    }));

    // Sort for gainers & losers
    const sorted = [...enriched].sort((a, b) => b.change - a.change);
    const gainers = sorted.slice(0, 5);
    const losers = sorted.filter(s => s.change < 0).slice(-5).reverse();
    // If not enough losers, take lowest changers
    const finalLosers = losers.length >= 3 ? losers : sorted.slice(-5).reverse();

    return new Response(JSON.stringify({
      gainers,
      losers: finalLosers,
      marketOpen,
      lastDate: latestDate,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Market trends error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", gainers: [], losers: [], marketOpen: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
