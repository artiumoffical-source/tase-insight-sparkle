import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
// @ts-ignore wasm module
import { Resvg, initWasm } from "https://esm.sh/@aspect-dev/resvg-wasm@0.1.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

let wasmInitialized = false;

async function ensureWasm() {
  if (!wasmInitialized) {
    const wasmUrl = "https://unpkg.com/@aspect-dev/resvg-wasm@0.1.0/index_bg.wasm";
    const wasmResp = await fetch(wasmUrl);
    const wasmBytes = await wasmResp.arrayBuffer();
    await initWasm(wasmBytes);
    wasmInitialized = true;
  }
}

// Google Fonts Heebo (Hebrew-supporting) - fetched once and cached
let fontData: ArrayBuffer | null = null;

async function getFont(): Promise<ArrayBuffer> {
  if (fontData) return fontData;
  const resp = await fetch(
    "https://fonts.gstatic.com/s/heebo/v22/NGSpv5_NC0k9P_v6ZUCbLRAHxK1EiSysdUmj.woff2"
  );
  fontData = await resp.arrayBuffer();
  return fontData;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length + word.length + 1 > maxCharsPerLine && current) {
      lines.push(current.trim());
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.trim()) lines.push(current.trim());
  return lines.slice(0, 3); // max 3 lines
}

function buildSvg(title: string, ticker: string | null, sentiment: string | null, source: string, fontBase64: string): string {
  const W = 1200;
  const H = 630;

  const lines = wrapText(title, 35);
  const lineHeight = 58;
  const titleStartY = 260 - ((lines.length - 1) * lineHeight) / 2;

  const titleLines = lines
    .map((line, i) => `<text x="${W / 2}" y="${titleStartY + i * lineHeight}" font-family="Heebo" font-size="44" font-weight="700" fill="white" text-anchor="middle" direction="rtl" unicode-bidi="bidi-override">${escapeXml(line)}</text>`)
    .join("\n    ");

  const sentimentColor = sentiment === "positive" ? "#22c55e" : sentiment === "negative" ? "#ef4444" : "#94a3b8";
  const sentimentLabel = sentiment === "positive" ? "חיובי" : sentiment === "negative" ? "שלילי" : "ניטרלי";

  const tickerBadge = ticker
    ? `<rect x="${W / 2 - 60}" y="350" width="120" height="36" rx="18" fill="rgba(255,255,255,0.12)"/>
    <text x="${W / 2}" y="374" font-family="Heebo" font-size="18" font-weight="600" fill="white" text-anchor="middle">${escapeXml(ticker)}.TA</text>`
    : "";

  const sentimentBadge = `<rect x="${W / 2 - 40}" y="400" width="80" height="28" rx="14" fill="${sentimentColor}20"/>
    <text x="${W / 2}" y="420" font-family="Heebo" font-size="14" font-weight="500" fill="${sentimentColor}" text-anchor="middle" direction="rtl" unicode-bidi="bidi-override">${escapeXml(sentimentLabel)}</text>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <style>
      @font-face {
        font-family: 'Heebo';
        src: url('data:font/woff2;base64,${fontBase64}') format('woff2');
        font-weight: 700;
      }
    </style>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="50%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
    <linearGradient id="accent" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="#3b82f6"/>
      <stop offset="100%" stop-color="#8b5cf6"/>
    </linearGradient>
  </defs>

  <!-- Background -->
  <rect width="${W}" height="${H}" fill="url(#bg)"/>

  <!-- Subtle grid pattern -->
  <g opacity="0.03">
    ${Array.from({ length: 20 }, (_, i) => `<line x1="${i * 60}" y1="0" x2="${i * 60}" y2="${H}" stroke="white" stroke-width="1"/>`).join("\n    ")}
    ${Array.from({ length: 11 }, (_, i) => `<line x1="0" y1="${i * 63}" x2="${W}" y2="${i * 63}" stroke="white" stroke-width="1"/>`).join("\n    ")}
  </g>

  <!-- Top accent bar -->
  <rect x="0" y="0" width="${W}" height="4" fill="url(#accent)"/>

  <!-- AlphaMap watermark -->
  <text x="${W / 2}" y="100" font-family="Heebo" font-size="14" font-weight="500" fill="rgba(255,255,255,0.25)" text-anchor="middle" letter-spacing="6">ALPHAMAP</text>

  <!-- Title -->
  ${titleLines}

  <!-- Ticker badge -->
  ${tickerBadge}

  <!-- Sentiment badge -->
  ${sentimentBadge}

  <!-- Bottom bar -->
  <rect x="0" y="${H - 60}" width="${W}" height="60" fill="rgba(0,0,0,0.3)"/>
  <text x="40" y="${H - 28}" font-family="Heebo" font-size="16" font-weight="500" fill="rgba(255,255,255,0.6)">alpha-map.com</text>
  <text x="${W - 40}" y="${H - 28}" font-family="Heebo" font-size="14" font-weight="400" fill="rgba(255,255,255,0.4)" text-anchor="end" direction="rtl" unicode-bidi="bidi-override">ניתוח שוק ההון הישראלי</text>
</svg>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const articleId = url.searchParams.get("id");

    if (!articleId) {
      return new Response("Missing id parameter", { status: 400, headers: corsHeaders });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: article, error } = await supabase
      .from("news_articles")
      .select("ai_title_he, related_ticker, sentiment, original_source, status")
      .eq("id", articleId)
      .maybeSingle();

    if (error || !article) {
      return new Response("Article not found", { status: 404, headers: corsHeaders });
    }

    // Fetch font and init wasm in parallel
    const [fontBuffer] = await Promise.all([
      getFont(),
      ensureWasm(),
    ]);

    const fontBase64 = btoa(
      String.fromCharCode(...new Uint8Array(fontBuffer))
    );

    const svg = buildSvg(
      article.ai_title_he || "AlphaMap Analysis",
      article.related_ticker,
      article.sentiment,
      article.original_source,
      fontBase64
    );

    const resvg = new Resvg(svg, {
      fitTo: { mode: "width", value: 1200 },
    });
    const pngData = resvg.render();
    const pngBuffer = pngData.asPng();

    return new Response(pngBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=86400, s-maxage=604800",
      },
    });
  } catch (err) {
    console.error("OG image generation error:", err);
    // Return a 1x1 transparent pixel as fallback
    const fallback = new Uint8Array([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82,
      0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137,
      0, 0, 0, 11, 73, 68, 65, 84, 120, 156, 99, 96, 0, 2, 0, 0, 5, 0, 1,
      226, 38, 5, 155, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130,
    ]);
    return new Response(fallback, {
      headers: { ...corsHeaders, "Content-Type": "image/png" },
    });
  }
});
