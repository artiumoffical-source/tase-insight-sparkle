import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSS_FEEDS = [
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", source: "גלובס - שוק ההון" },
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", source: "גלובס - כלכלה" },
];

interface YoyComparison {
  currentLabel: string;
  parallelLabel: string;
  currentRevenue?: number;
  parallelRevenue?: number;
  currentOpIncome?: number;
  parallelOpIncome?: number;
  currentNetIncome?: number;
  parallelNetIncome?: number;
}

interface TickerData {
  priceChange?: number;
  currency?: string;
  yoyComparison?: YoyComparison;
}

// ─── Data-driven AI prompt with YOY comparison & fact-check ───
function buildPrompt(
  headline: string,
  description: string,
  ticker: string,
  companyName: string,
  marketData: TickerData | null
): string {
  let dataBlock = "";
  if (marketData) {
    const lines: string[] = [];
    if (marketData.priceChange != null) {
      lines.push(`- Today's price change: ${marketData.priceChange > 0 ? "+" : ""}${marketData.priceChange.toFixed(2)}%`);
    }

    // YOY quarterly comparison (current quarter vs parallel quarter last year)
    if (marketData.yoyComparison) {
      const yoy = marketData.yoyComparison;
      lines.push(`\n--- YEAR-OVER-YEAR COMPARISON (${yoy.currentLabel} vs ${yoy.parallelLabel}) ---`);
      if (yoy.currentRevenue != null && yoy.parallelRevenue != null) {
        const revChange = ((yoy.currentRevenue - yoy.parallelRevenue) / Math.abs(yoy.parallelRevenue)) * 100;
        lines.push(`- Revenue: ${formatNum(yoy.parallelRevenue)} → ${formatNum(yoy.currentRevenue)} (${revChange > 0 ? "+" : ""}${revChange.toFixed(1)}% YOY)`);
      }
      if (yoy.currentOpIncome != null && yoy.parallelOpIncome != null) {
        const opChange = ((yoy.currentOpIncome - yoy.parallelOpIncome) / Math.abs(yoy.parallelOpIncome || 1)) * 100;
        lines.push(`- Operating Income: ${formatNum(yoy.parallelOpIncome)} → ${formatNum(yoy.currentOpIncome)} (${opChange > 0 ? "+" : ""}${opChange.toFixed(1)}% YOY)`);
      }
      if (yoy.currentNetIncome != null && yoy.parallelNetIncome != null) {
        const niChange = ((yoy.currentNetIncome - yoy.parallelNetIncome) / Math.abs(yoy.parallelNetIncome || 1)) * 100;
        lines.push(`- Net Income: ${formatNum(yoy.parallelNetIncome)} → ${formatNum(yoy.currentNetIncome)} (${niChange > 0 ? "+" : ""}${niChange.toFixed(1)}% YOY)`);
      }
      // Operating margin calculated from DB
      if (yoy.currentRevenue && yoy.currentOpIncome != null && yoy.parallelRevenue && yoy.parallelOpIncome != null) {
        const curMargin = (yoy.currentOpIncome / yoy.currentRevenue * 100).toFixed(1);
        const parMargin = (yoy.parallelOpIncome / yoy.parallelRevenue * 100).toFixed(1);
        lines.push(`- Operating Margin: ${parMargin}% → ${curMargin}% (calculated from DB)`);
      }
      // Sentiment guide based on net income
      if (yoy.currentNetIncome != null && yoy.parallelNetIncome != null) {
        const niGrowth = ((yoy.currentNetIncome - yoy.parallelNetIncome) / Math.abs(yoy.parallelNetIncome || 1)) * 100;
        lines.push(`\n⚠️ SENTIMENT GUIDE: Net Income ${niGrowth > 0 ? "GREW" : "DECLINED"} by ${Math.abs(niGrowth).toFixed(1)}% YOY. Your sentiment MUST match this direction.`);
      }
    }

    dataBlock = `\nREAL-TIME MARKET DATA FROM DATABASE (these are ABSOLUTE TRUTH — override any external source):\n${lines.join("\n")}\n`;
  }

  return `You are "ארטיום מנדבורה", a senior quantitative market analyst covering the Tel Aviv Stock Exchange for AlphaMap.

You are writing an original, data-driven analysis based on Israeli financial market developments.

CRITICAL RULES — DATA SOVEREIGNTY:
1. The financial numbers provided below come from OFFICIAL FINANCIAL REPORTS in our database. They are ABSOLUTE TRUTH.
2. If a news headline says "Revenue grew" but the DB shows a decline, you MUST write: "למרות דיווחים על צמיחה, הנתונים הרשמיים מצביעים על ירידה של X% בהכנסות."
3. NEVER contradict the database numbers. If the headline and data disagree, the DATA wins.

CRITICAL RULES — COMPARISON METHOD:
1. For ALL stocks: compare the CURRENT QUARTER to the PARALLEL QUARTER LAST YEAR (YOY), NOT the previous quarter (QOQ).
   - Example: Compare Q4 2025 to Q4 2024, NOT Q3 2025.
   - This accounts for seasonality (retail, agriculture, tourism, etc.).
2. State the comparison explicitly: "בהשוואה לרבעון המקביל אשתקד (Q4 2024)..."
3. NEVER compare Q4 to Q3 or any adjacent quarter without explicitly noting it as sequential (QOQ).

CRITICAL RULES — OPERATING MARGIN:
- Operating Margin = (Operating Income / Revenue) × 100
- ALWAYS calculate this from the DB numbers. NEVER guess or estimate.
- State the margin change: "מרווח תפעולי ירד מ-8.2% ל-5.1%"

CRITICAL RULES — QUANTITATIVE WRITING:
- NEVER use vague terms like "זינקה", "עלתה", "השתפרה", "ירדה" WITHOUT citing exact numbers.
- If the stock moved, state the EXACT percentage (e.g., "עלתה ב-14.83%", "ירדה ב-3.2%").
- VERIFY: If the headline implies a "surge" but the actual price change is under 2%, note the discrepancy explicitly.

SELF-AUDIT (you MUST verify before writing):
1. "Did I compare the current quarter to the PARALLEL quarter last year (YOY)?"
2. "Does my sentiment (positive/negative/neutral) match the Net Income growth direction from the DB?"
3. "Did I calculate Operating Margin from the DB numbers, not guess?"
4. "If the headline contradicts the DB data, did I flag the discrepancy?"

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
- bodyHe: Full Hebrew analysis (2-3 paragraphs, data-driven, YOY comparison explicit)
- summaryHe: One sharp, quantitative sentence summary (max 150 chars, must include at least one number)
- sentiment: one of "positive", "negative", or "neutral" — MUST match Net Income direction from DB
- category: "stock" (always — we only cover specific companies)
- flagged: boolean — true if headline contradicts DB data OR sentiment doesn't match Net Income direction`;
}

function formatNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

// ─── Fetch real-time data with YOY comparison ───
async function fetchTickerData(
  ticker: string,
  eodhKey: string
): Promise<TickerData | null> {
  if (!ticker) return null;

  try {
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

    let yoyComparison: YoyComparison | undefined;
    let currency = "ILS";

    if (fundRes?.ok) {
      const fundData = await fundRes.json();
      const quarters = Object.values(fundData || {}) as any[];
      const sorted = quarters
        .filter((q: any) => q?.date)
        .sort((a: any, b: any) => b.date.localeCompare(a.date)); // newest first

      if (sorted.length >= 1) {
        const current = sorted[0];
        const currentDate = new Date(current.date);
        const currentQ = Math.ceil((currentDate.getMonth() + 1) / 3);
        const currentYear = currentDate.getFullYear();
        const parallelYear = currentYear - 1;

        // Find the parallel quarter from last year
        const parallel = sorted.find((q: any) => {
          const d = new Date(q.date);
          const qNum = Math.ceil((d.getMonth() + 1) / 3);
          return qNum === currentQ && d.getFullYear() === parallelYear;
        });

        if (parallel) {
          yoyComparison = {
            currentLabel: `Q${currentQ} ${currentYear}`,
            parallelLabel: `Q${currentQ} ${parallelYear}`,
            currentRevenue: current.totalRevenue != null ? Number(current.totalRevenue) : undefined,
            parallelRevenue: parallel.totalRevenue != null ? Number(parallel.totalRevenue) : undefined,
            currentOpIncome: current.operatingIncome != null ? Number(current.operatingIncome) : undefined,
            parallelOpIncome: parallel.operatingIncome != null ? Number(parallel.operatingIncome) : undefined,
            currentNetIncome: current.netIncome != null ? Number(current.netIncome) : undefined,
            parallelNetIncome: parallel.netIncome != null ? Number(parallel.netIncome) : undefined,
          };
          console.log(`YOY match: ${yoyComparison.currentLabel} vs ${yoyComparison.parallelLabel}`);
        } else {
          console.log(`No parallel quarter found for Q${currentQ} ${parallelYear}`);
        }

        if (current.currency_symbol) currency = current.currency_symbol;
      }
    }

    return { priceChange, currency, yoyComparison };
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

    // 4. Filter: only ticker-matched, recent articles
    const currentYear = new Date().getFullYear();
    let generated = 0;
    let flagged = 0;
    let skippedNoTicker = 0;
    let skippedOutdated = 0;
    const maxItems = 8;

    for (const item of newItems.slice(0, maxItems)) {
      const cleanDesc = stripHtml(item.description);
      const { ticker, companyName } = matchTicker(item.title, cleanDesc);

      // FILTER 1: Skip articles without a matched ticker (no macro)
      if (!ticker) {
        skippedNoTicker++;
        console.log(`SKIPPED (no ticker): "${item.title}"`);
        continue;
      }

      // FILTER 2: Skip outdated articles referencing years 2+ behind current
      const combinedText = item.title + " " + cleanDesc;
      const yearMentions = combinedText.match(/\b(20\d{2})\b/g);
      if (yearMentions) {
        const maxYearMentioned = Math.max(...yearMentions.map(Number));
        if (maxYearMentioned < currentYear - 1) {
          skippedOutdated++;
          console.log(`SKIPPED (outdated year ${maxYearMentioned}): "${item.title}"`);
          continue;
        }
      }

      try {
        // Fetch real-time data for the ticker
        const marketData = eodhKey ? await fetchTickerData(ticker, eodhKey) : null;
        if (ticker && marketData) {
          const yoy = marketData.yoyComparison;
          console.log(`Data for ${ticker}: change=${marketData.priceChange}%, YOY=${yoy ? `${yoy.currentLabel} vs ${yoy.parallelLabel}` : "N/A"}`);
        }

        const prompt = buildPrompt(item.title, cleanDesc, ticker, companyName || "לא זוהה", marketData);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `You are a professional quantitative financial analyst. Return ONLY valid JSON. Every claim must be backed by a number. CRITICAL: The current date is ${new Date().toISOString().slice(0, 10)}. The current year is ${currentYear}. Do NOT reference outdated data as current.` },
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
        const isFlagged = parsed.flagged === true;
        if (isFlagged) flagged++;

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: isFlagged ? "draft" : "draft",
          category: "stock",
          original_title: item.title,
          original_headline: item.title,
          original_url: item.link,
          original_source: "AlphaMap",
          original_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          related_ticker: ticker,
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
          console.log(`Generated: ${item.title} (${ticker}) [${parsed.sentiment}]${isFlagged ? " ⚠️ FLAGGED" : ""}`);
        }
      } catch (e) {
        console.error(`Error processing "${item.title}":`, e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ generated, flagged, skippedNoTicker, skippedOutdated, total_feed: allItems.length, new_items: newItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
