import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RSS_FEEDS = [
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", source: "גלובס - שוק ההון" },
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", source: "גלובס - כלכלה" },
];

// ─── Types ───

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

interface AnnualContext {
  ticker: string;
  companyName: string;
  latestYear: number;
  previousYear: number;
  latestRevenue?: number;
  previousRevenue?: number;
  revenueGrowthPct?: number;
  latestNetIncome?: number;
  previousNetIncome?: number;
  netIncomeGrowthPct?: number;
}

type TierResult =
  | { tier: 1 }
  | { tier: 2; annual: AnnualContext }
  | { tier: 3; lock: DataLock; annual: AnnualContext };

// ─── Helpers ───

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

// ─── Tiered data builder ───
const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000;

async function buildTieredData(
  ticker: string,
  companyName: string,
  adminClient: any,
  eodhKey: string | undefined
): Promise<TierResult> {
  const { data: cached } = await adminClient
    .from("cached_fundamentals")
    .select("data, last_updated")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!cached?.data) {
    console.log(`[TIER] ${ticker}: no cached_fundamentals → Tier 1`);
    return { tier: 1 };
  }

  const lastUpdated = new Date(cached.last_updated).getTime();
  if (Date.now() - lastUpdated > STALE_THRESHOLD_MS) {
    console.log(`[TIER] ${ticker}: stale data (${Math.floor((Date.now() - lastUpdated) / 86400000)}d old) → Tier 1`);
    return { tier: 1 };
  }

  const fundamentals = cached.data as any;

  // Try to build annual context (Tier 2)
  const annualIncome = fundamentals?.Financials?.Income_Statement?.yearly;
  let annual: AnnualContext | null = null;

  if (annualIncome) {
    const years = Object.values(annualIncome) as any[];
    const sorted = years.filter((y: any) => y?.date).sort((a: any, b: any) => b.date.localeCompare(a.date));
    if (sorted.length >= 2) {
      const latest = sorted[0];
      const previous = sorted[1];
      const latestYear = new Date(latest.date).getFullYear();
      const previousYear = new Date(previous.date).getFullYear();
      const latRev = latest.totalRevenue != null ? Number(latest.totalRevenue) : undefined;
      const prevRev = previous.totalRevenue != null ? Number(previous.totalRevenue) : undefined;
      const latNI = latest.netIncome != null ? Number(latest.netIncome) : undefined;
      const prevNI = previous.netIncome != null ? Number(previous.netIncome) : undefined;

      annual = {
        ticker,
        companyName,
        latestYear,
        previousYear,
        latestRevenue: latRev,
        previousRevenue: prevRev,
        revenueGrowthPct: latRev != null && prevRev != null ? pctChange(latRev, prevRev) : undefined,
        latestNetIncome: latNI,
        previousNetIncome: prevNI,
        netIncomeGrowthPct: latNI != null && prevNI != null ? pctChange(latNI, prevNI) : undefined,
      };
    }
  }

  // Try to build quarterly data lock (Tier 3)
  const quarterlyIncome = fundamentals?.Financials?.Income_Statement?.quarterly;
  if (quarterlyIncome) {
    const quarters = Object.values(quarterlyIncome) as any[];
    const sorted = quarters.filter((q: any) => q?.date).sort((a: any, b: any) => b.date.localeCompare(a.date));

    if (sorted.length >= 1) {
      const current = sorted[0];
      const currentDate = new Date(current.date);
      const currentQ = Math.ceil((currentDate.getMonth() + 1) / 3);
      const currentYear = currentDate.getFullYear();
      const parallelYear = currentYear - 1;

      const parallel = sorted.find((q: any) => {
        const d = new Date(q.date);
        return Math.ceil((d.getMonth() + 1) / 3) === currentQ && d.getFullYear() === parallelYear;
      });

      if (parallel) {
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

        // Fetch price change
        if (eodhKey) {
          try {
            const quoteRes = await fetch(`https://eodhd.com/api/real-time/${ticker}.TA?api_token=${eodhKey}&fmt=json`).catch(() => null);
            if (quoteRes?.ok) {
              const q = await quoteRes.json();
              lock.priceChange = q.change_p ?? q.change_percent;
            }
          } catch (_) { /* ignore */ }
        }

        console.log(`[TIER] ${ticker}: quarterly data available → Tier 3`);
        return { tier: 3, lock, annual: annual || { ticker, companyName, latestYear: currentYear, previousYear: parallelYear } };
      }
    }
  }

  if (annual) {
    console.log(`[TIER] ${ticker}: annual data only → Tier 2`);
    return { tier: 2, annual };
  }

  console.log(`[TIER] ${ticker}: data exists but no usable annual/quarterly → Tier 1`);
  return { tier: 1 };
}

