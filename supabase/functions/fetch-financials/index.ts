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

interface KeyMetrics {
  peRatio: number | null;
  psRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roa: number | null;
  revenueGrowth5Y: number | null;
  revenueGrowth10Y: number | null;
  netIncomeMargin5Y: number | null;
  netIncomeMargin10Y: number | null;
}

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
  logoUrl: string | null;
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

function calcAvgGrowth(values: number[]): number | null {
  if (values.length < 2) return null;
  let totalGrowth = 0;
  let count = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) {
      totalGrowth += (values[i] - values[i - 1]) / Math.abs(values[i - 1]);
      count++;
    }
  }
  return count > 0 ? (totalGrowth / count) * 100 : null;
}

function calcAvgMargin(revenues: number[], netIncomes: number[]): number | null {
  if (revenues.length === 0) return null;
  let total = 0;
  let count = 0;
  for (let i = 0; i < revenues.length; i++) {
    if (revenues[i] !== 0) {
      total += netIncomes[i] / revenues[i];
      count++;
    }
  }
  return count > 0 ? (total / count) * 100 : null;
}

function parseFundamentals(data: any, ticker: string, eodPrice?: { price: number; change: number }): { meta: StockMeta; financials: FinancialRow[]; keyMetrics: KeyMetrics } {
  const general = data.General || {};
  const highlights = data.Highlights || {};
  const valuation = data.Valuation || {};

  const rawLogo = general.LogoURL || null;
  const logoUrl = rawLogo ? (rawLogo.startsWith("http") ? rawLogo : `https://eodhd.com${rawLogo}`) : null;

  const meta: StockMeta = {
    name: general.Name || ticker,
    price: eodPrice?.price ?? 0,
    change: eodPrice?.change ?? 0,
    marketCap: formatMarketCap(highlights.MarketCapitalization || 0),
    currency: general.CurrencyCode || "ILS",
    logoUrl,
  };

  const incomeStatements = data.Financials?.Income_Statement?.yearly || {};
  const balanceSheets = data.Financials?.Balance_Sheet?.yearly || {};

  const allYears = Object.keys(incomeStatements)
    .sort((a, b) => a.localeCompare(b));

  const years5 = allYears.slice(-5);
  const years10 = allYears.slice(-10);

  const cashFlowStatements = data.Financials?.Cash_Flow?.yearly || {};

  const financials: FinancialRow[] = years5.slice().reverse().map((dateKey) => {
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

  // Income Statement rows
  const incomeStatement = years5.slice().reverse().map((dateKey) => {
    const inc = incomeStatements[dateKey] || {};
    return {
      year: dateKey.substring(0, 4),
      revenue: parseFloat(inc.totalRevenue) || 0,
      costOfRevenue: parseFloat(inc.costOfRevenue) || 0,
      grossProfit: parseFloat(inc.grossProfit) || 0,
      operatingIncome: parseFloat(inc.operatingIncome) || 0,
      netIncome: parseFloat(inc.netIncome) || 0,
      ebitda: parseFloat(inc.ebitda) || 0,
      eps: parseFloat(inc.dilutedEPS || inc.basicEPS) || 0,
    };
  });

  // Balance Sheet rows
  const balanceSheet = years5.slice().reverse().map((dateKey) => {
    const bal = balanceSheets[dateKey] || {};
    const totalDebtVal = (parseFloat(bal.shortLongTermDebt) || 0) + (parseFloat(bal.longTermDebt) || 0);
    return {
      year: dateKey.substring(0, 4),
      totalAssets: parseFloat(bal.totalAssets) || 0,
      totalLiabilities: parseFloat(bal.totalLiab) || 0,
      totalEquity: parseFloat(bal.totalStockholderEquity) || 0,
      cash: parseFloat(bal.cash) || parseFloat(bal.cashAndShortTermInvestments) || 0,
      totalDebt: totalDebtVal,
      inventory: parseFloat(bal.inventory) || 0,
    };
  });

  // Cash Flow rows
  const cashFlow = years5.slice().reverse().map((dateKey) => {
    const cf = cashFlowStatements[dateKey] || {};
    const inc = incomeStatements[dateKey] || {};
    const capex = Math.abs(parseFloat(cf.capitalExpenditures) || 0);
    const opsFlow = parseFloat(cf.totalCashFromOperatingActivities) || 0;
    return {
      year: dateKey.substring(0, 4),
      netIncome: parseFloat(inc.netIncome) || 0,
      depreciation: parseFloat(cf.depreciation) || 0,
      capex,
      freeCashFlow: parseFloat(cf.freeCashFlow) || (opsFlow - capex),
      cashFromOperations: opsFlow,
    };
  });

  const rev5 = years5.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni5 = years5.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);
  const rev10 = years10.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni10 = years10.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);

  const keyMetrics: KeyMetrics = {
    peRatio: valuation.TrailingPE ? parseFloat(valuation.TrailingPE) : (highlights.PERatio ? parseFloat(highlights.PERatio) : null),
    psRatio: valuation.PriceSalesTTM ? parseFloat(valuation.PriceSalesTTM) : null,
    pbRatio: valuation.PriceBookMRQ ? parseFloat(valuation.PriceBookMRQ) : null,
    roe: highlights.ReturnOnEquityTTM ? parseFloat(highlights.ReturnOnEquityTTM) * 100 : null,
    roa: highlights.ReturnOnAssetsTTM ? parseFloat(highlights.ReturnOnAssetsTTM) * 100 : null,
    revenueGrowth5Y: calcAvgGrowth(rev5),
    revenueGrowth10Y: calcAvgGrowth(rev10),
    netIncomeMargin5Y: calcAvgMargin(rev5, ni5),
    netIncomeMargin10Y: calcAvgMargin(rev10, ni10),
  };

  return { meta, financials, keyMetrics, incomeStatement, balanceSheet, cashFlow };
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

    // For fundamentals (financials), use cache. But always fetch fresh price.
    let cachedFinancials: FinancialRow[] | null = null;
    if (cached && isCacheFresh(cached.last_updated)) {
      console.log(`Cache HIT for ${ticker} fundamentals`);
      cachedFinancials = (cached.data as any)?.financials ?? null;
    }

    // Always fetch fresh real-time price
    let eodPrice: { price: number; change: number } | undefined;
    try {
      const symbol = ticker.includes(".") ? ticker : `${ticker}.TA`;
      const rtResp = await fetch(
        `https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`
      );
      if (rtResp.ok) {
        const rtData = await rtResp.json();
        console.log("EODHD Real-Time Response:", JSON.stringify(rtData));
        const price = Number(rtData?.close) || Number(rtData?.previousClose) || Number(rtData?.open) || 0;
        const change = Number(rtData?.change_p) || 0;
        if (price > 0) {
          eodPrice = { price, change };
        }
      }
    } catch (e) {
      console.error("Real-time price fetch error:", e);
    }

    if (cachedFinancials) {
      // Return cached fundamentals with fresh price
      const cachedMeta = (cached!.data as any)?.meta ?? {};
      const freshResult = {
        meta: { ...cachedMeta, price: eodPrice?.price ?? cachedMeta.price ?? 0, change: eodPrice?.change ?? cachedMeta.change ?? 0 },
        financials: cachedFinancials,
      };
      return new Response(
        JSON.stringify(freshResult),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Cache miss or stale — fetch fundamentals from EODHD
    console.log(`Cache MISS for ${ticker}, fetching fundamentals from EODHD...`);
    const resp = await fetch(`https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`);

    if (!resp.ok) {
      const text = await resp.text();
      console.error("EODHD fundamentals error:", resp.status, text);
      if (cached) {
        console.log(`Returning stale cache for ${ticker}`);
        const cachedMeta = (cached.data as any)?.meta ?? {};
        const staleResult = {
          meta: { ...cachedMeta, price: eodPrice?.price ?? cachedMeta.price ?? 0, change: eodPrice?.change ?? cachedMeta.change ?? 0 },
          financials: (cached.data as any)?.financials ?? [],
        };
        return new Response(
          JSON.stringify(staleResult),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      return new Response(
        JSON.stringify({ error: "Failed to fetch data from EODHD", status: resp.status }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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

    // Also update logo_url in tase_symbols if we got one
    if (result.meta.logoUrl) {
      await supabase
        .from("tase_symbols")
        .update({ logo_url: result.meta.logoUrl })
        .eq("ticker", ticker);
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
