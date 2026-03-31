import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// AI prompt for MAYA filings analysis
const MAYA_PROMPT = (headline: string, description: string, ticker: string, companyName: string, link: string) =>
  `You are "ארטיום מנדבורה", a senior market analyst covering the Tel Aviv Stock Exchange for AlphaMap.

You are analyzing an official stock exchange filing (דיווח לבורסה) from the TASE/MAYA system.

WRITING STYLE:
- Write in clear, direct Hebrew at eye-level for sophisticated investors.
- Mix sentence lengths. Short punchy lines for impact, longer ones for context.
- BANNED phrases: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: No double dashes (--). No unnecessary English in parentheses.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".

ANALYSIS:
- This is an official exchange filing, treat it with appropriate weight.
- Connect the dots for investors: what does this filing mean for the stock?
- Tie it to the Israeli market context when relevant.

ACCURACY:
- Be objective. NO financial advice.
- Do NOT fabricate numbers, dates, or facts not in the filing.
- If the filing is routine/administrative, say so honestly.

Filing Headline: ${headline}
Filing Description: ${description}
Company: ${companyName}
Ticker: ${ticker}.TA
Source: MAYA/TASE (${link})

Return a JSON object with these fields:
- titleHe: Hebrew headline (max 80 chars, catchy and specific)
- bodyHe: Full Hebrew analysis (2-3 paragraphs). Sign off with "מאת: ארטיום מנדבורה, אנליסט שוק ההון"
- summaryHe: 3 bullet points summarizing investor impact (each starts with •)
- sentiment: one of "positive", "negative", or "neutral"`;

// Extract RSS items using regex (no XML lib needed)
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
    items.push({
      title: getTag("title"),
      link: getTag("link"),
      pubDate: getTag("pubDate"),
      description: getTag("description"),
    });
  }
  return items;
}

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

    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (!lovableKey) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 1. Fetch MAYA RSS feed
    console.log("Fetching MAYA RSS feed...");
    const rssRes = await fetch("https://mayaapi.tase.co.il/api/report/rss", {
      headers: { "Accept": "application/rss+xml, application/xml, text/xml" },
    });

    if (!rssRes.ok) {
      return new Response(JSON.stringify({ error: `MAYA RSS fetch failed: ${rssRes.status}` }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rssXml = await rssRes.text();
    const items = parseRssItems(rssXml);
    console.log(`Parsed ${items.length} RSS items`);

    if (items.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No items in MAYA RSS feed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Deduplicate against existing articles by URL
    const urls = items.map(i => i.link).filter(Boolean);
    const { data: existing } = await adminClient
      .from("news_articles").select("original_url").in("original_url", urls);

    const existingUrls = new Set((existing || []).map((e: any) => e.original_url));
    const newItems = items.filter(i => i.link && !existingUrls.has(i.link));
    console.log(`${newItems.length} new items after dedup`);

    if (newItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, total: items.length, message: "All items already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load tase_symbols for ticker matching
    const { data: symbols } = await adminClient
      .from("tase_symbols").select("ticker, name, name_he, override_name_he, search_text");

    const symbolList = symbols || [];

    // Match company name from filing to a ticker
    function matchTicker(headline: string, description: string): { ticker: string; companyName: string } {
      const searchText = (headline + " " + description).toLowerCase();
      let bestMatch = { ticker: "", companyName: "", score: 0 };

      for (const sym of symbolList) {
        // Check direct name matches
        const names = [sym.name, sym.name_he, sym.override_name_he].filter(Boolean);
        for (const name of names) {
          if (name && name.length > 2 && searchText.includes(name.toLowerCase())) {
            const score = name.length; // longer match = better
            if (score > bestMatch.score) {
              bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
            }
          }
        }

        // Check ticker mention
        if (sym.ticker && searchText.includes(sym.ticker.toLowerCase())) {
          const score = sym.ticker.length + 5; // ticker matches get a bonus
          if (score > bestMatch.score) {
            bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
          }
        }
      }

      return { ticker: bestMatch.ticker, companyName: bestMatch.companyName };
    }

    // 4. Process each new item with AI
    let generated = 0;
    const maxItems = 10; // Process up to 10 per run

    for (const item of newItems.slice(0, maxItems)) {
      const { ticker, companyName } = matchTicker(item.title, item.description);

      try {
        const prompt = MAYA_PROMPT(item.title, item.description, ticker || "N/A", companyName || "לא זוהה", item.link);

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
          console.error(`AI error for "${item.title}": ${aiRes.status}`);
          if (aiRes.status === 429) {
            console.log("Rate limited, stopping batch");
            break;
          }
          continue;
        }

        const aiData = await aiRes.json();
        const raw = aiData.choices?.[0]?.message?.content ?? "";
        const jsonMatch = raw.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
          console.error(`No JSON in AI response for "${item.title}"`);
          continue;
        }

        const parsed = JSON.parse(jsonMatch[0]);

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: "draft",
          category: "stock",
          original_title: item.title,
          original_headline: item.title,
          original_url: item.link,
          original_source: "MAYA/TASE",
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
          console.log(`Generated article for: ${item.title} (${ticker || "no ticker"})`);
        }
      } catch (e) {
        console.error(`Error processing "${item.title}":`, e);
      }

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 1500));
    }

    return new Response(
      JSON.stringify({ generated, total_feed: items.length, new_items: newItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
