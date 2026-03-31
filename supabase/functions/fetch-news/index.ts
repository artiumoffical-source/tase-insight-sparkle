const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

async function translateTexts(texts: string[], lovableKey: string): Promise<string[]> {
  try {
    const prompt = `Translate the following English texts to Hebrew. Return ONLY a JSON array of translated strings, same order, no extra text.\n\n${JSON.stringify(texts)}`;
    
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [
          { role: "system", content: "You are a professional English-to-Hebrew translator for financial news. Return ONLY a JSON array of translated strings." },
          { role: "user", content: prompt },
        ],
      }),
    });

    if (!res.ok) {
      console.error("Translation API error:", res.status);
      return texts; // fallback to original
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content ?? "";
    // Extract JSON array from response
    const match = content.match(/\[[\s\S]*\]/);
    if (match) {
      const parsed = JSON.parse(match[0]);
      if (Array.isArray(parsed) && parsed.length === texts.length) {
        return parsed;
      }
    }
    return texts;
  } catch (err) {
    console.error("Translation error:", err);
    return texts;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker");
    if (!ticker) {
      return new Response(JSON.stringify({ error: "ticker required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "EODHD API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const limit = 15;
    const newsUrl = `https://eodhd.com/api/news?s=${ticker}.TA&offset=0&limit=${limit}&api_token=${apiKey}&fmt=json`;
    console.log("Fetching news:", newsUrl.replace(apiKey, "***"));

    let res = await fetch(newsUrl);
    // Retry once on 429 after a short delay
    if (res.status === 429) {
      console.warn("EODHD 429 for news, retrying in 2s...");
      await new Promise(r => setTimeout(r, 2000));
      res = await fetch(newsUrl);
    }
    if (!res.ok) {
      const body = await res.text();
      console.error("EODHD news error:", res.status, body.slice(0, 200));
      return new Response(JSON.stringify({ items: [], avgSentiment: 0, warning: `EODHD ${res.status}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const articles = await res.json();

    const items = (Array.isArray(articles) ? articles : []).map((a: any) => ({
      title: a.title ?? "",
      titleHe: "", // will be filled by translation
      content: a.content ?? a.text ?? a.summary ?? "",
      contentHe: "",
      url: a.link ?? a.url ?? "",
      source: a.source ?? "",
      date: a.date ?? "",
      image: a.image ?? a.banner_image ?? null,
      sentiment: typeof a.sentiment === "object"
        ? (a.sentiment?.polarity ?? a.sentiment?.score ?? 0)
        : (typeof a.sentiment === "number" ? a.sentiment : 0),
    }));

    // Translate titles and content summaries to Hebrew
    const lovableKey = Deno.env.get("LOVABLE_API_KEY");
    if (lovableKey && items.length > 0) {
      // Translate titles
      const titles = items.map((i: any) => i.title).filter(Boolean);
      if (titles.length > 0) {
        const translatedTitles = await translateTexts(titles, lovableKey);
        let tIdx = 0;
        for (const item of items) {
          if (item.title) {
            item.titleHe = translatedTitles[tIdx] ?? item.title;
            tIdx++;
          }
        }
      }

      // Translate content summaries (first 200 chars each to save tokens)
      const summaries = items.map((i: any) => (i.content || "").slice(0, 300)).filter(Boolean);
      if (summaries.length > 0) {
        const translatedContent = await translateTexts(summaries, lovableKey);
        let cIdx = 0;
        for (const item of items) {
          const snippet = (item.content || "").slice(0, 300);
          if (snippet) {
            item.contentHe = translatedContent[cIdx] ?? "";
            cIdx++;
          }
        }
      }
    }

    // Calculate average sentiment
    const scores = items.map((i: any) => Number(i.sentiment) || 0);
    const avgSentiment = scores.length > 0
      ? scores.reduce((s: number, v: number) => s + v, 0) / scores.length
      : 0;

    return new Response(JSON.stringify({ items, avgSentiment }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("fetch-news error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
