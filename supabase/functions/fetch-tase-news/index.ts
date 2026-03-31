import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSS_FEEDS = [
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", source: "גלובס - שוק ההון" },
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", source: "גלובס - כלכלה" },
];

interface DataLock {
  ticker: string;
  companyName: string;
  currentLabel: string;
  parallelLabel: string;
  currentRevenue?: number;
  parallelRevenue?: number;
  revenueGrowthPct?: number;
  currentNetIncome?: number;
  parallelNetIncome?: number;
  netIncomeGrowthPct?: number;
  currentOpIncome?: number;
  parallelOpIncome?: number;
  opIncomeGrowthPct?: number;
  currentOpMarginPct?: number;
  parallelOpMarginPct?: number;
  priceChange?: number;
}

function formatNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

function pctChange(current: number, previous: number): number {
  return +((current - previous) / Math.abs(previous || 1) * 100).toFixed(2);
}

// ─── Build data lock from cached_fundamentals ───
async function buildDataLock(
  ticker: string,
  companyName: string,
  adminClient: any,
  eodhKey: string | undefined
): Promise<DataLock | null> {
  // 1. Get financials from our DB (source of truth)
  const { data: cached } = await adminClient
    .from("cached_fundamentals")
    .select("data")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!cached?.data) {
    console.log(`No cached_fundamentals for ${ticker}, skipping`);
    return null;
  }

  const fundamentals = cached.data as any;
  const incomeStatement = fundamentals?.Financials?.Income_Statement?.quarterly;
  if (!incomeStatement) {
    console.log(`No quarterly income statement for ${ticker}`);
    return null;
  }

  const quarters = Object.values(incomeStatement) as any[];
  const sorted = quarters
    .filter((q: any) => q?.date)
    .sort((a: any, b: any) => b.date.localeCompare(a.date));

  if (sorted.length < 1) return null;

  const current = sorted[0];
  const currentDate = new Date(current.date);
  const currentQ = Math.ceil((currentDate.getMonth() + 1) / 3);
  const currentYear = currentDate.getFullYear();
  const parallelYear = currentYear - 1;

  const parallel = sorted.find((q: any) => {
    const d = new Date(q.date);
    return Math.ceil((d.getMonth() + 1) / 3) === currentQ && d.getFullYear() === parallelYear;
  });

  if (!parallel) {
    console.log(`No parallel quarter for ${ticker} Q${currentQ} ${parallelYear}`);
    return null;
  }

  const curRev = current.totalRevenue != null ? Number(current.totalRevenue) : undefined;
  const parRev = parallel.totalRevenue != null ? Number(parallel.totalRevenue) : undefined;
  const curNI = current.netIncome != null ? Number(current.netIncome) : undefined;
  const parNI = parallel.netIncome != null ? Number(parallel.netIncome) : undefined;
  const curOI = current.operatingIncome != null ? Number(current.operatingIncome) : undefined;
  const parOI = parallel.operatingIncome != null ? Number(parallel.operatingIncome) : undefined;

  const lock: DataLock = {
    ticker,
    companyName,
    currentLabel: `Q${currentQ} ${currentYear}`,
    parallelLabel: `Q${currentQ} ${parallelYear}`,
    currentRevenue: curRev,
    parallelRevenue: parRev,
    revenueGrowthPct: curRev != null && parRev != null ? pctChange(curRev, parRev) : undefined,
    currentNetIncome: curNI,
    parallelNetIncome: parNI,
    netIncomeGrowthPct: curNI != null && parNI != null ? pctChange(curNI, parNI) : undefined,
    currentOpIncome: curOI,
    parallelOpIncome: parOI,
    opIncomeGrowthPct: curOI != null && parOI != null ? pctChange(curOI, parOI) : undefined,
    currentOpMarginPct: curRev && curOI != null ? +(curOI / curRev * 100).toFixed(2) : undefined,
    parallelOpMarginPct: parRev && parOI != null ? +(parOI / parRev * 100).toFixed(2) : undefined,
  };

  // Fetch price change from EODHD
  if (eodhKey) {
    try {
      const quoteRes = await fetch(`https://eodhd.com/api/real-time/${ticker}.TA?api_token=${eodhKey}&fmt=json`).catch(() => null);
      if (quoteRes?.ok) {
        const q = await quoteRes.json();
        lock.priceChange = q.change_p ?? q.change_percent;
      }
    } catch (_) { /* ignore */ }
  }

  return lock;
}

