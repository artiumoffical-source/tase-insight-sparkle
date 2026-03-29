const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");
    if (!ticker) {
      return new Response(JSON.stringify({ error: "ticker required" }), {
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

    const limit = 15;
    const newsUrl = `https://eodhd.com/api/news?s=${ticker}.TA&offset=0&limit=${limit}&api_token=${apiKey}&fmt=json`;
    console.log("Fetching news:", newsUrl.replace(apiKey, "***"));

    const res = await fetch(newsUrl);
    if (!res.ok) {
      const body = await res.text();
      console.error("EODHD news error:", res.status, body);
      return new Response(JSON.stringify({ error: `EODHD ${res.status}` }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articles = await res.json();

    const items = (Array.isArray(articles) ? articles : []).map((a: any) => ({
      title: a.title ?? "",
      url: a.link ?? a.url ?? "",
      source: a.source ?? "",
      date: a.date ?? "",
      sentiment: typeof a.sentiment === "object"
        ? (a.sentiment?.polarity ?? a.sentiment?.score ?? 0)
        : (typeof a.sentiment === "number" ? a.sentiment : 0),
    }));

    // Calculate average sentiment
    const scores = items.map((i: any) => Number(i.sentiment) || 0);
    const avgSentiment = scores.length > 0
      ? scores.reduce((s: number, v: number) => s + v, 0) / scores.length
      : 0;

    return new Response(JSON.stringify({ items, avgSentiment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
