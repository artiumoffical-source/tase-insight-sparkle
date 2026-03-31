import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Israeli financial news RSS feeds
const RSS_FEEDS = [
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=585", source: "גלובס - שוק ההון" },
  { url: "https://www.globes.co.il/webservice/rss/rssfeeder.asmx/FeederNode?iID=2", source: "גלובס - כלכלה" },
];

// AI prompt for Israeli financial news analysis
const NEWS_PROMPT = (headline: string, description: string, ticker: string, companyName: string, link: string, source: string) =>
  `You are "ארטיום מנדבורה", a senior market analyst covering the Tel Aviv Stock Exchange for AlphaMap.

You are analyzing an Israeli financial news article from ${source}.

WRITING STYLE:
- Write in clear, direct Hebrew at eye-level for sophisticated investors.
- Mix sentence lengths. Short punchy lines for impact, longer ones for context.
- BANNED phrases: "סולל את הדרך", "קפיצת מדרגה", "חשוב לזכור", "מהווה אבן דרך", "בשורה משמעותית", "נדבך מרכזי", "שינוי פרדיגמה", "פורץ דרך"
- BANNED formatting: No double dashes (--). No unnecessary English in parentheses.
- Do NOT start paragraphs with "במקביל", "בנוסף", "יתרה מכך".

ANALYSIS:
- Connect the dots for investors: what does this news mean for the stock / market?
- Tie it to the Israeli market context when relevant.
- If it's a macro/economy article, analyze impact on banks, real estate, and tech sectors.

ACCURACY:
- Be objective. NO financial advice.
- Do NOT fabricate numbers, dates, or facts not in the article.

News Headline: ${headline}
News Description: ${description}
${ticker ? `Company: ${companyName}\nTicker: ${ticker}.TA` : "Category: Macro / Economy"}
Source: ${source} (${link})

Return a JSON object with these fields:
- titleHe: Hebrew headline (max 80 chars, catchy and specific)
- bodyHe: Full Hebrew analysis (2-3 paragraphs). Sign off with "מאת: ארטיום מנדבורה, אנליסט שוק ההון"
- summaryHe: One sharp sentence summary for investors (max 150 chars)
- sentiment: one of "positive", "negative", or "neutral"
- category: "stock" if about a specific company, "macro" if about economy/market`;

// Extract RSS items using regex
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
    // Handle link without closing tag (Globes RSS style)
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

// Strip HTML tags from description
function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
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

    // 1. Fetch all RSS feeds
    const allItems: Array<{ title: string; link: string; pubDate: string; description: string; source: string }> = [];

    for (const feed of RSS_FEEDS) {
      try {
        console.log(`Fetching RSS: ${feed.source}...`);
        const rssRes = await fetch(feed.url, {
          headers: {
            "User-Agent": "Mozilla/5.0 (compatible; AlphaMapBot/1.0)",
            "Accept": "application/rss+xml, application/xml, text/xml, */*",
          },
        });

        if (!rssRes.ok) {
          console.error(`RSS fetch failed for ${feed.source}: ${rssRes.status}`);
          continue;
        }

        const rssXml = await rssRes.text();
        const items = parseRssItems(rssXml);
        console.log(`Parsed ${items.length} items from ${feed.source}`);

        for (const item of items) {
          allItems.push({ ...item, source: feed.source });
        }
      } catch (e) {
        console.error(`Error fetching ${feed.source}:`, e);
      }
    }

    if (allItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, message: "No items from RSS feeds" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Deduplicate against existing articles by URL
    const urls = allItems.map(i => i.link).filter(Boolean);
    const { data: existing } = await adminClient
      .from("news_articles").select("original_url").in("original_url", urls);

    const existingUrls = new Set((existing || []).map((e: any) => e.original_url));
    const newItems = allItems.filter(i => i.link && !existingUrls.has(i.link));
    console.log(`${newItems.length} new items after dedup (total: ${allItems.length})`);

    if (newItems.length === 0) {
      return new Response(JSON.stringify({ generated: 0, total: allItems.length, message: "All items already exist" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Load tase_symbols for ticker matching
    const { data: symbols } = await adminClient
      .from("tase_symbols").select("ticker, name, name_he, override_name_he, search_text");

    const symbolList = symbols || [];

    // Match company name from headline to a ticker
    function matchTicker(headline: string, description: string): { ticker: string; companyName: string } {
      const searchText = (headline + " " + description).toLowerCase();
      let bestMatch = { ticker: "", companyName: "", score: 0 };

      for (const sym of symbolList) {
        const names = [sym.override_name_he, sym.name_he, sym.name].filter(Boolean);
        for (const name of names) {
          if (name && name.length > 2 && searchText.includes(name.toLowerCase())) {
            const score = name.length;
            if (score > bestMatch.score) {
              bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
            }
          }
        }

        if (sym.ticker && searchText.includes(sym.ticker.toLowerCase())) {
          const score = sym.ticker.length + 5;
          if (score > bestMatch.score) {
            bestMatch = { ticker: sym.ticker, companyName: sym.override_name_he || sym.name_he || sym.name, score };
          }
        }
      }

      return { ticker: bestMatch.ticker, companyName: bestMatch.companyName };
    }

    // 4. Process each new item with AI
    let generated = 0;
    const maxItems = 8;

    for (const item of newItems.slice(0, maxItems)) {
      const cleanDesc = stripHtml(item.description);
      const { ticker, companyName } = matchTicker(item.title, cleanDesc);

      try {
        const prompt = NEWS_PROMPT(item.title, cleanDesc, ticker, companyName || "לא זוהה", item.link, item.source);

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
        const category = parsed.category === "macro" ? "macro" : "stock";

        const { error: insertErr } = await adminClient.from("news_articles").insert({
          status: "draft",
          category,
          original_title: item.title,
          original_headline: item.title,
          original_url: item.link,
          original_source: item.source,
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
          console.log(`Generated: ${item.title} (${ticker || "macro"}) [${parsed.sentiment}]`);
        }
      } catch (e) {
        console.error(`Error processing "${item.title}":`, e);
      }

      // Delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    return new Response(
      JSON.stringify({ generated, total_feed: allItems.length, new_items: newItems.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fetch-tase-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