// ─── Tier-specific prompts ───

function buildTier1Prompt(headline: string, description: string, ticker: string, companyName: string): string {
  return `You are a Hebrew financial journalist for AlphaMap (alpha-map.com).

ARTICLE CONTEXT:
Headline: ${headline}
Description: ${description}
Company: ${companyName}
Ticker: ${ticker}.TA
Date: ${new Date().toISOString().slice(0, 10)}

STRICT RULES:
1. ONLY use facts from the headline and description above.
2. NEVER add financial numbers from your training data.
3. Every company name mention must include its ticker in parentheses.
4. Write a SHORT breaking news article (150-200 words).
5. Be objective. NO financial advice.

REQUIRED STRUCTURE:
**כותרת:** [חברה] [מה קרה]
**תת-כותרת:** משפט אחד שמרחיב על הכותרת בלבד
**גוף (2 פסקאות):**
  - פסקה 1: מה קרה (מהדיווח בלבד)
  - פסקה 2: מה לעקוב אחריו
**מקור:** alpha-map.com

WRITING RULES:
- Professional institutional-grade Hebrew.
- BANNED: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- No double dashes (--). No unnecessary English.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".
- NEVER repeat words in the title. Read the title once before finalizing — every word must appear only once.

SIGN-OFF:
"מאת: ארטיום מנדבורה, אנליסט שוק ההון | alpha-map.com"

Return a JSON with:
- titleHe: Hebrew headline (max 80 chars, no repeated words)
- subtitleHe: one sentence subtitle
- bodyHe: Hebrew article (150-200 words, 2 paragraphs)
- summaryHe: One sentence summary (max 150 chars)
- sentiment: "positive" | "negative" | "neutral"
- numbersUsed: {} (empty — no financial data used)
- flagged: false`;
}

function buildTier2Prompt(headline: string, description: string, annual: AnnualContext): string {
  const annualJson = JSON.stringify(annual, null, 2);
  return `You are a Hebrew financial journalist for AlphaMap (alpha-map.com).

═══════════════════════════════════════════════════
 ALPHAMAP ANNUAL FINANCIAL DATA — USE AS CONTEXT
═══════════════════════════════════════════════════
${annualJson}

ARTICLE CONTEXT:
Headline: ${headline}
Description: ${description}
Company: ${annual.companyName}
Ticker: ${annual.ticker}.TA
Date: ${new Date().toISOString().slice(0, 10)}

STRICT RULES:
1. ONLY use facts from: (a) the headline/description above, (b) AlphaMap annual data above.
2. NEVER add information from your training data.
3. If a number is not in the sources → write "הנתון אינו זמין בדיווח".
4. Every company name mention must include its ticker in parentheses.
5. Compare ${annual.latestYear} to ${annual.previousYear} (YOY) using AlphaMap data.
6. Be objective. NO financial advice.

REQUIRED STRUCTURE:
**כותרת:** [חברה] [מה קרה]: [המספר המרכזי] — [זינוק/ירידה/יציבות]
**תת-כותרת:** משפט אחד שמרחיב על הכותרת בלבד
**גוף (3 פסקאות):**
  - פסקה 1: מה קרה (מהדיווח בלבד)
  - פסקה 2: הקשר — השוואה שנתית (מAlphaMap בלבד, ${annual.latestYear} vs ${annual.previousYear})
  - פסקה 3: מה לעקוב אחריו
**מקור:** alpha-map.com

WRITING RULES:
- Professional institutional-grade Hebrew.
- BANNED: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- No double dashes (--). No unnecessary English.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".
- NEVER repeat words in the title. Read the title once before finalizing — every word must appear only once.

SIGN-OFF:
"הניתוח מבוסס על דוחות כספיים רשמיים ונתוני שוק מהבורסה לניירות ערך בתל אביב."
"מאת: ארטיום מנדבורה, אנליסט שוק ההון | alpha-map.com"

Return a JSON with:
- titleHe: Hebrew headline (max 80 chars, include a number, no repeated words)
- subtitleHe: one sentence subtitle
- bodyHe: Full Hebrew article (3 paragraphs as specified)
- summaryHe: One quantitative sentence (max 150 chars, must include a number)
- sentiment: "positive" | "negative" | "neutral" — MUST match netIncomeGrowthPct direction if available
- numbersUsed: object with every financial number you cited
- flagged: boolean — true if sentiment doesn't match data direction`;
}

