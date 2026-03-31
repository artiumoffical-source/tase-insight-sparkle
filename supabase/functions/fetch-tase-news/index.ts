import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSS_FEEDS = [
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", source: "גלובס - שוק ההון" },
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", source: "גלובס - כלכלה" },
];

// ─── Data-driven AI prompt ───
function buildPrompt(
  headline: string,
  description: string,
  ticker: string,
  companyName: string,
  marketData: { priceChange?: number; revenue?: number[]; opIncome?: number[]; expenses?: number[]; currency?: string } | null
): string {
  const dataBlock = marketData
    ? `
REAL-TIME MARKET DATA (use these exact numbers in your analysis):
- Today's price change: ${marketData.priceChange != null ? `${marketData.priceChange > 0 ? "+" : ""}${marketData.priceChange.toFixed(2)}%` : "N/A"}
${marketData.revenue?.length ? `- Revenue (last 2 quarters, ${marketData.currency || "ILS"}): ${marketData.revenue.map(v => formatNum(v)).join(" → ")}` : ""}
${marketData.opIncome?.length ? `- Operating Income (last 2 quarters): ${marketData.opIncome.map(v => formatNum(v)).join(" → ")}` : ""}
${marketData.expenses?.length ? `- Operating Expenses (last 2 quarters): ${marketData.expenses.map(v => formatNum(v)).join(" → ")}` : ""}
${marketData.opIncome?.length === 2 && marketData.revenue?.length === 2 ? `- Operating Margin: ${((marketData.opIncome[0] / marketData.revenue[0]) * 100).toFixed(1)}% → ${((marketData.opIncome[1] / marketData.revenue[1]) * 100).toFixed(1)}%` : ""}
`
    : "";

  return `You are "ארטיום מנדבורה", a senior quantitative market analyst covering the Tel Aviv Stock Exchange for AlphaMap.

You are writing an original, data-driven analysis based on Israeli financial market developments.

CRITICAL RULES — QUANTITATIVE WRITING:
- NEVER use vague terms like "זינקה", "עלתה", "השתפרה", "ירדה" WITHOUT citing exact numbers.
- If the stock moved, state the EXACT percentage (e.g., "עלתה ב-14.83%", "ירדה ב-3.2%").
- If operating margin changed, calculate and state: "מרווח תפעולי השתפר מ-3.2% ל-4.1%".
- If revenue grew, state the absolute change and percentage: "הכנסות גדלו ב-12% ל-2.4 מיליארד ₪".
- VERIFY: If the headline implies a "surge" but the actual price change is under 2%, note the discrepancy explicitly.

WRITING STYLE:
- Write in professional, institutional-grade Hebrew for sophisticated investors.
- Mix sentence lengths. Short punchy lines for impact, longer ones for context.
- Use correct Hebrew financial terminology: "המלצת קנייה", "תשואת יתר", "מרווח תפעולי", "תזרים מזומנים חופשי".
- BANNED phrases: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: No double dashes (--). No unnecessary English in parentheses.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".

ANALYSIS:
- Write as a PRIMARY source. Do NOT reference or credit any external news outlet.
- Connect the dots for investors: what does this data mean for the stock / market?
- Tie it to the Israeli market context when relevant.
- If it's a macro/economy article, analyze impact on banks, real estate, and tech sectors with specific data points.

ACCURACY:
- Be objective. NO financial advice.
- Do NOT fabricate numbers. Use ONLY the data provided below and facts from the article.

ARTICLE CONTEXT:
Headline: ${headline}
Description: ${description}
${ticker ? `Company: ${companyName}\nTicker: ${ticker}.TA` : "Category: Macro / Economy"}
${dataBlock}

SIGN-OFF: End every article with exactly this line:
"הניתוח מבוסס על דוחות כספיים רשמיים ונתוני שוק מהבורסה לניירות ערך בתל אביב."

Then on a new line:
"מאת: ארטיום מנדבורה, אנליסט שוק ההון"

Return a JSON object with these fields:
- titleHe: Hebrew headline (max 80 chars, data-specific — include a number if possible)
- bodyHe: Full Hebrew analysis (2-3 paragraphs, data-driven)
- summaryHe: One sharp, quantitative sentence summary (max 150 chars, must include at least one number)
- sentiment: one of "positive", "negative", or "neutral"
- category: "stock" if about a specific company, "macro" if about economy/market
- flagged: boolean — true if the headline implies extreme movement but data shows change < 2%`;
}

function formatNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

// ─── Fetch real-time data for a ticker ───
async function fetchTickerData(
  ticker: string,
  eodhKey: string
): Promise<{ priceChange?: number; revenue?: number[]; opIncome?: number[]; expenses?: number[]; currency?: string } | null> {
  if (!ticker) return null;

  try {
    // Fetch quote for price change
    const quoteUrl = `https://eodhd.com/api/real-time/${ticker}.TA?api_token=${eodhKey}&fmt=json`;
    const fundUrl = `https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${eodhKey}&fmt=json&filter=Financials::Income_Statement::quarterly`;

    const [quoteRes, fundRes] = await Promise.all([
      fetch(quoteUrl).catch(() => null),
      fetch(fundUrl).catch(() => null),
    ]);

    let priceChange: number | undefined;
    if (quoteRes?.ok) {
      const q = await quoteRes.json();
      priceChange = q.change_p ?? q.change_percent;
    }

    let revenue: number[] = [];
    let opIncome: number[] = [];
    let expenses: number[] = [];
    let currency = "ILS";

    if (fundRes?.ok) {
      const fundData = await fundRes.json();
      // Get last 2 quarters
      const quarters = Object.values(fundData || {}) as any[];
      const sorted = quarters
        .filter((q: any) => q?.date)
        .sort((a: any, b: any) => a.date.localeCompare(b.date))
        .slice(-2);

      for (const q of sorted) {
        if (q.totalRevenue != null) revenue.push(Number(q.totalRevenue));
        if (q.operatingIncome != null) opIncome.push(Number(q.operatingIncome));
        if (q.totalOperatingExpenses != null) expenses.push(Number(q.totalOperatingExpenses));
        if (q.currency_symbol) currency = q.currency_symbol;
      }
    }

    return { priceChange, revenue, opIncome, expenses, currency };
  } catch (e) {
    console.error(`Data fetch error for ${ticker}:`, e);
    return null;
  }
}

