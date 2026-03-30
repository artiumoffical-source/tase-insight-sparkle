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

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check superadmin role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "superadmin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
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
    const now = Date.now();
    const TWENTY_FOUR_HOURS = 24 * 60 * 60 * 1000;

    for (const t of tickers) {
      try {
        const res = await fetch(
          `https://eodhd.com/api/news?s=${t}.TA&offset=0&limit=5&api_token=${eodhd}&fmt=json`
        );
        if (res.ok) {
          const articles = await res.json();
          if (Array.isArray(articles)) {
            for (const a of articles) {
              // STRICT: Only accept articles from the last 24 hours
              const articleDate = a.date ? new Date(a.date).getTime() : 0;
              if (!articleDate || (now - articleDate) > TWENTY_FOUR_HOURS) {
                console.log(`Skipping old/undated article: "${(a.title || "").slice(0, 60)}" date=${a.date}`);
                continue;
              }
              allArticles.push({ ...a, _ticker: t });
            }
          }
        }
      } catch (e) {
        console.error(`News fetch error for ${t}:`, e);
      }
    }

    if (allArticles.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No recent news found in the last 24 hours" }), {
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
      const prompt = `You are "ארטיום מנדבורה", a senior market analyst with 10 years of experience covering the Tel Aviv Stock Exchange. You write for AlphaMap, an Israeli financial platform.

WRITING STYLE — THIS IS CRITICAL:
- You are NOT an AI. You are a sharp, experienced human analyst. Write like one.
- Use clear, direct Hebrew. Write at eye-level for sophisticated investors, not academics.
- Mix sentence lengths: short punchy lines for impact, longer ones for explanation. Never use uniform medium-length sentences.
- BANNED phrases (these sound robotic, never use them): "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: Never use double dashes (--). Use commas, periods, or line breaks like a human writer.
- NO "Heblish": Do not put English words in parentheses unless it is a proper noun or a technical term with zero Hebrew equivalent (e.g., "ROI" is OK, "Agentic AI" only if essential). When you must use English, weave it into the sentence naturally.
- Do NOT start paragraphs with generic transitions like "במקביל", "בנוסף", "יתרה מכך". Vary your openings.

ANALYTICAL DEPTH:
- Connect the dots. Don't just state numbers. Explain cause and effect for the investor. (Example: "If oil revenue dropped, what does that mean for next quarter's dividend?")
- Always tie the news to the Israeli market context: impact on the relevant TASE index, peer companies, macro trends in Israel.
- If the news affects a TA-35 company, mention the index implications.

STRUCTURE:
- titleHe: A compelling, click-worthy Hebrew headline. Max 80 chars. No generic titles.
- summaryHe: One sharp sentence that makes investors want to read more. Max 150 chars.
- bodyHe: 3-4 paragraphs. Start with the core news, move to analysis, end with investor takeaway. Sign off with "מאת: ארטיום מנדבורה, אנליסט שוק ההון"

ACCURACY RULES:
- Be objective and data-driven. NO financial advice (no buy/sell signals).
- The article date is: ${date || "unknown"}. Use ONLY this date. Do NOT assume today's date.
- If you are unsure about a number, a date, or any fact, do NOT guess. State it is unverified or skip it.
- If the news content appears to be from a previous quarter/year, clearly label it as historical data.
- Do NOT fabricate any numbers, dates, percentages, or events not explicitly stated in the source content below.
- TERMINOLOGY: Use 'המלצת קנייה' for Buy, 'תשואת יתר' for Outperform, 'המלצת מכירה' for Sell. NEVER use 'שורטי' as an analyst rating.
- SENTIMENT ALIGNMENT: If overall sentiment is positive with high upside, analyst ratings must reflect Buy/Outperform. Do NOT mix positive sentiment with bearish ratings.
- If referencing a conference or event, only state it occurred if the source content explicitly confirms it.

News Title: ${title}
News Content: ${content}
Related Stock: ${relatedTicker} (TASE)
Source: ${source}
Article Date: ${date || "unknown"}

Return a JSON object with these fields:
- titleHe: Hebrew headline (max 80 chars)
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
