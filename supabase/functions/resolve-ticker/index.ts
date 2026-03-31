import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

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

    if (!ticker || ticker.length < 1 || ticker.length > 20) {
      return new Response(
        JSON.stringify({ error: "Invalid ticker parameter" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check if already in DB
    const { data: existing } = await supabase
      .from("tase_symbols")
      .select("ticker, name, name_he, logo_url, security_id")
      .eq("ticker", ticker)
      .maybeSingle();

    if (existing) {
      return new Response(
        JSON.stringify({ found: true, symbol: existing }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch from EODHD
    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ found: false, error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Resolving unknown ticker: ${ticker}`);
    const resp = await fetch(
      `https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`
    );

    if (!resp.ok) {
      console.log(`EODHD returned ${resp.status} for ${ticker}.TA`);
      await resp.text(); // consume body
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();
    const general = data?.General;

    if (!general || !general.Code) {
      return new Response(
        JSON.stringify({ found: false }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Insert into tase_symbols
    const newSymbol = {
      ticker: general.Code,
      name: general.Name || general.Code,
      name_he: "",
      type: general.Type || null,
      currency: general.CurrencyCode || "ILS",
      exchange: "TA",
      security_id: general.ISIN || null,
      logo_url: general.LogoURL || null,
      updated_at: new Date().toISOString(),
    };

    const { error: insertError } = await supabase
      .from("tase_symbols")
      .upsert(newSymbol, { onConflict: "ticker" });

    if (insertError) {
      console.error("Failed to insert resolved ticker:", insertError);
    }

    console.log(`Resolved and saved ticker: ${ticker} (${newSymbol.name})`);

    return new Response(
      JSON.stringify({
        found: true,
        symbol: {
          ticker: newSymbol.ticker,
          name: newSymbol.name,
          name_he: newSymbol.name_he,
          logo_url: newSymbol.logo_url,
          security_id: newSymbol.security_id,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Resolve ticker error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
