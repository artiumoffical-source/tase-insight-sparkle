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
    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch exchange symbol list to get names + logos
    const symbolsResp = await fetch(
      `https://eodhd.com/api/exchange-symbol-list/TA?api_token=${apiKey}&fmt=json`
    );

    let symbolMap: Record<string, { name: string; logoUrl: string | null }> = {};
    if (symbolsResp.ok) {
      const symbols = await symbolsResp.json();
      if (Array.isArray(symbols)) {
        for (const s of symbols) {
          const code = String(s.Code || "").toUpperCase();
          if (code) {
            symbolMap[code] = {
              name: s.Name || code,
              logoUrl: s.LogoURL ? `https://eodhd.com${s.LogoURL}` : null,
            };
          }
        }
      }
    }

    // Fetch EOD data for the full exchange to find gainers/losers
    const today = new Date();
    const dateStr = today.toISOString().split("T")[0];

    // Try fetching bulk EOD data for the TA exchange
    const bulkResp = await fetch(
      `https://eodhd.com/api/eod-bulk-last-day/TA?api_token=${apiKey}&fmt=json&date=${dateStr}`
    );

    if (!bulkResp.ok) {
      const text = await bulkResp.text();
      console.error("Bulk EOD error:", bulkResp.status, text);
      return new Response(JSON.stringify({ error: "Failed to fetch market data", gainers: [], losers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bulkData = await bulkResp.json();
    console.log("Bulk data count:", Array.isArray(bulkData) ? bulkData.length : "not array");

    if (!Array.isArray(bulkData) || bulkData.length === 0) {
      return new Response(JSON.stringify({ gainers: [], losers: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Calculate percentage change and filter valid entries
    const stocks = bulkData
      .filter((d: any) => {
        const close = Number(d.close);
        const prevClose = Number(d.previous_close || d.adjusted_close);
        return close > 0 && prevClose > 0 && d.code;
      })
      .map((d: any) => {
        const code = String(d.code).toUpperCase();
        const close = Number(d.close);
        const prevClose = Number(d.previous_close || d.adjusted_close);
        const change = ((close - prevClose) / prevClose) * 100;
        const info = symbolMap[code];
        return {
          ticker: code,
          name: info?.name || code,
          logoUrl: info?.logoUrl || null,
          price: close,
          change: Math.round(change * 100) / 100,
          volume: Number(d.volume) || 0,
        };
      })
      // Filter out very low volume / penny stocks
      .filter((s: any) => s.volume > 10000 && s.price > 1);

    // Sort for gainers (highest change) and losers (lowest change)
    const sorted = [...stocks].sort((a: any, b: any) => b.change - a.change);
    const gainers = sorted.slice(0, 5);
    const losers = sorted.slice(-5).reverse();

    return new Response(JSON.stringify({ gainers, losers }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Market trends error:", err);
    return new Response(JSON.stringify({ error: "Internal server error", gainers: [], losers: [] }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
