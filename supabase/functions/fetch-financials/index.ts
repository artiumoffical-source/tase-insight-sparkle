import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_MAX_AGE_DAYS = 30;

interface FinancialRow {
  year: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  debtToEquity: number;
  cashAndEquiv: number;
}

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
}

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return String(value);
}

function isCacheFresh(lastUpdated: string): boolean {
  const updated = new Date(lastUpdated).getTime();
  const now = Date.now();
  return now - updated < CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function parseFundamentals(data: any, ticker: string, eodPrice?: { price: number; change: number }): { meta: StockMeta; financials: FinancialRow[] } {
  const general = data.General || {};
  const highlights = data.Highlights || {};

  const meta: StockMeta = {
    name: general.Name || ticker,
    price: eodPrice?.price ?? 0,
    change: eodPrice?.change ?? 0,
    marketCap: formatMarketCap(highlights.MarketCapitalization || 0),
    currency: general.CurrencyCode || "ILS",
  };

  const incomeStatements = data.Financials?.Income_Statement?.yearly || {};
  const balanceSheets = data.Financials?.Balance_Sheet?.yearly || {};

  const years = Object.keys(incomeStatements)
    .sort((a, b) => b.localeCompare(a))
    .slice(0, 5);

  const financials: FinancialRow[] = years.map((dateKey) => {
    const income = incomeStatements[dateKey] || {};
    const balance = balanceSheets[dateKey] || {};

    const totalEquity = parseFloat(balance.totalStockholderEquity) || 1;
    const totalDebt =
      (parseFloat(balance.shortLongTermDebt) || 0) +
      (parseFloat(balance.longTermDebt) || 0);

    return {
      year: dateKey.substring(0, 4),
      revenue: parseFloat(income.totalRevenue) || 0,
      grossProfit: parseFloat(income.grossProfit) || 0,
      operatingIncome: parseFloat(income.operatingIncome) || 0,
      netIncome: parseFloat(income.netIncome) || 0,
      debtToEquity: totalEquity !== 0 ? totalDebt / totalEquity : 0,
      cashAndEquiv: parseFloat(balance.cash) || parseFloat(balance.cashAndShortTermInvestments) || 0,
    };
  });

  return { meta, financials };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker")?.toUpperCase()?.replace(/\.TA$/i, "");
    if (!ticker || !/^[A-Z0-9]{1,10}$/.test(ticker)) {
      return new Response(JSON.stringify({ error: "Invalid ticker" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Initialize Supabase client with service role for cache writes
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // 1. Check cache first
    const { data: cached } = await supabase
      .from("cached_fundamentals")
      .select("data, last_updated")
      .eq("ticker", ticker)
      .maybeSingle();

    if (cached && isCacheFresh(cached.last_updated)) {
      console.log(`Cache HIT for ${ticker}`);
      return new Response(
        JSON.stringify(cached.data),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Cache miss or stale — fetch from EODHD
    console.log(`Cache MISS for ${ticker}, fetching from EODHD...`);

    // Fetch fundamentals and real-time EOD price in parallel
    const [resp, eodResp] = await Promise.all([
      fetch(`https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`),
      fetch(`https://eodhd.com/api/eod/${ticker}.TA?api_token=${apiKey}&fmt=json&order=d&limit=2`),
    ]);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("EODHD fundamentals error:", resp.status, text);
      if (cached) {
        console.log(`Returning stale cache for ${ticker}`);
        return new Response(
          JSON.stringify(cached.data),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to fetch data from EODHD", status: resp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse EOD price
    let eodPrice: { price: number; change: number } | undefined;
    if (eodResp.ok) {
      try {
        const eodData = await eodResp.json();
        if (Array.isArray(eodData) && eodData.length > 0) {
          const latest = eodData[0];
          const previous = eodData.length > 1 ? eodData[1] : null;
          const price = latest.close ?? 0;
          const prevClose = previous?.close ?? price;
          const change = prevClose !== 0 ? ((price - prevClose) / prevClose) * 100 : 0;
          eodPrice = { price, change };
        }
      } catch (e) {
        console.error("EOD price parse error:", e);
      }
    }

    const rawData = await resp.json();
    const result = parseFundamentals(rawData, ticker, eodPrice);

    // 3. Upsert cache
    const { error: upsertError } = await supabase
      .from("cached_fundamentals")
      .upsert(
        { ticker, data: result, last_updated: new Date().toISOString() },
        { onConflict: "ticker" }
      );

    if (upsertError) {
      console.error("Cache upsert error:", upsertError);
    } else {
      console.log(`Cached fundamentals for ${ticker}`);
    }

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
