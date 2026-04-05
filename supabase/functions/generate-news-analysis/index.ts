import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── DataLock types & helpers (ported from fetch-tase-news) ───

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

function pctChange(current: number, previous: number): number {
  return +((current - previous) / Math.abs(previous || 1) * 100).toFixed(2);
}

function formatNum(n: number): string {
  const abs = Math.abs(n);
  if (abs >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toFixed(0);
}

const STALE_THRESHOLD_MS = 90 * 24 * 60 * 60 * 1000; // 90 days

async function buildDataLock(
  ticker: string,
  companyName: string,
  adminClient: any,
  eodhKey: string | undefined
): Promise<DataLock | null | "stale"> {
  const { data: cached } = await adminClient
    .from("cached_fundamentals")
    .select("data, last_updated")
    .eq("ticker", ticker)
    .maybeSingle();

  if (!cached?.data) {
    console.log(`No cached_fundamentals for ${ticker}, skipping`);
    return null;
  }

  // Freshness check
  const lastUpdated = new Date(cached.last_updated).getTime();
  if (Date.now() - lastUpdated > STALE_THRESHOLD_MS) {
    console.log(`Skipped ${ticker}: fundamentals stale (last updated: ${cached.last_updated})`);
    return "stale";
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

// ─── Relevance filter ───
const SECTOR_KEYWORDS: Record<string, string[]> = {
  realEstate: ["נדל\"ן", "דירות", "קבלנים", "שוק הדיור", "בנייה למגורים", "פרויקט מגורים"],
  airline: ["תעופה", "טיסות", "נוסעים", "מטוס"],
  defense: ["ביטחוני", "מערכות נשק", "טילים"],
};

function isArticleRelevant(title: string, content: string, ticker: string, _companyName: string): boolean {
  const text = `${title} ${content}`.toLowerCase();
  const hasRealEstate = SECTOR_KEYWORDS.realEstate.some(kw => text.includes(kw));
  const hasAirline = SECTOR_KEYWORDS.airline.some(kw => text.includes(kw));

  // Airline ticker but real estate content, or vice versa
  if (ticker === "ELAL" && hasRealEstate && !hasAirline) return false;
  if (["AZRG", "AFI", "MGDL", "ISTA"].includes(ticker) && hasAirline && !hasRealEstate) return false;

  return true;
}

function sanitizeBody(body: string): string {
  // Remove everything after \n---
  const dashIdx = body.indexOf("\n---");
  if (dashIdx !== -1) body = body.slice(0, dashIdx);

  // Filter out source/link lines
  return body
    .split("\n")
    .filter(line => {
      const trimmed = line.trim();
      if (trimmed.startsWith("מקור:") || trimmed.startsWith("Source:")) return false;
      if (/https?:\/\//.test(trimmed)) return false;
      if (trimmed.startsWith("📋") || trimmed.startsWith("📊")) return false;
      return true;
    })
    .join("\n")
    .trim();
}

function buildLockedPrompt(title: string, content: string, lock: DataLock, source: string, date: string | null): string {
  const lockJson = JSON.stringify(lock, null, 2);

  return `You are a Hebrew financial journalist for AlphaMap (alpha-map.com).

═══════════════════════════════════════════════════
 ALPHAMAP FINANCIAL DATA (SOURCE B)
═══════════════════════════════════════════════════
${lockJson}

STRICT RULES — violations will cause rejection:
1. ONLY use facts from: (a) the Maya filing text provided below, (b) AlphaMap financial data above.
2. NEVER add information from your training data.
3. If a number is not in the sources → write "הנתון אינו זמין בדיווח".
4. The subtitle must directly relate to the article's main topic — no tangents.
5. Every company name mention must include its ticker in parentheses, e.g. ${lock.companyName} (${lock.ticker}).
6. If the filing text mentions a number that contradicts the AlphaMap JSON, use the AlphaMap JSON number and note: "בניגוד לדיווחים, הנתונים הרשמיים מצביעים על..."
7. SHOW YOUR MATH: For every growth percentage you cite, verify it matches the pre-calculated *GrowthPct fields exactly.
8. Compare ${lock.currentLabel} to ${lock.parallelLabel} (YOY). NEVER compare to adjacent quarters.
9. The current date is ${new Date().toISOString().slice(0, 10)}. The article date is: ${date || "unknown"}.

MAYA FILING / ARTICLE CONTEXT (SOURCE A):
Headline: ${title}
Content: ${content.slice(0, 1500)}
Company: ${lock.companyName}
Ticker: ${lock.ticker}.TA
Source: ${source}
${lock.priceChange != null ? `Today's price change: ${lock.priceChange > 0 ? "+" : ""}${lock.priceChange.toFixed(2)}%` : ""}

REQUIRED STRUCTURE:
**כותרת:** [חברה] [מה קרה]: [המספר המרכזי] — [זינוק/ירידה/יציבות]
**תת-כותרת:** משפט אחד שמרחיב על הכותרת בלבד
**גוף (3 פסקאות):**
  - פסקה 1: מה קרה (מהמאיה/הדיווח בלבד)
  - פסקה 2: הקשר — השוואה לרבעון/שנה קודמת (מAlphaMap בלבד, YOY explicit)
  - פסקה 3: מה לעקוב אחריו

WRITING RULES:
- You are writing an ORIGINAL article for AlphaMap. The news source is only a trigger — rewrite everything in your own words as a primary journalist.
- NEVER copy sentences from the source. NEVER mention Globes, Reuters, Bloomberg or any publication name.
- NEVER include "---", "מקור:", "📋", "📊", "Source:", URLs, or links anywhere in bodyHe.
- The bodyHe field ends after the last paragraph. Nothing else after it.
- Professional institutional-grade Hebrew.
- Mix sentence lengths. Short punchy lines for impact.
- Use: "המלצת קנייה", "תשואת יתר", "מרווח תפעולי", "תזרים מזומנים חופשי"
- BANNED: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- No double dashes (--). No unnecessary English.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".
- Be objective. NO financial advice.
- FORBIDDEN: Adding real estate, politics, or unrelated sector commentary unless it appears in the Maya filing.
- Never repeat words in the title. Read the title once before finalizing.

SIGN-OFF:
"הניתוח מבוסס על דוחות כספיים רשמיים ונתוני שוק מהבורסה לניירות ערך בתל אביב."
"מאת: ארטיום מנדבורה, אנליסט שוק ההון"

Return a JSON with:
- titleHe: Hebrew headline following the כותרת format above (max 80 chars, include a number)
- subtitleHe: Hebrew subtitle — one sentence expanding on the headline only
- bodyHe: Full Hebrew analysis (3 paragraphs as specified above)
- summaryHe: One quantitative sentence (max 150 chars, must include a number)
- sentiment: "positive" | "negative" | "neutral" — MUST match netIncomeGrowthPct direction
- sourceRef: source reference string "[filing name] | [date] | alpha-map.com"
- numbersUsed: object with every financial number you cited, e.g. {"revenueGrowthPct": -6.2, "currentRevenue": 5200000000}
- flagged: boolean — true if source contradicts DB or sentiment doesn't match`;
}

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

    const eodhd = Deno.env.get("EODHD_API_KEY");
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!eodhd || !lovableKey) {
      return new Response(JSON.stringify({ error: "Missing API keys" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");

    // Load symbols for company name lookup
    const { data: symbols } = await adminClient.from("tase_symbols").select("ticker, name, name_he, override_name_he");
    const symbolMap = new Map((symbols || []).map(s => [s.ticker, s.override_name_he || s.name_he || s.name]));

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
    let flagged = 0;
    let skippedNoData = 0;
    let skippedStale = 0;
    let dataLockFails = 0;
    const maxItems = 8;

    for (const article of newArticles.slice(0, maxItems)) {
      const title = article.title || "";
      const content = (article.content || article.text || article.summary || "").slice(0, 1500);
      const articleUrl = article.link || article.url || "";
      const source = article.source || "";
      const date = article.date || null;
      const relatedTicker = article._ticker || "";

      if (!relatedTicker) {
        skippedNoData++;
        console.log(`SKIPPED (no ticker): "${title}"`);
        continue;
      }

      const companyName = symbolMap.get(relatedTicker) || relatedTicker;

      // RELEVANCE CHECK
      if (!isArticleRelevant(title, content, relatedTicker, companyName)) {
        console.log(`SKIPPED not relevant: "${title}" [${relatedTicker}]`);
        continue;
      }

      // BUILD DATA LOCK
      const lockResult = await buildDataLock(relatedTicker, companyName, adminClient, eodhd);
      if (lockResult === "stale") {
        skippedStale++;
        continue;
      }
      if (!lockResult) {
        skippedNoData++;
        console.log(`SKIPPED (no DB financials): "${title}" [${relatedTicker}]`);
        continue;
      }
      const lock = lockResult;

      console.log(`DATA LOCK for ${relatedTicker}: Rev ${formatNum(lock.currentRevenue || 0)} (${lock.revenueGrowthPct}% YOY), NI ${formatNum(lock.currentNetIncome || 0)} (${lock.netIncomeGrowthPct}% YOY)`);

      const prompt = buildLockedPrompt(title, content, lock, source, date);

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: "You are a Hebrew financial journalist. Return ONLY valid JSON. Use ONLY facts from the Maya filing text and the AlphaMap financial data provided. Never add information from your training data. Include a \"numbersUsed\" field showing every financial figure you cited." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error("AI error:", aiRes.status);
          if (aiRes.status === 429) break;
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error(`No JSON in AI response for "${title}"`); continue; }

        const parsed = JSON.parse(jsonMatch[0]);

        // SANITIZE body — remove source footers, URLs, etc.
        if (parsed.bodyHe) {
          const sepIdx = parsed.bodyHe.indexOf('\n---');
          if (sepIdx !== -1) parsed.bodyHe = parsed.bodyHe.slice(0, sepIdx).trim();
          parsed.bodyHe = parsed.bodyHe
            .split('\n')
            .filter((line: string) => !line.trim().startsWith('מקור:') && !line.trim().startsWith('📋') && !line.trim().startsWith('📊') && !line.trim().startsWith('Source:') && !line.includes('http'))
            .join('\n')
            .trim();
        }

        // POST-GENERATION VALIDATION
        const validation = validateNumbers(lock, parsed.numbersUsed);
        const isFlagged = parsed.flagged === true || !validation.valid;
        if (!validation.valid) {
          dataLockFails++;
          console.warn(`⚠️ DATA LOCK MISMATCH for ${relatedTicker}: ${validation.mismatches.join(", ")}`);
        }
        if (isFlagged) flagged++;

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: "draft",
          category: "stock",
          original_title: title,
          original_url: articleUrl,
          original_source: source,
          original_date: date,
          related_ticker: relatedTicker || null,
          ai_title_he: parsed.titleHe || title,
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
          console.log(`Generated: "${title}" (${relatedTicker}) [${parsed.sentiment}]${isFlagged ? " ⚠️ FLAGGED" : ""}${!validation.valid ? " ❌ DATA MISMATCH" : " ✅ DATA VERIFIED"}`);
        }
      } catch (e) {
        console.error("AI generation error:", e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    // ─── Process pending MAYA articles from fetch-tase-news ───
    const { data: pendingMaya } = await adminClient
      .from("news_articles")
      .select("*")
      .eq("original_source", "MAYA/TASE")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(10);

    let mayaGenerated = 0;
    for (const row of (pendingMaya || [])) {
      const relatedTicker = row.related_ticker || "";
      if (!relatedTicker) continue;

      const companyName = symbolMap.get(relatedTicker) || relatedTicker;
      if (!isArticleRelevant(row.original_title, row.content || "", relatedTicker, companyName)) {
        console.log(`MAYA SKIPPED not relevant: "${row.original_title}" [${relatedTicker}]`);
        await adminClient.from("news_articles").update({ status: "rejected" }).eq("id", row.id);
        continue;
      }

      const lockResult = await buildDataLock(relatedTicker, companyName, adminClient, eodhd);
      if (lockResult === "stale") { skippedStale++; continue; }
      if (!lockResult) {
        console.log(`MAYA SKIPPED (no DB financials): "${row.original_title}" [${relatedTicker}]`);
        skippedNoData++;
        continue;
      }
      const lock = lockResult;

      const prompt = buildLockedPrompt(row.original_title, row.content || "", lock, "MAYA/TASE", row.original_date);

      try {
        const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${lovableKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-pro",
            messages: [
              { role: "system", content: "You are a Hebrew financial journalist. Return ONLY valid JSON. Use ONLY facts from the Maya filing text and the AlphaMap financial data provided. Never add information from your training data. Include a \"numbersUsed\" field showing every financial figure you cited." },
              { role: "user", content: prompt },
            ],
          }),
        });

        if (!aiRes.ok) {
          console.error("MAYA AI error:", aiRes.status);
          if (aiRes.status === 429) break;
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) { console.error(`No JSON in MAYA AI response for "${row.original_title}"`); continue; }

        const parsed = JSON.parse(jsonMatch[0]);

        // Sanitize body
        if (parsed.bodyHe) {
          const sepIdx = parsed.bodyHe.indexOf('\n---');
          if (sepIdx !== -1) parsed.bodyHe = parsed.bodyHe.slice(0, sepIdx).trim();
          parsed.bodyHe = parsed.bodyHe
            .split('\n')
            .filter((line: string) => !line.trim().startsWith('מקור:') && !line.trim().startsWith('📋') && !line.trim().startsWith('📊') && !line.trim().startsWith('Source:') && !line.includes('http'))
            .join('\n')
            .trim();
        }

        const validation = validateNumbers(lock, parsed.numbersUsed);
        const isFlagged = parsed.flagged === true || !validation.valid;
        if (!validation.valid) dataLockFails++;
        if (isFlagged) flagged++;

        // Update the existing pending row with AI content
        const { error: updateErr } = await adminClient.from("news_articles").update({
          status: "draft",
          ai_title_he: parsed.titleHe || row.original_title,
          ai_body_he: parsed.bodyHe || "",
          ai_summary_he: parsed.summaryHe || "",
          content: parsed.bodyHe || "",
          sentiment: parsed.sentiment || "neutral",
          data_lock: {
            dbData: lock,
            aiNumbersUsed: parsed.numbersUsed || {},
            validation: { valid: validation.valid, mismatches: validation.mismatches },
          },
        }).eq("id", row.id);

        if (updateErr) {
          console.error("MAYA update error:", updateErr);
        } else {
          mayaGenerated++;
          generated++;
          console.log(`MAYA Generated: "${row.original_title}" (${relatedTicker}) [${parsed.sentiment}]`);
        }
      } catch (e) {
        console.error("MAYA AI generation error:", e);
      }

      await new Promise(r => setTimeout(r, 2000));
    }

    console.log(`MAYA processing done: ${mayaGenerated} generated from ${(pendingMaya || []).length} pending`);

    return new Response(
      JSON.stringify({ generated, flagged, dataLockFails, skippedNoData, skippedStale, total_fetched: allArticles.length, new_articles: newArticles.length, mayaGenerated }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("generate-news-analysis error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