// ─── Data-locked prompt ───
function buildLockedPrompt(headline: string, description: string, lock: DataLock): string {
  const lockJson = JSON.stringify(lock, null, 2);

  return `You are "ארטיום מנדבורה", a senior quantitative market analyst for AlphaMap.

═══════════════════════════════════════════════════
 DATABASE FINANCIAL DATA — THIS IS THE ONLY TRUTH
═══════════════════════════════════════════════════
${lockJson}

ABSOLUTE RULES:
1. You are STRICTLY FORBIDDEN from using ANY financial number that is NOT in the JSON above.
2. If the news source mentions a number that contradicts the JSON, you MUST write the JSON number and note: "בניגוד לדיווחים, הנתונים הרשמיים מצביעים על..."
3. SHOW YOUR MATH: For every growth percentage you cite, verify it matches the pre-calculated *GrowthPct fields exactly. If your manual calculation ((Current-Previous)/Previous*100) doesn't match, use the pre-calculated value.
4. Operating Margin = (Operating Income / Revenue) × 100. Use currentOpMarginPct and parallelOpMarginPct from the JSON.
5. Compare ${lock.currentLabel} to ${lock.parallelLabel} (YOY). NEVER compare to adjacent quarters.
6. The current date is ${new Date().toISOString().slice(0, 10)}. Do NOT reference old data as current.

ARTICLE CONTEXT:
Headline: ${headline}
Description: ${description}
Company: ${lock.companyName}
Ticker: ${lock.ticker}.TA
${lock.priceChange != null ? `Today's price change: ${lock.priceChange > 0 ? "+" : ""}${lock.priceChange.toFixed(2)}%` : ""}

WRITING RULES:
- Professional institutional-grade Hebrew.
- Mix sentence lengths. Short punchy lines for impact.
- Use: "המלצת קנייה", "תשואת יתר", "מרווח תפעולי", "תזרים מזומנים חופשי"
- BANNED: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- No double dashes (--). No unnecessary English.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".
- Write as a PRIMARY source. No credits to external outlets.
- Be objective. NO financial advice.

SIGN-OFF:
"הניתוח מבוסס על דוחות כספיים רשמיים ונתוני שוק מהבורסה לניירות ערך בתל אביב."
"מאת: ארטיום מנדבורה, אנליסט שוק ההון"

Return a JSON with:
- titleHe: Hebrew headline (max 80 chars, include a number)
- bodyHe: Full Hebrew analysis (2-3 paragraphs, data-driven, YOY explicit)
- summaryHe: One quantitative sentence (max 150 chars, must include a number)
- sentiment: "positive" | "negative" | "neutral" — MUST match netIncomeGrowthPct direction
- numbersUsed: object with every financial number you cited in the article, e.g. {"revenueGrowthPct": -6.2, "currentRevenue": 5200000000}
- flagged: boolean — true if source contradicts DB or sentiment doesn't match`;
}

