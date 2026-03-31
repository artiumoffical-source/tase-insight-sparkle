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
    const mode = url.searchParams.get("mode") || "all"; // "unhealthy" or "all"
    const batchSize = parseInt(url.searchParams.get("batch") || "0"); // 0 = all
    const offset = parseInt(url.searchParams.get("offset") || "0");

    // Get stocks to re-audit
    let tickers: string[] = [];

    if (mode === "unhealthy") {
      const { data: unhealthy } = await supabase
        .from("stock_audit_results")
        .select("ticker")
        .in("health", ["red", "yellow"])
        .eq("verified_by_admin", false);
      tickers = (unhealthy || []).map((s: any) => s.ticker);
    } else {
      const { data: all } = await supabase
        .from("cached_fundamentals")
        .select("ticker")
        .order("ticker");
      tickers = (all || []).map((s: any) => s.ticker);
    }

    // Apply offset/batch
    if (offset > 0) tickers = tickers.slice(offset);
    if (batchSize > 0) tickers = tickers.slice(0, batchSize);

    console.log(`Bulk re-audit (${mode}): ${tickers.length} stocks to refresh`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    let refreshed = 0;
    let failed = 0;
    const failures: string[] = [];
    const results: Record<string, string> = {};

    for (const ticker of tickers) {
      try {
        const res = await fetch(
          `${supabaseUrl}/functions/v1/fetch-financials?ticker=${ticker}&force=true`,
          { headers: { apikey: anonKey, "Content-Type": "application/json" } }
        );
        if (res.ok) {
          refreshed++;
          // Read the health from the response
          try {
            const data = await res.json();
            results[ticker] = data?.meta?.currency || "?";
          } catch { results[ticker] = "ok"; }
          if (refreshed % 10 === 0) console.log(`Progress: ${refreshed}/${tickers.length}`);
        } else {
          failed++;
          const body = await res.text().catch(() => "");
          failures.push(`${ticker}: ${res.status} ${body.substring(0, 80)}`);
          console.warn(`✗ ${ticker} failed: ${res.status}`);
        }
      } catch (e) {
        failed++;
        failures.push(`${ticker}: ${(e as Error).message}`);
        console.error(`✗ ${ticker} error:`, e);
      }
      // Rate limit: 1.5s between calls to avoid EODHD 429
      await new Promise(r => setTimeout(r, 1500));
    }

    // Fetch final health summary
    const { data: auditSummary } = await supabase
      .from("stock_audit_results")
      .select("health");
    const summary = { green: 0, yellow: 0, red: 0, total: 0 };
    for (const row of auditSummary || []) {
      summary.total++;
      if (row.health === "green") summary.green++;
      else if (row.health === "yellow") summary.yellow++;
      else summary.red++;
    }

    return new Response(
      JSON.stringify({ 
        processed: tickers.length, refreshed, failed, 
        failures: failures.slice(0, 20),
        healthSummary: summary 
      }),
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
