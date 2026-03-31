import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const CACHE_MAX_AGE_DAYS = 30;

function formatMarketCap(value: number): string {
  if (value >= 1e12) return `${(value / 1e12).toFixed(1)}T`;
  if (value >= 1e9) return `${(value / 1e9).toFixed(1)}B`;
  if (value >= 1e6) return `${(value / 1e6).toFixed(0)}M`;
  return String(value);
}

function isCacheFresh(lastUpdated: string): boolean {
  const updated = new Date(lastUpdated).getTime();
  return Date.now() - updated < CACHE_MAX_AGE_DAYS * 24 * 60 * 60 * 1000;
}

function calcAvgGrowth(values: number[]): number | null {
  if (values.length < 2) return null;
  let total = 0, count = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i - 1] !== 0) { total += (values[i] - values[i - 1]) / Math.abs(values[i - 1]); count++; }
  }
  return count > 0 ? (total / count) * 100 : null;
}

function calcAvgMargin(revenues: number[], netIncomes: number[]): number | null {
  if (revenues.length === 0) return null;
  let total = 0, count = 0;
  for (let i = 0; i < revenues.length; i++) {
    if (revenues[i] !== 0) { total += netIncomes[i] / revenues[i]; count++; }
  }
  return count > 0 ? (total / count) * 100 : null;
}

type SectorType = "bank" | "insurance" | "tech" | "general";

function classifySector(gicsSector: string, industry: string): SectorType {
  const s = (gicsSector || "").toLowerCase();
  const ind = (industry || "").toLowerCase();
  if (s.includes("financial") || ind.includes("bank") || ind.includes("lending") || ind.includes("credit")) return "bank";
  if (ind.includes("insurance") || ind.includes("reinsurance")) return "insurance";
  if (s.includes("technology") || ind.includes("software") || ind.includes("saas") || ind.includes("internet") || ind.includes("semiconductor")) return "tech";
  return "general";
}

function buildIncomeRows(incomeStatements: Record<string, any>, dateKeys: string[]) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const inc = incomeStatements[dateKey] || {};
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      revenue: parseFloat(inc.totalRevenue) || 0,
      costOfRevenue: parseFloat(inc.costOfRevenue) || 0,
      grossProfit: parseFloat(inc.grossProfit) || 0,
      operatingIncome: parseFloat(inc.operatingIncome) || 0,
      netIncome: parseFloat(inc.netIncome) || 0,
      ebitda: parseFloat(inc.ebitda) || 0,
      eps: parseFloat(inc.dilutedEPS) || parseFloat(inc.basicEPS) || parseFloat(inc.eps_actual) || 0,
      researchDevelopment: parseFloat(inc.researchDevelopment) || 0,
      interestIncome: parseFloat(inc.interestIncome) || 0,
      nonInterestIncome: parseFloat(inc.nonRecurring) || parseFloat(inc.otherOperatingExpenses) || 0,
      netPremiumsEarned: parseFloat(inc.totalRevenue) || 0, // For insurance, revenue ≈ premiums
    };
  });
}

function buildBalanceRows(balanceSheets: Record<string, any>, dateKeys: string[]) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const bal = balanceSheets[dateKey] || {};
    const totalDebtVal = (parseFloat(bal.shortLongTermDebt) || 0) + (parseFloat(bal.longTermDebt) || 0);
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      totalAssets: parseFloat(bal.totalAssets) || 0,
      totalLiabilities: parseFloat(bal.totalLiab) || 0,
      totalEquity: parseFloat(bal.totalStockholderEquity) || 0,
      cash: parseFloat(bal.cash) || parseFloat(bal.cashAndShortTermInvestments) || 0,
      totalDebt: totalDebtVal,
      inventory: parseFloat(bal.inventory) || 0,
      totalDeposits: parseFloat(bal.otherCurrentLiab) || 0,
      totalInvestments: parseFloat(bal.longTermInvestments) || parseFloat(bal.shortTermInvestments) || 0,
    };
  });
}