function buildTier3Prompt(headline: string, description: string, lock: DataLock): string {
  const lockJson = JSON.stringify(lock, null, 2);
  return `You are a Hebrew financial journalist for AlphaMap (alpha-map.com).

═══════════════════════════════════════════════════
 ALPHAMAP QUARTERLY FINANCIAL DATA — ONLY TRUTH
═══════════════════════════════════════════════════
${lockJson}

ABSOLUTE RULES:
1. You are STRICTLY FORBIDDEN from using ANY financial number that is NOT in the JSON above.
2. If the news source mentions a number that contradicts the JSON, you MUST write the JSON number and note: "בניגוד לדיווחים, הנתונים הרשמיים מצביעים על..."
3. SHOW YOUR MATH: For every growth percentage you cite, verify it matches the pre-calculated *GrowthPct fields exactly.
4. Operating Margin = (Operating Income / Revenue) × 100. Use currentOpMarginPct and parallelOpMarginPct from the JSON.
5. Compare ${lock.currentLabel} to ${lock.parallelLabel} (YOY). NEVER compare to adjacent quarters.
6. The current date is ${new Date().toISOString().slice(0, 10)}.

ARTICLE CONTEXT:
Headline: ${headline}
Description: ${description}
Company: ${lock.companyName}
Ticker: ${lock.ticker}.TA
${lock.priceChange != null ? `Today's price change: ${lock.priceChange > 0 ? "+" : ""}${lock.priceChange.toFixed(2)}%` : ""}

REQUIRED STRUCTURE:
**כותרת:** [חברה] [מה קרה]: [המספר המרכזי] — [זינוק/ירידה/יציבות]
**תת-כותרת:** משפט אחד שמרחיב על הכותרת בלבד
**גוף (3 פסקאות):**
  - פסקה 1: מה קרה (מהדיווח בלבד)
  - פסקה 2: הקשר — השוואה רבעונית (מAlphaMap בלבד, YOY explicit)
  - פסקה 3: מה לעקוב אחריו
**מקור:** alpha-map.com

WRITING RULES:
- Professional institutional-grade Hebrew.
- Mix sentence lengths. Short punchy lines for impact.
- Use: "המלצת קנייה", "תשואת יתר", "מרווח תפעולי", "תזרים מזומנים חופשי"
- BANNED: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- No double dashes (--). No unnecessary English.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".
- Be objective. NO financial advice.
- NEVER repeat words in the title. Read the title once before finalizing — every word must appear only once.

SIGN-OFF:
"הניתוח מבוסס על דוחות כספיים רשמיים ונתוני שוק מהבורסה לניירות ערך בתל אביב."
"מאת: ארטיום מנדבורה, אנליסט שוק ההון | alpha-map.com"

Return a JSON with:
- titleHe: Hebrew headline (max 80 chars, include a number, no repeated words)
- subtitleHe: one sentence subtitle
- bodyHe: Full Hebrew analysis (3 paragraphs, data-driven, YOY explicit)
- summaryHe: One quantitative sentence (max 150 chars, must include a number)
- sentiment: "positive" | "negative" | "neutral" — MUST match netIncomeGrowthPct direction
- numbersUsed: object with every financial number you cited
- flagged: boolean — true if source contradicts DB or sentiment doesn't match`;
}

