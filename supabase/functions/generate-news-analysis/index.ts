import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const MACRO_KEYWORDS = [
  "bank of israel", "interest rate", "inflation", "cpi", "gdp",
  "בנק ישראל", "ריבית", "אינפלציה", "מדד המחירים", "תוצר",
  "monetary policy", "fiscal", "shekel", "שקל", "תקציב", "budget",
  "unemployment", "אבטלה", "housing", "דיור", "משכנתא", "mortgage",
];

function isMacroArticle(title: string, content: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  return MACRO_KEYWORDS.some((kw) => text.includes(kw.toLowerCase()));
}

const STOCK_PROMPT = (title: string, content: string, relatedTicker: string, source: string, date: string | null) =>
  `You are "ארטיום מנדבורה", a senior market analyst with 10 years of experience covering the Tel Aviv Stock Exchange. You write for AlphaMap, an Israeli financial platform.

WRITING STYLE — THIS IS CRITICAL:
- You are NOT an AI. You are a sharp, experienced human analyst. Write like one.
- Use clear, direct Hebrew. Write at eye-level for sophisticated investors, not academics.
- Mix sentence lengths: short punchy lines for impact, longer ones for explanation. Never use uniform medium-length sentences.
- BANNED phrases (these sound robotic, never use them): "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: Never use double dashes (--). Use commas, periods, or line breaks like a human writer.
- NO "Heblish": Do not put English words in parentheses unless it is a proper noun or a technical term with zero Hebrew equivalent (e.g., "ROI" is OK). When you must use English, weave it into the sentence naturally.
- Do NOT start paragraphs with generic transitions like "במקביל", "בנוסף", "יתרה מכך". Vary your openings.

ANALYTICAL DEPTH:
- Connect the dots. Don't just state numbers. Explain cause and effect for the investor.
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

const MACRO_PROMPT = (title: string, content: string, source: string, date: string | null) =>
  `You are "ארטיום מנדבורה", a senior market analyst with 10 years of experience covering the Israeli economy and the Tel Aviv Stock Exchange. You write macro briefings for AlphaMap.

WRITING STYLE — THIS IS CRITICAL:
- You are NOT an AI. You are a sharp analyst writing a market briefing. Sound human.
- Use clear, direct Hebrew at eye-level for investors.
- Mix sentence lengths. Short lines for impact, longer ones for context.
- BANNED phrases: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: No double dashes (--). No parenthetical English unless absolutely necessary.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".

MACRO ANALYSIS STRUCTURE — "What happened, then why it matters":
1. Open with the event itself in one clear sentence.
2. Explain the RIPPLE EFFECT across sectors:
   - Banks: How does this affect net interest margins, lending, profitability?
   - Real Estate: Impact on mortgage rates, housing stocks, construction?
   - Tech/Growth: How does this change valuations and risk appetite for growth companies?
3. Tie it to the TA-35 index and specific major stocks when relevant (Leumi, Poalim, Azrieli, etc.)
4. End with what investors should watch next. Sign off with "מאת: ארטיום מנדבורה, אנליסט שוק ההון"

ACCURACY RULES:
- Be objective. NO financial advice.
- The article date is: ${date || "unknown"}. Use ONLY this date.
- Do NOT fabricate numbers, dates, or events not in the source.
- If unsure about a fact, skip it or say it is unverified.

News Title: ${title}
News Content: ${content}
Source: ${source}
Article Date: ${date || "unknown"}

Return a JSON object with these fields:
- titleHe: Hebrew headline (max 80 chars)
- bodyHe: Full Hebrew macro analysis (3-4 paragraphs)
- summaryHe: One-line Hebrew summary (max 150 chars)`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
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
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: roleData } = await adminClient
      .from("user_roles").select("role")
      .eq("user_id", user.id).eq("role", "superadmin").maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eodhd = Deno.env.get("EODHD_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!eodhd || !lovableKey) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");

    // --- Fetch stock news from EODHD ---
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
              const articleDate = a.date ? new Date(a.date).getTime() : 0;
              if (!articleDate || (now - articleDate) > TWENTY_FOUR_HOURS) continue;
              allArticles.push({ ...a, _ticker: t });
            }
          }
        }
      } catch (e) {
        console.error(`News fetch error for ${t}:`, e);
      }
    }

    // --- Fetch macro/economic news from EODHD ---
    const macroSearchTerms = ["Bank+of+Israel", "Israel+interest+rate", "Israel+CPI", "Israel+inflation", "Israel+economy"];
    for (const term of macroSearchTerms) {
      try {
        const res = await fetch(
          `https://eodhd.com/api/news?s=GENERAL&t=${term}&offset=0&limit=5&api_token=${eodhd}&fmt=json`
        );
        if (res.ok) {
          const articles = await res.json();
          if (Array.isArray(articles)) {
            for (const a of articles) {
              const articleDate = a.date ? new Date(a.date).getTime() : 0;
              if (!articleDate || (now - articleDate) > TWENTY_FOUR_HOURS) continue;
              allArticles.push({ ...a, _ticker: "", _macro: true });
            }
          }
        }
      } catch (e) {
        console.error(`Macro news fetch error for ${term}:`, e);
      }
    }

    if (allArticles.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No recent news found in the last 24 hours" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate by URL
    const urls = allArticles.map((a) => a.link || a.url || "").filter(Boolean);
    const { data: existing } = await supabase
      .from("news_articles").select("original_url").in("original_url", urls);

    const existingUrls = new Set((existing || []).map((e: any) => e.original_url));
    const newArticles = allArticles.filter((a) => {
      const u = a.link || a.url || "";
      return u && !existingUrls.has(u);
    });

    let generated = 0;

    for (const article of newArticles.slice(0, 8)) {
      const title = article.title || "";
      const content = (article.content || article.text || article.summary || "").slice(0, 1500);
      const articleUrl = article.link || article.url || "";
      const source = article.source || "";
      const date = article.date || null;
      const relatedTicker = article._ticker || "";

      // Determine category
      const isMacro = article._macro || isMacroArticle(title, content);
      const category = isMacro ? "macro" : "stock";

      const prompt = isMacro
        ? MACRO_PROMPT(title, content, source, date)
        : STOCK_PROMPT(title, content, relatedTicker, source, date);

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
              { role: "system", content: "You are a professional financial analyst. Return ONLY valid JSON." },
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
          category,
          original_title: title,
          original_url: articleUrl,
          original_source: source,
          original_date: date,
          related_ticker: relatedTicker || null,
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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