function buildDetailedBalanceRows(balanceSheets: Record<string, any>, dateKeys: string[]) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const b = balanceSheets[dateKey] || {};
    const p = (field: string) => parseFloat(b[field]) || 0;
    const totalCurrentAssets = p("totalCurrentAssets") || (p("cash") + p("shortTermInvestments") + p("netReceivables") + p("inventory") + p("otherCurrentAssets"));
    const nonCurrentAssetsTotal = p("nonCurrentAssetsTotal") || (p("totalAssets") - totalCurrentAssets);
    const totalCurrentLiabilities = p("totalCurrentLiabilities") || (p("accountsPayable") + p("shortTermDebt") + p("otherCurrentLiab"));
    const nonCurrentLiabilitiesTotal = p("nonCurrentLiabilitiesTotal") || (p("totalLiab") - totalCurrentLiabilities);
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      totalAssets: p("totalAssets"),
      totalCurrentAssets,
      cash: p("cash") || p("cashAndShortTermInvestments"),
      shortTermInvestments: p("shortTermInvestments"),
      netReceivables: p("netReceivables"),
      inventory: p("inventory"),
      otherCurrentAssets: p("otherCurrentAssets"),
      nonCurrentAssetsTotal,
      propertyPlantEquipment: p("propertyPlantAndEquipmentNet") || p("propertyPlantEquipment"),
      longTermInvestments: p("longTermInvestments"),
      goodwill: p("goodWill") || p("goodwill"),
      intangibleAssets: p("intangibleAssets"),
      otherNonCurrentAssets: p("nonCurrrentAssetsOther") || p("otherNonCurAssets"),
      totalLiabilities: p("totalLiab"),
      totalCurrentLiabilities,
      accountsPayable: p("accountsPayable"),
      shortTermDebt: p("shortTermDebt") || p("shortLongTermDebt"),
      otherCurrentLiabilities: p("otherCurrentLiab"),
      nonCurrentLiabilitiesTotal,
      longTermDebt: p("longTermDebt") || p("longTermDebtTotal"),
      otherNonCurrentLiabilities: p("nonCurrentLiabilitiesOther"),
      totalEquity: p("totalStockholderEquity"),
      commonStock: p("commonStock") || p("commonStockSharesOutstanding"),
      retainedEarnings: p("retainedEarnings"),
      otherEquity: p("accumulatedOtherComprehensiveIncome") || p("otherStockholderEquity"),
    };
  });
}

function buildCashFlowRows(cashFlowStatements: Record<string, any>, incomeStatements: Record<string, any>, dateKeys: string[]) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const cf = cashFlowStatements[dateKey] || {};
    const inc = incomeStatements[dateKey] || {};
    const capex = Math.abs(parseFloat(cf.capitalExpenditures) || 0);
    const opsFlow = parseFloat(cf.totalCashFromOperatingActivities) || 0;
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      netIncome: parseFloat(inc.netIncome) || 0,
      depreciation: parseFloat(cf.depreciation) || 0,
      capex,
      freeCashFlow: parseFloat(cf.freeCashFlow) || (opsFlow - capex),
      cashFromOperations: opsFlow,
    };
  });
}

