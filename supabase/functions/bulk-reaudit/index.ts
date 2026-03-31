import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const url = new URL(req.url);
    const mode = url.searchParams.get("mode") || "unhealthy"; // "unhealthy" or "all"

    // Get stocks to re-audit
    let query = supabase.from("cached_fundamentals").select("ticker");
    if (mode === "unhealthy") {
      // Get tickers with red/yellow health that are not verified
      const { data: unhealthy } = await supabase
        .from("stock_audit_results")
        .select("ticker")
        .in("health", ["red", "yellow"])
        .eq("verified_by_admin", false);
      const unhealthyTickers = (unhealthy || []).map((s: any) => s.ticker);
      
      if (unhealthyTickers.length === 0) {
        return new Response(
          JSON.stringify({ message: "No unhealthy stocks to re-audit", total: 0 }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      query = query.in("ticker", unhealthyTickers);
    }

    const { data: stocks, error } = await query;
    if (error) throw error;

    const tickers = (stocks || []).map((s: any) => s.ticker);
    console.log(`Bulk re-audit (${mode}): ${tickers.length} stocks to refresh`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let refreshed = 0;
    let failed = 0;

    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/fetch-financials?ticker=${ticker}&force=true`,
          { headers: { apikey: anonKey, "Content-Type": "application/json" } }
        );
        if (res.ok) {
          refreshed++;
          if (refreshed % 10 === 0) console.log(`Progress: ${refreshed}/${tickers.length}`);
        } else {
          failed++;
          console.warn(`✗ ${ticker} failed: ${res.status}`);
        }
      } catch (e) {
        failed++;
        console.error(`✗ ${ticker} error:`, e);
      }
      // Rate limit: 2s between calls to avoid EODHD 429
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ total: tickers.length, refreshed, failed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Bulk re-audit error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
