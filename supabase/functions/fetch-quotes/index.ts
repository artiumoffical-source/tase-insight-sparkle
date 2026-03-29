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
    const tickers = url.searchParams.get("tickers"); // comma-separated e.g. "LUMI,POLI,ICL"
    if (!tickers || !/^[A-Z0-9,]{1,100}$/.test(tickers)) {
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

    const tickerList = tickers.split(",").slice(0, 10);

    // Fetch real-time (EOD) quotes for each ticker in parallel
    const results = await Promise.all(
      tickerList.map(async (t) => {
        try {
          const resp = await fetch(
            `https://eodhd.com/api/eod/${t}.TA?api_token=${apiKey}&fmt=json&order=d&limit=2`
          );
          if (!resp.ok) {
            const text = await resp.text();
            console.error(`EODHD error for ${t}:`, resp.status, text);
            return { ticker: t, price: 0, change: 0, error: true };
          }
          const data = await resp.json();
          if (!Array.isArray(data) || data.length === 0) {
            return { ticker: t, price: 0, change: 0, error: true };
          }

          const latest = data[0];
          const previous = data.length > 1 ? data[1] : null;
          const price = latest.close ?? 0;
          const prevClose = previous?.close ?? price;
          const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;

          return { ticker: t, price, change, error: false };
        } catch (e) {
          console.error(`Error fetching ${t}:`, e);
          return { ticker: t, price: 0, change: 0, error: true };
        }
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