// ─── Post-generation validation (Tier 3 only) ───
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
    if (aiVal == null) continue;
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
    console.log(`=== FETCH-TASE-NEWS START ===`);
    const allItems: Array<{ title: string; link: string; pubDate: string; description: string; source: string }> = [];
    for (const feed of RSS_FEEDS) {
      try {
        console.log(`[RSS] Fetching: ${feed.url}`);
        const rssRes = await fetch(feed.url, {
          headers: { "User-Agent": "Mozilla/5.0 (compatible; AlphaMapBot/1.0)", "Accept": "application/rss+xml, application/xml, text/xml, */*" },
        });
        if (!rssRes.ok) { console.error(`[RSS] FAILED for ${feed.source}: ${rssRes.status}`); continue; }
        const rssXml = await rssRes.text();
        const items = parseRssItems(rssXml);
        console.log(`[RSS] ${feed.source}: ${items.length} items parsed`);
        for (const item of items) allItems.push({ ...item, source: feed.source });
      } catch (e) { console.error(`[RSS] Error: ${feed.source}`, e); }
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
    console.log(`[DEDUP] ${newItems.length} new / ${allItems.length} total`);

    if (newItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, total: allItems.length, message: "All items already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load symbols
    const { data: symbols } = await adminClient.from("tase_symbols").select("ticker, name, name_he, override_name_he, search_text, aliases, logo_url");
    const symbolList = symbols || [];

    function matchTicker(headline: string, description: string): { ticker: string; companyName: string; logoUrl: string | null } {
      const searchText = (headline + " " + description).toLowerCase();
      let bestMatch = { ticker: "", companyName: "", logoUrl: null as string | null, score: 0 };
      for (const sym of symbolList) {
        const displayName = sym.override_name_he || sym.name_he || sym.name;
        const aliases: string[] = sym.aliases || [];
        for (const alias of aliases) {
          if (alias && alias.length > 1 && searchText.includes(alias.toLowerCase())) {
            const score = alias.length + 10;
            if (score > bestMatch.score) bestMatch = { ticker: sym.ticker, companyName: displayName, logoUrl: sym.logo_url || null, score };
          }
        }
        const names = [sym.override_name_he, sym.name_he, sym.name].filter(Boolean);
        for (const name of names) {
          if (name && name.length > 2 && searchText.includes(name.toLowerCase())) {
            const score = name.length;
            if (score > bestMatch.score) bestMatch = { ticker: sym.ticker, companyName: displayName, logoUrl: sym.logo_url || null, score };
          }
        }
        if (sym.ticker && searchText.includes(sym.ticker.toLowerCase())) {
          const score = sym.ticker.length + 5;
          if (score > bestMatch.score) bestMatch = { ticker: sym.ticker, companyName: displayName, logoUrl: sym.logo_url || null, score };
        }
      }
      return { ticker: bestMatch.ticker, companyName: bestMatch.companyName, logoUrl: bestMatch.logoUrl };
    }

    // 4. Process with TIERED generation
    const currentYear = new Date().getFullYear();
    let generated = 0;
    let flagged = 0;
    let skippedNoTicker = 0;
    let skippedOutdated = 0;
    let dataLockFails = 0;
    const tierCounts = { 1: 0, 2: 0, 3: 0 };
    const errors: Array<{ ticker: string; title: string; error: string }> = [];
    const maxItems = 8;

    for (const item of newItems.slice(0, maxItems)) {
      const cleanDesc = stripHtml(item.description);
      const { ticker, companyName, logoUrl } = matchTicker(item.title, cleanDesc);

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
        // BUILD TIERED DATA
        const tierResult = await buildTieredData(ticker, companyName, adminClient, eodhKey);
        tierCounts[tierResult.tier]++;

        let prompt: string;
        let systemMsg: string;

        if (tierResult.tier === 3) {
          prompt = buildTier3Prompt(item.title, cleanDesc, tierResult.lock);
          systemMsg = "You are a Hebrew financial journalist. Return ONLY valid JSON. Use ONLY the numbers from the provided DATABASE JSON. Include a \"numbersUsed\" field.";
          console.log(`[GEN] Tier 3: ${ticker} — Rev ${formatNum(tierResult.lock.currentRevenue || 0)} (${tierResult.lock.revenueGrowthPct}% YOY)`);
        } else if (tierResult.tier === 2) {
          prompt = buildTier2Prompt(item.title, cleanDesc, tierResult.annual);
          systemMsg = "You are a Hebrew financial journalist. Return ONLY valid JSON. Use ONLY facts from the article text and AlphaMap annual data. Include a \"numbersUsed\" field.";
          console.log(`[GEN] Tier 2: ${ticker} — Annual Rev ${formatNum(tierResult.annual.latestRevenue || 0)} (${tierResult.annual.revenueGrowthPct}% YOY)`);
        } else {
          prompt = buildTier1Prompt(item.title, cleanDesc, ticker, companyName);
          systemMsg = "You are a Hebrew financial journalist. Return ONLY valid JSON. Use ONLY facts from the article text provided. Do NOT add any financial numbers from your training data.";
          console.log(`[GEN] Tier 1: ${ticker} — breaking news only, no financial data`);
        }

        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: { Authorization: `Bearer ${lovableKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: systemMsg },
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

        // Append footer to body
        const footer = `\n\n---\n📋 מקור: ${item.title} | ${item.link}\n📊 לנתוני ${companyName} באלפא-מאפ: https://alpha-map.com/stock/${ticker}`;
        const bodyWithFooter = (parsed.bodyHe || "") + footer;

        // Validation — only for Tier 3
        let validation = { valid: true, mismatches: [] as string[] };
        let isFlagged = parsed.flagged === true;
        if (tierResult.tier === 3) {
          validation = validateNumbers(tierResult.lock, parsed.numbersUsed);
          isFlagged = isFlagged || !validation.valid;
          if (!validation.valid) {
            dataLockFails++;
            console.warn(`⚠️ DATA LOCK MISMATCH for ${ticker}: ${validation.mismatches.join(", ")}`);
          }
        }
        if (isFlagged) flagged++;

        const dataLockPayload = tierResult.tier === 3
          ? { tier: 3, dbData: tierResult.lock, aiNumbersUsed: parsed.numbersUsed || {}, validation }
          : tierResult.tier === 2
          ? { tier: 2, annualData: tierResult.annual, aiNumbersUsed: parsed.numbersUsed || {} }
          : { tier: 1 };

        // Build image URL: use company logo from tase_symbols, fallback to OG image
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const articleImageUrl = logoUrl || null;

        const { data: inserted, error: insertErr } = await adminClient.from("news_articles").insert({
          status: "draft",
          category: "stock",
          original_title: item.title,
          original_headline: item.title,
          original_url: item.link,
          original_source: "AlphaMap",
          original_date: item.pubDate ? new Date(item.pubDate).toISOString() : null,
          related_ticker: ticker,
          ai_title_he: parsed.titleHe || item.title,
          ai_body_he: bodyWithFooter,
          ai_summary_he: parsed.summaryHe || "",
          content: bodyWithFooter,
          sentiment: parsed.sentiment || "neutral",
          data_lock: dataLockPayload,
          image_url: articleImageUrl,
        }).select("id").single();

        if (insertErr) {
          console.error("Insert error:", insertErr);
        } else {
          generated++;
          const tierLabel = `Tier ${tierResult.tier}`;
          console.log(`✅ Generated [${tierLabel}]: "${item.title}" (${ticker}) [${parsed.sentiment}]${isFlagged ? " ⚠️ FLAGGED" : ""}`);
        }
      } catch (e) {
        const errMsg = e instanceof Error ? e.message : String(e);
        errors.push({ ticker: ticker || "unknown", title: item.title, error: errMsg });
        console.error(`Error processing "${item.title}":`, e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    const summary = {
      processed: Math.min(newItems.length, maxItems),
      skipped_duplicate: allItems.length - newItems.length,
      skipped_no_ticker: skippedNoTicker,
      skipped_outdated: skippedOutdated,
      generated,
      flagged,
      data_lock_fails: dataLockFails,
      tier_breakdown: tierCounts,
      total_feed: allItems.length,
      new_items: newItems.length,
      errors,
    };
    console.log("SUMMARY:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
