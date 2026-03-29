import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const ticker = url.searchParams.get("ticker")?.toUpperCase();
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

    // Fetch fundamentals from EODHD (TASE exchange code is "TA")
    const apiUrl = `https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`;
    const resp = await fetch(apiUrl);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("EODHD error:", resp.status, text);
      return new Response(
        JSON.stringify({ error: "Failed to fetch data from EODHD", status: resp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await resp.json();

    // Extract general info for stock metadata
    const general = data.General || {};
    const highlights = data.Highlights || {};
    const valuation = data.Valuation || {};

    const meta: StockMeta = {
      name: general.Name || ticker,
      price: highlights.WallStreetTargetPrice || 0,
      change: highlights.QuarterlyRevenueGrowthYOY || 0,
      marketCap: formatMarketCap(highlights.MarketCapitalization || 0),
      currency: general.CurrencyCode || "ILS",
    };

    // Extract income statement data (annual) for last 5 years
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

    return new Response(
      JSON.stringify({ meta, financials }),
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

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return String(value);
}
