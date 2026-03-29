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
    const ticker = url.searchParams.get("ticker")?.toUpperCase()?.replace(/\.TA$/i, "");
    if (!ticker || !/^[A-Z0-9]{1,10}$/.test(ticker)) {
      return new Response(JSON.stringify({ error: "Invalid ticker" }), {
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

    const symbol = `${ticker}.TA`;

    // Fetch real-time quote
    const rtResp = await fetch(
      `https://eodhd.com/api/real-time/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json`
    );

    // Fetch historical EOD data (last ~5 years for yearly aggregation)
    const fiveYearsAgo = new Date();
    fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5);
    const fromDate = fiveYearsAgo.toISOString().split("T")[0];

    const eodResp = await fetch(
      `https://eodhd.com/api/eod/${encodeURIComponent(symbol)}?api_token=${apiKey}&fmt=json&from=${fromDate}&order=d`
    );

    // Process real-time data for meta
    let meta = { name: ticker, price: 0, change: 0, marketCap: "", currency: "ILS" };
    if (rtResp.ok) {
      const rt = await rtResp.json();
      meta = {
        name: ticker,
        price: rt.close ?? rt.previousClose ?? 0,
        change: rt.change_p ?? 0,
        marketCap: "",
        currency: "ILS",
      };
    } else {
      await rtResp.text(); // consume body
    }

    // Process EOD data into yearly summaries
    const financials: Array<{
      year: string;
      avgClose: number;
      high: number;
      low: number;
      avgVolume: number;
      tradingDays: number;
    }> = [];

    if (eodResp.ok) {
      const eodData = await eodResp.json();
      if (Array.isArray(eodData) && eodData.length > 0) {
        // If no real-time data, use latest EOD for meta
        if (meta.price === 0) {
          const latest = eodData[0];
          const prev = eodData.length > 1 ? eodData[1] : null;
          meta.price = latest.close ?? 0;
          meta.change = prev?.close
            ? ((latest.close - prev.close) / prev.close) * 100
            : 0;
        }

        // Group by year
        const byYear: Record<string, typeof eodData> = {};
        for (const row of eodData) {
          const year = row.date?.substring(0, 4);
          if (year) {
            if (!byYear[year]) byYear[year] = [];
            byYear[year].push(row);
          }
        }

        const sortedYears = Object.keys(byYear).sort((a, b) => b.localeCompare(a)).slice(0, 5);
        for (const year of sortedYears) {
          const rows = byYear[year];
          const closes = rows.map((r: any) => r.close ?? 0).filter((v: number) => v > 0);
          const highs = rows.map((r: any) => r.high ?? 0);
          const lows = rows.map((r: any) => r.low ?? 0).filter((v: number) => v > 0);
          const volumes = rows.map((r: any) => r.volume ?? 0);

          financials.push({
            year,
            avgClose: closes.length > 0 ? closes.reduce((a: number, b: number) => a + b, 0) / closes.length : 0,
            high: Math.max(...highs),
            low: lows.length > 0 ? Math.min(...lows) : 0,
            avgVolume: volumes.length > 0 ? volumes.reduce((a: number, b: number) => a + b, 0) / volumes.length : 0,
            tradingDays: rows.length,
          });
        }
      }
    } else {
      const text = await eodResp.text();
      console.error("EODHD EOD error:", eodResp.status, text);
    }

    return new Response(
      JSON.stringify({ meta, financials }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
