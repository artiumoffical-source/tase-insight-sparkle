import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tickers = url.searchParams.get("tickers");
    if (!tickers || !/^[A-Z0-9,]{1,200}$/.test(tickers)) {
      return new Response(JSON.stringify({ error: "Invalid tickers param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tickerList = tickers.split(",").slice(0, 20);

    const results = await Promise.all(
      tickerList.map(async (t) => {
        const symbol = t.includes(".") ? t : `${t}.TA`;
        try {
          // Try real-time first
          const rtResp = await fetch(
            `https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`
          );
          if (rtResp.ok) {
            const data = await rtResp.json();
            const rawPrice = Number(data?.close) || Number(data?.previousClose) || Number(data?.open) || 0;
            const change = Number(data?.change_p) || 0;
            if (rawPrice > 0) {
              // TASE prices from EODHD are in agorot — divide by 100 for NIS
              const price = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
              return { ticker: t, price, change, error: false };
            }
          }
        } catch {
          // Fall through to EOD
        }

        try {
          // Fallback: EOD (end-of-day) endpoint
          const eodResp = await fetch(
            `https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&order=d&limit=2`
          );
          if (eodResp.ok) {
            const days = await eodResp.json();
            if (Array.isArray(days) && days.length > 0) {
              const latest = days[0];
              const prev = days.length > 1 ? days[1] : null;
              const rawPrice = Number(latest.adjusted_close) || Number(latest.close) || 0;
              const price = rawPrice > 1000 ? rawPrice / 100 : rawPrice;
              let change = 0;
              if (prev) {
                const prevPrice = Number(prev.adjusted_close) || Number(prev.close) || 0;
                if (prevPrice > 0) {
                  change = ((rawPrice - (prevPrice > 1000 ? prevPrice : prevPrice * 100)) / (prevPrice > 1000 ? prevPrice : prevPrice * 100)) * 100;
                  // Recalculate cleanly
                  const prevNis = prevPrice > 1000 ? prevPrice / 100 : prevPrice;
                  change = ((price - prevNis) / prevNis) * 100;
                }
              }
              return { ticker: t, price, change: Math.round(change * 100) / 100, date: latest.date, error: false };
            }
          }
        } catch {
          // Fall through
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
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
