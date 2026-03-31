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

    // Find all stocks with EPS=0 but non-zero net income
    const { data: rows, error } = await supabase
      .from("cached_fundamentals")
      .select("ticker, data");
    if (error) throw error;

    const needsRefresh: string[] = [];
    for (const row of rows || []) {
      const d = row.data as any;
      const income = d?.incomeStatement || [];
      const hasZeroEps = income.some((y: any) => {
        const ni = Math.abs(Number(y.netIncome || 0));
        const eps = Math.abs(Number(y.eps || 0));
        return ni > 1000 && eps === 0;
      });
      if (hasZeroEps) needsRefresh.push(row.ticker);
    }

    console.log(`Found ${needsRefresh.length} stocks needing EPS refresh: ${needsRefresh.slice(0, 20).join(", ")}...`);

    // Trigger force re-fetch for each, with rate limiting (1 per 1.5s to avoid EODHD 429)
    let refreshed = 0;
    const errors: string[] = [];
    const baseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    for (const ticker of needsRefresh) {
      try {
        const res = await fetch(
          `${baseUrl}/functions/v1/fetch-financials?ticker=${ticker}&force=true`,
          { headers: { Authorization: `Bearer ${serviceKey}`, apikey: serviceKey } }
        );
        if (res.ok) {
          refreshed++;
          console.log(`Refreshed ${ticker} (${refreshed}/${needsRefresh.length})`);
        } else {
          const errText = await res.text();
          errors.push(`${ticker}: ${res.status}`);
          console.error(`Failed ${ticker}: ${res.status} ${errText}`);
          // If 429, wait longer
          if (res.status === 429) {
            console.log("Rate limited, waiting 10s...");
            await new Promise(r => setTimeout(r, 10000));
          }
        }
      } catch (e) {
        errors.push(`${ticker}: ${e.message}`);
      }
      // Rate limit: wait 1.5s between requests
      await new Promise(r => setTimeout(r, 1500));
    }

    return new Response(
      JSON.stringify({ total: needsRefresh.length, refreshed, errors: errors.slice(0, 20) }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Bulk refresh error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