// ─── RSS parsing ───
function parseRssItems(xml: string): Array<{ title: string; link: string; pubDate: string; description: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; description: string }> = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/gi;
  let match;
  while ((match = itemRegex.exec(xml)) !== null) {
    const block = match[1];
    const getTag = (tag: string) => {
      const m = block.match(new RegExp(`<${tag}><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>`, "i"))
        || block.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i"));
      return m ? m[1].trim() : "";
    };
    const linkMatch = block.match(/<link>([\s\S]*?)(?:<\/link>|<)/i);
    const link = linkMatch ? linkMatch[1].trim() : "";
    items.push({
      title: getTag("title"),
      link: link || getTag("link"),
      pubDate: getTag("pubDate") || getTag("pubdate"),
      description: getTag("description"),
    });
  }
  return items;
}

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}

// ─── Main handler ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
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

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    const eodhKey = Deno.env.get("EODHD_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch RSS
    const allItems: Array<{ title: string; link: string; pubDate: string; description: string; source: string }> = [];
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`Fetching RSS: ${feed.source}...`);
        const rssRes = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaMapBot/1.0)", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
        });
        if (!rssRes.ok) { console.error(`RSS fetch failed for ${feed.source}: ${rssRes.status}`); continue; }
        const rssXml = await rssRes.text();
        const items = parseRssItems(rssXml);
        console.log(`Parsed ${items.length} items from ${feed.source}`);
        for (const item of items) allItems.push({ ...item, source: feed.source });
      } catch (e) { console.error(`Error fetching ${feed.source}:`, e); }
    }

    if (allItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No items from RSS feeds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Dedup
    const urls = allItems.map(i => i.link).filter(Boolean);
    const { data: existing } = await adminClient.from("news_articles").select("original_url").in("original_url", urls);
    const existingUrls = new Set((existing || []).map((e: any) => e.original_url));
    const newItems = allItems.filter(i => i.link && !existingUrls.has(i.link));
    console.log(`${newItems.length} new items after dedup (total: ${allItems.length})`);

    if (newItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, total: allItems.length, message: "All items already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load symbols
    const { data: symbols } = await adminClient.from("tase_symbols").select("ticker, name, name_he, override_name_he, search_text");
    const symbolList = symbols || [];

    function matchTicker(headline: string, description: string): { ticker: string; companyName: string } {
      const searchText = (headline + " " + description).toLowerCase();
      let bestMatch = { ticker: "", companyName: "", score: 0 };
      for (const sym of symbolList) {
        const names = [sym.override_name_he, sym.name_he, sym.name].filter(Boolean);
        for (const name of names) {
          if (name && name.length > 2 && searchText.includes(name.toLowerCase())) {
            const score = name.length;
            if (score > bestMatch.score) bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
          }
        }
        if (sym.ticker && searchText.includes(sym.ticker.toLowerCase())) {
          const score = sym.ticker.length + 5;
          if (score > bestMatch.score) bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
        }
      }
      return { ticker: bestMatch.ticker, companyName: bestMatch.companyName };
    }

    // 4. Process with data injection + AI
    let generated = 0;
    let flagged = 0;
    const maxItems = 8;

    for (const item of newItems.slice(0, maxItems)) {
      const cleanDesc = stripHtml(item.description);
      const { ticker, companyName } = matchTicker(item.title, cleanDesc);

      try {
        // Fetch real-time data for the ticker
        const marketData = eodhKey ? await fetchTickerData(ticker, eodhKey) : null;
        if (ticker && marketData) {
          console.log(`Data for ${ticker}: change=${marketData.priceChange}%, rev=${marketData.revenue}, opInc=${marketData.opIncome}`);
        }

        const prompt = buildPrompt(item.title, cleanDesc, ticker, companyName || "לא זוהה", marketData);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: "You are a professional quantitative financial analyst. Return ONLY valid JSON. Every claim must be backed by a number." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for "${item.title}": ${aiRes.status}`);
          if (aiRes.status === 429) { console.log("Rate limited, stopping batch"); break; }
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error(`No JSON in AI response for "${item.title}"`); continue; }

        const parsed = JSON.parse(jsonMatch[0]);
        const category = parsed.category === "macro" ? "macro" : "stock";
        const isFlagged = parsed.flagged === true;
        if (isFlagged) flagged++;

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: isFlagged ? "draft" : "draft",
          category,
          original_title: item.title,
          original_headline: item.title,
          original_url: item.link,
          original_source: "AlphaMap",
          original_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          related_ticker: ticker || null,
          ai_title_he: parsed.titleHe || item.title,
          ai_body_he: parsed.bodyHe || "",
          ai_summary_he: parsed.summaryHe || "",
          content: parsed.bodyHe || "",
          sentiment: parsed.sentiment || "neutral",
        });

        if (insertErr) {
          console.error("Insert error:", insertErr);
        } else {
          generated++;
          console.log(`Generated: ${item.title} (${ticker || "macro"}) [${parsed.sentiment}]${isFlagged ? " ⚠️ FLAGGED" : ""}`);
        }
      } catch (e) {
        console.error(`Error processing "${item.title}":`, e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ generated, flagged, total_feed: allItems.length, new_items: newItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
