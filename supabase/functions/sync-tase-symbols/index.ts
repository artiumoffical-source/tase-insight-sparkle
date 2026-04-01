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
    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check for ?force=true to bypass cache
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";

    if (!force) {
      const { data: existing } = await supabase
        .from("tase_symbols")
        .select("updated_at")
        .limit(1)
        .maybeSingle();

      if (existing) {
        const age = Date.now() - new Date(existing.updated_at).getTime();
        const sevenDays = 7 * 24 * 60 * 60 * 1000;
        if (age < sevenDays) {
          return new Response(
            JSON.stringify({ message: "Symbols are up to date", skipped: true }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    console.log("Fetching ALL TASE symbols from EODHD...");
    const resp = await fetch(
      `https://eodhd.com/api/exchange-symbol-list/TA?api_token=${apiKey}&fmt=json`
    );

    if (!resp.ok) {
      const text = await resp.text();
      console.error("EODHD error:", resp.status, text);
      return new Response(
        JSON.stringify({ error: "Failed to fetch symbols", status: resp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const symbols = await resp.json();
    console.log(`Received ${symbols.length} symbols from EODHD`);

    // Map to our table format - include ALL securities
    // name_he intentionally excluded — upsert should never overwrite existing Hebrew names
    const rows = symbols
      .filter((s: any) => s.Code && s.Name)
      .map((s: any) => ({
        ticker: s.Code,
        name: s.Name || s.Code,
        type: s.Type || null,
        currency: s.Currency || "ILS",
        exchange: "TA",
        security_id: s.ISIN || s.Isin || null,
        updated_at: new Date().toISOString(),
      }));

    console.log(`Prepared ${rows.length} rows for upsert`);

    // Upsert in batches of 500
    const batchSize = 500;
    let upserted = 0;
    let errors = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { error } = await supabase
        .from("tase_symbols")
        .upsert(batch, { onConflict: "ticker" });
      if (error) {
        console.error(`Upsert batch ${i}-${i + batch.length} error:`, error);
        errors++;
      } else {
        upserted += batch.length;
      }
    }

    // Overlay Hebrew names from our known list
    const hebrewMap: Record<string, string> = {
      TEVA: "טבע תעשיות פרמצבטיות",
      LUMI: "בנק לאומי",
      DSCT: "בנק דיסקונט",
      HARL: "הראל ביטוח",
      POLI: "בנק הפועלים",
      ICL: "כיל",
      NICE: "נייס מערכות",
      BEZQ: "בזק",
      ELCO: "אלקו החזקות",
      AZRG: "קבוצת עזריאלי",
      ESLT: "אלביט מערכות",
      ISOP: "הזדמנות ישראלית",
      MZTF: "מזרחי טפחות",
      FIBI: "הבנק הבינלאומי הראשון",
      CLIS: "כלל ביטוח",
      MGDL: "מגדל ביטוח",
      ORA: "בנק אוצר החייל",
      PHOE: "הפניקס",
      SPNS: "ספיינס",
      CEL: "סלקום",
      PTNR: "פרטנר תקשורת",
      AMOT: "עמות השקעות",
      GZIT: "גזית גלוב",
      SHPG: "שפיר הנדסה",
      DLEKG: "קבוצת דלק",
      QLTU: "קוואליטאו",
      NXSN: "נקסן",
      ARPT: "ארים תעשיות",
      ILDC: "ישראל קנדה",
      MISH: "משוב",
      ALHE: "אלוני חץ",
      BSEN: "אבני דרך",
      ELRN: "אלרון",
      KMDA: "כמהדע",
      SPEN: "ספאנטק",
      ENLT: "אנלייט אנרגיה",
      ELWS: "אלקטרה",
    };

    for (const [ticker, nameHe] of Object.entries(hebrewMap)) {
      await supabase
        .from("tase_symbols")
        .update({ name_he: nameHe })
        .eq("ticker", ticker);
    }

    console.log(`Sync complete: ${upserted} upserted, ${errors} batch errors, ${Object.keys(hebrewMap).length} Hebrew names applied`);

    return new Response(
      JSON.stringify({ message: `Synced ${upserted} symbols`, total: rows.length, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Sync error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