function parseFundamentals(data: any, ticker: string, eodPrice?: { price: number; change: number }) {
  const general = data.General || {};
  const highlights = data.Highlights || {};
  const valuation = data.Valuation || {};

  const rawLogo = general.LogoURL || null;
  const logoUrl = rawLogo ? (rawLogo.startsWith("http") ? rawLogo : `https://eodhd.com${rawLogo}`) : null;

  const sector = classifySector(general.GicsSector || "", general.Industry || "");

  const meta = {
    name: general.Name || ticker,
    price: eodPrice?.price ?? 0,
    change: eodPrice?.change ?? 0,
    marketCap: formatMarketCap(highlights.MarketCapitalization || 0),
    currency: general.CurrencyCode || "ILS",
    logoUrl,
    sector,
    gicsSector: general.GicsSector || "",
    industry: general.Industry || "",
  };

  const incomeStatements = data.Financials?.Income_Statement?.yearly || {};
  const balanceSheets = data.Financials?.Balance_Sheet?.yearly || {};
  const cashFlowStatements = data.Financials?.Cash_Flow?.yearly || {};

  const allYears = Object.keys(incomeStatements).sort((a, b) => a.localeCompare(b));
  const years5 = allYears.slice(-5);
  const years10 = allYears.slice(-10);

  // Legacy financials
  const financials = years5.slice().reverse().map((dateKey) => {
    const income = incomeStatements[dateKey] || {};
    const balance = balanceSheets[dateKey] || {};
    const totalEquity = parseFloat(balance.totalStockholderEquity) || 1;
    const totalDebt = (parseFloat(balance.shortLongTermDebt) || 0) + (parseFloat(balance.longTermDebt) || 0);
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

  // Annual 3-statement
  const incomeStatement = buildIncomeRows(incomeStatements, years5);
  const balanceSheet = buildBalanceRows(balanceSheets, years5);
  const cashFlow = buildCashFlowRows(cashFlowStatements, incomeStatements, years5);
  const detailedBalanceSheet = buildDetailedBalanceRows(balanceSheets, years5);

  // Quarterly 3-statement
  const qIncomeStatements = data.Financials?.Income_Statement?.quarterly || {};
  const qBalanceSheets = data.Financials?.Balance_Sheet?.quarterly || {};
  const qCashFlowStatements = data.Financials?.Cash_Flow?.quarterly || {};
  const allQuarters = Object.keys(qIncomeStatements).sort((a, b) => a.localeCompare(b)).slice(-8);

  const qIncomeStatement = buildIncomeRows(qIncomeStatements, allQuarters);
  const qBalanceSheet = buildBalanceRows(qBalanceSheets, allQuarters);
  const qCashFlow = buildCashFlowRows(qCashFlowStatements, qIncomeStatements, allQuarters);

  // Key metrics
  const rev5 = years5.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni5 = years5.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);
  const rev10 = years10.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni10 = years10.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);

  const keyMetrics = {
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

  return {
    meta,
    financials,
    incomeStatement,
    balanceSheet,
    cashFlow,
    detailedBalanceSheet,
    qIncomeStatement,
    qBalanceSheet,
    qCashFlow,
    keyMetrics,
  };
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
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("EODHD_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const force = url.searchParams.get("force") === "true";

    const { data: cached } = await supabase
      .from("cached_fundamentals")
      .select("data, last_updated")
      .eq("ticker", ticker)
      .maybeSingle();

    // Always fetch fresh price
    let eodPrice: { price: number; change: number } | undefined;
    try {
      const symbol = ticker.includes(".") ? ticker : `${ticker}.TA`;
      const rtResp = await fetch(`https://eodhd.com/api/real-time/${symbol}?api_token=${apiKey}&fmt=json`);
      if (rtResp.ok) {
        const rtData = await rtResp.json();
        console.log("EODHD Real-Time Response:", JSON.stringify(rtData));
        const price = Number(rtData?.close) || Number(rtData?.previousClose) || Number(rtData?.open) || 0;
        const change = Number(rtData?.change_p) || 0;
        if (price > 0) eodPrice = { price, change };
      }
    } catch (e) {
      console.error("Real-time price fetch error:", e);
    }

    // Return cached if fresh
    if (cached && isCacheFresh(cached.last_updated)) {
      console.log(`Cache HIT for ${ticker} fundamentals`);
      const d = cached.data as any;
      const cachedMeta = d?.meta ?? {};
      // Re-build detailedBalanceSheet if cached version is empty (from old cache)
      let detailedBS = d?.detailedBalanceSheet ?? [];
      if ((!detailedBS || detailedBS.length === 0) && d?.meta) {
        // Try to re-parse from raw EODHD if we have the raw data
        // Otherwise build from basic balance sheet
        const basicBS = d?.balanceSheet ?? [];
        detailedBS = basicBS.map((row: any) => ({
          year: row.year,
          totalAssets: row.totalAssets || 0,
          totalCurrentAssets: (row.cash || 0) + (row.inventory || 0),
          cash: row.cash || 0,
          shortTermInvestments: 0,
          netReceivables: 0,
          inventory: row.inventory || 0,
          otherCurrentAssets: 0,
          nonCurrentAssetsTotal: (row.totalAssets || 0) - ((row.cash || 0) + (row.inventory || 0)),
          propertyPlantEquipment: 0,
          longTermInvestments: row.totalInvestments || 0,
          goodwill: 0, intangibleAssets: 0, otherNonCurrentAssets: 0,
          totalLiabilities: row.totalLiabilities || 0,
          totalCurrentLiabilities: 0, accountsPayable: 0, shortTermDebt: 0, otherCurrentLiabilities: 0,
          nonCurrentLiabilitiesTotal: 0,
          longTermDebt: row.totalDebt || 0, otherNonCurrentLiabilities: 0,
          totalEquity: row.totalEquity || 0,
          commonStock: 0, retainedEarnings: 0, otherEquity: 0,
        }));
      }
      return new Response(JSON.stringify({
        meta: { ...cachedMeta, price: eodPrice?.price ?? cachedMeta.price ?? 0, change: eodPrice?.change ?? cachedMeta.change ?? 0 },
        financials: d?.financials ?? [],
        incomeStatement: d?.incomeStatement ?? [],
        balanceSheet: d?.balanceSheet ?? [],
        cashFlow: d?.cashFlow ?? [],
        detailedBalanceSheet: detailedBS,
        qIncomeStatement: d?.qIncomeStatement ?? [],
        qBalanceSheet: d?.qBalanceSheet ?? [],
        qCashFlow: d?.qCashFlow ?? [],
        keyMetrics: d?.keyMetrics ?? null,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Fetch from EODHD
    console.log(`Cache MISS for ${ticker}, fetching fundamentals from EODHD...`);
    let resp = await fetch(`https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`);
    // Retry once on 429 after a short delay
    if (resp.status === 429) {
      console.warn(`EODHD 429 for ${ticker} fundamentals, retrying in 3s...`);
      await new Promise(r => setTimeout(r, 3000));
      resp = await fetch(`https://eodhd.com/api/fundamentals/${ticker}.TA?api_token=${apiKey}&fmt=json`);
    }

    if (!resp.ok) {
      const text = await resp.text();
      console.error("EODHD fundamentals error:", resp.status, text);
      if (cached) {
        const d = cached.data as any;
        const cachedMeta = d?.meta ?? {};
        return new Response(JSON.stringify({
          meta: { ...cachedMeta, price: eodPrice?.price ?? cachedMeta.price ?? 0, change: eodPrice?.change ?? cachedMeta.change ?? 0 },
          financials: d?.financials ?? [],
          incomeStatement: d?.incomeStatement ?? [],
          balanceSheet: d?.balanceSheet ?? [],
          cashFlow: d?.cashFlow ?? [],
          detailedBalanceSheet: d?.detailedBalanceSheet ?? [],
          qIncomeStatement: d?.qIncomeStatement ?? [],
          qBalanceSheet: d?.qBalanceSheet ?? [],
          qCashFlow: d?.qCashFlow ?? [],
          keyMetrics: d?.keyMetrics ?? null,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      return new Response(JSON.stringify({ error: "Failed to fetch data from EODHD", status: resp.status }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const rawData = await resp.json();
    const result = parseFundamentals(rawData, ticker, eodPrice);

    // Upsert cache
    const { error: upsertError } = await supabase
      .from("cached_fundamentals")
      .upsert({ ticker, data: result, last_updated: new Date().toISOString() }, { onConflict: "ticker" });
    if (upsertError) console.error("Cache upsert error:", upsertError);
    else console.log(`Cached fundamentals for ${ticker}`);

    if (result.meta.logoUrl) {
      await supabase.from("tase_symbols").update({ logo_url: result.meta.logoUrl }).eq("ticker", ticker);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