// ─── Post-generation validation ───
function validateNumbers(lock: DataLock, numbersUsed: Record<string, number> | undefined): { valid: boolean; mismatches: string[] } {
  if (!numbersUsed) return { valid: false, mismatches: ["AI did not return numbersUsed"] };

  const mismatches: string[] = [];
  const checkFields: Array<[string, number | undefined]> = [
    ["revenueGrowthPct", lock.revenueGrowthPct],
    ["netIncomeGrowthPct", lock.netIncomeGrowthPct],
    ["opIncomeGrowthPct", lock.opIncomeGrowthPct],
    ["currentOpMarginPct", lock.currentOpMarginPct],
    ["parallelOpMarginPct", lock.parallelOpMarginPct],
    ["currentRevenue", lock.currentRevenue],
    ["parallelRevenue", lock.parallelRevenue],
    ["currentNetIncome", lock.currentNetIncome],
    ["parallelNetIncome", lock.parallelNetIncome],
  ];

  for (const [key, dbVal] of checkFields) {
    if (dbVal == null) continue;
    const aiVal = numbersUsed[key];
    if (aiVal == null) continue; // AI didn't use this number, that's ok
    const diff = Math.abs((aiVal - dbVal) / (dbVal || 1)) * 100;
    if (diff > 1) {
      mismatches.push(`${key}: DB=${dbVal}, AI=${aiVal} (${diff.toFixed(1)}% off)`);
    }
  }

  return { valid: mismatches.length === 0, mismatches };
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

    // 4. Process with DATA-LOCK
    const currentYear = new Date().getFullYear();
    let generated = 0;
    let flagged = 0;
    let skippedNoTicker = 0;
    let skippedOutdated = 0;
    let skippedNoData = 0;
    let dataLockFails = 0;
    const maxItems = 8;

    for (const item of newItems.slice(0, maxItems)) {
      const cleanDesc = stripHtml(item.description);
      const { ticker, companyName } = matchTicker(item.title, cleanDesc);

      if (!ticker) {
        skippedNoTicker++;
        console.log(`SKIPPED (no ticker): "${item.title}"`);
        continue;
      }

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
        // BUILD DATA LOCK from our verified DB
        const lock = await buildDataLock(ticker, companyName, adminClient, eodhKey);
        if (!lock) {
          skippedNoData++;
          console.log(`SKIPPED (no DB financials): "${item.title}" [${ticker}]`);
          continue;
        }

        console.log(`DATA LOCK for ${ticker}: Rev ${formatNum(lock.currentRevenue || 0)} (${lock.revenueGrowthPct}% YOY), NI ${formatNum(lock.currentNetIncome || 0)} (${lock.netIncomeGrowthPct}% YOY)`);

        const prompt = buildLockedPrompt(item.title, cleanDesc, lock);

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-3-flash-preview",
            messages: [
              { role: "system", content: `You are a data-checking financial analyst. Return ONLY valid JSON. You MUST use ONLY the numbers from the provided DATABASE JSON. Include a "numbersUsed" field showing every financial figure you cited.` },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error(`AI error for "${item.title}": ${aiRes.status}`);
          if (aiRes.status === 429) break;
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error(`No JSON in AI response for "${item.title}"`); continue; }

        const parsed = JSON.parse(jsonMatch[0]);

        // POST-GENERATION VALIDATION
        const validation = validateNumbers(lock, parsed.numbersUsed);
        const isFlagged = parsed.flagged === true || !validation.valid;
        if (!validation.valid) {
          dataLockFails++;
          console.warn(`⚠️ DATA LOCK MISMATCH for ${ticker}: ${validation.mismatches.join(", ")}`);
        }
        if (isFlagged) flagged++;

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: "draft",
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
          data_lock: {
            dbData: lock,
            aiNumbersUsed: parsed.numbersUsed || {},
            validation: { valid: validation.valid, mismatches: validation.mismatches },
          },
        });

        if (insertErr) {
          console.error("Insert error:", insertErr);
        } else {
          generated++;
          console.log(`Generated: "${item.title}" (${ticker}) [${parsed.sentiment}]${isFlagged ? " ⚠️ FLAGGED" : ""}${!validation.valid ? " ❌ DATA MISMATCH" : " ✅ DATA VERIFIED"}`);
        }
      } catch (e) {
        console.error(`Error processing "${item.title}":`, e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ generated, flagged, dataLockFails, skippedNoTicker, skippedOutdated, skippedNoData, total_feed: allItems.length, new_items: newItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
