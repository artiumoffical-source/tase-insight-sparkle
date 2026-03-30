import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(
      authHeader.replace("Bearer ", "")
    );
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eodhd = Deno.env.get("EODHD_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!eodhd || !lovableKey) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");

    // Fetch news from EODHD
    const tickers = ticker
      ? [ticker]
      : ["TEVA", "LUMI", "POLI", "ESLT", "ICL", "NICE", "AZRG", "BEZQ", "DSCT", "MZTF"];

    const allArticles: any[] = [];

    for (const t of tickers) {
      try {
        const res = await fetch(
          `https://eodhd.com/api/news?s=${t}.TA&offset=0&limit=3&api_token=${eodhd}&fmt=json`
        );
        if (res.ok) {
          const articles = await res.json();
          if (Array.isArray(articles)) {
            for (const a of articles) {
              allArticles.push({ ...a, _ticker: t });
            }
          }
        }
      } catch (e) {
        console.error(`News fetch error for ${t}:`, e);
      }
    }

    if (allArticles.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No news found" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check which articles already exist (by URL)
    const urls = allArticles.map((a) => a.link || a.url || "").filter(Boolean);
    const { data: existing } = await supabase
      .from("news_articles")
      .select("original_url")
      .in("original_url", urls);

    const existingUrls = new Set((existing || []).map((e: any) => e.original_url));
    const newArticles = allArticles.filter((a) => {
      const u = a.link || a.url || "";
      return u && !existingUrls.has(u);
    });

    let generated = 0;

    for (const article of newArticles.slice(0, 5)) {
      const title = article.title || "";
      const content = (article.content || article.text || article.summary || "").slice(0, 1500);
      const articleUrl = article.link || article.url || "";
      const source = article.source || "";
      const date = article.date || null;
      const relatedTicker = article._ticker || "";

      // Generate AI analysis in Hebrew
      const prompt = `You are "ארטיום מנדבורה", a senior market analyst writing for AlphaMap, an Israeli financial platform.

Analyze the following financial news and write a professional Hebrew analysis article.

Rules:
- Write in Hebrew
- Be objective and data-driven
- Focus on business impact and estimated financial implications
- DO NOT give financial advice (no buy/sell signals)
- Professional tone, suitable for sophisticated investors
- Include the company context in the Israeli market
- Structure: headline, 2-3 paragraphs of analysis
- End with "מאת: ארטיום מנדבורה, אנליסט שוק ההון"

News Title: ${title}
News Content: ${content}
Related Stock: ${relatedTicker} (TASE)
Source: ${source}

Return a JSON object with these fields:
- titleHe: Hebrew headline for the analysis (max 80 chars)
- bodyHe: Full Hebrew analysis (3-4 paragraphs)
- summaryHe: One-line Hebrew summary (max 150 chars)`;

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              {
                role: "system",
                content: "You are a professional financial analyst. Return ONLY valid JSON.",
              },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error("AI error:", aiRes.status);
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) continue;

        const parsed = JSON.parse(jsonMatch[0]);

        const { error: insertErr } = await supabase.from("news_articles").insert({
          status: "pending",
          original_title: title,
          original_url: articleUrl,
          original_source: source,
          original_date: date,
          related_ticker: relatedTicker,
          ai_title_he: parsed.titleHe || title,
          ai_body_he: parsed.bodyHe || "",
          ai_summary_he: parsed.summaryHe || "",
        });

        if (insertErr) {
          console.error("Insert error:", insertErr);
        } else {
          generated++;
        }
      } catch (e) {
        console.error("AI generation error:", e);
      }
    }

    return new Response(
      JSON.stringify({ generated, total_fetched: allArticles.length, new_articles: newArticles.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-news-analysis error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
