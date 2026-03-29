import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function fmt(d: Date) {
  return d.toISOString().slice(0, 10);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const API_KEY = Deno.env.get("EODHD_API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "EODHD_API_KEY not set" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const url = new URL(req.url);
    const from = url.searchParams.get("from") || fmt(new Date());
    const to = url.searchParams.get("to") || from;

    // Fetch economic events for Israel
    const eventsUrl = `https://eodhd.com/api/economic-events?api_token=${API_KEY}&fmt=json&from=${from}&to=${to}&country=IL`;
    const eventsRes = await fetch(eventsUrl);
    let events: any[] = [];
    if (eventsRes.ok) {
      const raw = await eventsRes.json();
      events = Array.isArray(raw) ? raw : [];
    }

    // Fetch earnings calendar for TA exchange
    const earningsUrl = `https://eodhd.com/api/eod-bulk-last-day/TA?api_token=${API_KEY}&fmt=json&type=splits`;
    // EODHD doesn't have a dedicated TA earnings calendar endpoint easily,
    // so we'll try the general earnings endpoint with date range
    const earningsCalUrl = `https://eodhd.com/api/calendar/earnings?api_token=${API_KEY}&fmt=json&from=${from}&to=${to}`;
    const earningsRes = await fetch(earningsCalUrl);
    let earnings: any[] = [];
    if (earningsRes.ok) {
      const raw = await earningsRes.json();
      const earningsData = raw?.earnings || raw;
      if (Array.isArray(earningsData)) {
        // Filter for TA exchange stocks
        earnings = earningsData.filter((e: any) => {
          const code = (e.code || "").toUpperCase();
          const exchange = (e.exchange || "").toUpperCase();
          return exchange === "TA" || code.endsWith(".TA");
        });
      }
    }

    // Map events
    const macroEvents = events.map((e: any) => ({
      date: e.date || from,
      time: e.date ? e.date.slice(11, 16) : "",
      event: e.event || e.type || "Unknown",
      importance: Number(e.importance) || 1,
      actual: e.actual ?? null,
      forecast: e.estimate ?? e.forecast ?? null,
      previous: e.prev ?? e.previous ?? null,
      currency: e.currency || "ILS",
      country: e.country || "IL",
    }));

    // Map earnings
    const earningsEvents = earnings.map((e: any) => ({
      date: e.report_date || e.date || from,
      ticker: (e.code || "").replace(".TA", ""),
      name: e.name || e.code || "",
      epsEstimate: e.eps_estimate ?? null,
      epsActual: e.eps_actual ?? null,
      revEstimate: e.revenue_estimate ?? null,
      revActual: e.revenue_actual ?? null,
    }));

    return new Response(JSON.stringify({ macroEvents, earningsEvents }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Calendar fetch error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
