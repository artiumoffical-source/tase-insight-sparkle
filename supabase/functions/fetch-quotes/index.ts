import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function extractPrice(data: any): number {
  // Try every possible price field from EODHD
  const candidates = [
    data?.close, data?.last, data?.price, data?.adjusted_close,
    data?.previousClose, data?.previous_close, data?.open,
  ];
  for (const c of candidates) {
    const n = Number(c);
    if (n > 0) return n;
  }
  return 0;
}

function toNis(raw: number): number {
  // TASE prices from EODHD are often in agorot (hundredths of NIS)
  // If price > 1000, it's likely agorot
  return raw > 1000 ? raw / 100 : raw;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tickers = url.searchParams.get("tickers");
    if (!tickers || !/^[A-Z0-9,^]{1,300}$/.test(tickers)) {
      return new Response(JSON.stringify({ error: "Invalid tickers param" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      console.error("EODHD_API_KEY is not set");
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tickerList = tickers.split(",").slice(0, 20);

    const results = await Promise.all(
      tickerList.map(async (t) => {
        const symbol = t.includes(".") ? t : `${t}.TA`;

        // === Attempt 1: Real-time endpoint ===
        try {
          const rtUrl = `https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`;
          const rtResp = await fetch(rtUrl);
          if (rtResp.ok) {
            const data = await rtResp.json();
            console.log(`[RT] ${symbol}:`, JSON.stringify(data));
            const rawPrice = extractPrice(data);
            if (rawPrice > 0) {
              const price = toNis(rawPrice);
              const change = Number(data?.change_p) || 0;
              return { ticker: t, price, change: Math.round(change * 100) / 100, source: "realtime", error: false };
            }
          } else {
            const body = await rtResp.text();
            console.log(`[RT] ${symbol} status=${rtResp.status}: ${body.slice(0, 200)}`);
          }
        } catch (e) {
          console.log(`[RT] ${symbol} exception: ${e}`);
        }

        // === Attempt 2: EOD (end-of-day) endpoint ===
        try {
          const eodUrl = `https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&order=d&limit=2`;
          const eodResp = await fetch(eodUrl);
          if (eodResp.ok) {
            const days = await eodResp.json();
            console.log(`[EOD] ${symbol}: got ${Array.isArray(days) ? days.length : 0} days`);
            if (Array.isArray(days) && days.length > 0) {
              const latest = days[0];
              const rawPrice = Number(latest.adjusted_close) || Number(latest.close) || 0;
              if (rawPrice > 0) {
                const price = toNis(rawPrice);
                let change = 0;
                if (days.length > 1) {
                  const prevRaw = Number(days[1].adjusted_close) || Number(days[1].close) || 0;
                  if (prevRaw > 0) {
                    const prevNis = toNis(prevRaw);
                    change = ((price - prevNis) / prevNis) * 100;
                  }
                }
                return {
                  ticker: t, price, change: Math.round(change * 100) / 100,
                  date: latest.date, source: "eod", error: false,
                };
              }
            }
          } else {
            const body = await eodResp.text();
            console.log(`[EOD] ${symbol} status=${eodResp.status}: ${body.slice(0, 200)}`);
          }
        } catch (e) {
          console.log(`[EOD] ${symbol} exception: ${e}`);
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
