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

function buildIncomeRows(incomeStatements: Record<string, any>, dateKeys: string[], sharesMap: Record<string, number>, fallbackShares: number) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const inc = incomeStatements[dateKey] || {};
    const netIncome = parseFloat(inc.netIncome) || 0;
    // Try API EPS fields first
    let eps = parseFloat(inc.dilutedEPS) || parseFloat(inc.basicEPS) || parseFloat(inc.eps_actual) || 0;
    
    // If no API EPS, calculate from shares outstanding
    if (eps === 0 && netIncome !== 0) {
      const year = dateKey.substring(0, 4);
      const shares = sharesMap[year] || fallbackShares;
      if (shares > 0) {
        eps = Math.round((netIncome / shares) * 100) / 100;
      }
    }
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      revenue: parseFloat(inc.totalRevenue) || 0,
      costOfRevenue: parseFloat(inc.costOfRevenue) || 0,
      grossProfit: parseFloat(inc.grossProfit) || 0,
      operatingIncome: parseFloat(inc.operatingIncome) || 0,
      netIncome,
      ebitda: parseFloat(inc.ebitda) || 0,
      eps,
      researchDevelopment: parseFloat(inc.researchDevelopment) || 0,
      interestIncome: parseFloat(inc.interestIncome) || 0,
      nonInterestIncome: parseFloat(inc.nonRecurring) || parseFloat(inc.otherOperatingExpenses) || 0,
      netPremiumsEarned: parseFloat(inc.totalRevenue) || 0,
    };
  });
}

// Dynamically search the balance sheet JSON for the equity gap
function findEquityGap(bal: Record<string, any>, totalAssets: number, totalLiab: number, totalEquity: number): number {
  // First try known MI fields
  const knownMIFields = [
    "minorityInterest", "nonControllingInterest", "noncontrollingInterestInConsolidatedEntity",
    "minority_interest", "non_controlling_interest"
  ];
  for (const field of knownMIFields) {
    const val = parseFloat(bal[field]);
    if (val && !isNaN(val) && val > 0) return val;
  }

  // Try other equity-adjacent fields that EODHD sometimes uses
  const otherEquityFields = [
    "preferredStock", "preferredStockTotalEquity", "preferred_stock",
    "otherEquity", "otherStockholderEquity", "accumulatedOtherComprehensiveIncome",
    "treasuryStock", "capitalSurplus", "additionalPaidInCapital"
  ];
  let candidateSum = 0;
  for (const field of otherEquityFields) {
    const val = parseFloat(bal[field]);
    if (val && !isNaN(val)) candidateSum += val;
  }

  // If known fields don't help, derive from the gap itself (Assets - Liab - Equity)
  const gap = totalAssets - totalLiab - totalEquity;
  if (gap > 0 && gap / totalAssets < 0.5) return gap;
  return 0;
}

function buildBalanceRows(balanceSheets: Record<string, any>, dateKeys: string[]) {
  return dateKeys.slice().reverse().map((dateKey) => {
    const bal = balanceSheets[dateKey] || {};
    const totalDebtVal = (parseFloat(bal.shortLongTermDebt) || 0) + (parseFloat(bal.longTermDebt) || 0);
    const totalAssets = parseFloat(bal.totalAssets) || 0;
    const totalLiab = parseFloat(bal.totalLiab) || 0;
    const totalEquity = parseFloat(bal.totalStockholderEquity) || 0;
    const mi = findEquityGap(bal, totalAssets, totalLiab, totalEquity);
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      totalAssets,
      totalLiabilities: totalLiab,
      totalEquity: totalEquity + mi,
      minorityInterest: mi,
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
      totalEquity: (() => {
        const te = p("totalStockholderEquity");
        const ta = p("totalAssets"), tl = p("totalLiab");
        const mi = findEquityGap(b, ta, tl, te);
        return te + mi;
      })(),
      minorityInterest: (() => {
        const te = p("totalStockholderEquity");
        const ta = p("totalAssets"), tl = p("totalLiab");
        return findEquityGap(b, ta, tl, te);
      })(),
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

function parseFundamentals(data: any, ticker: string, eodPrice?: { price: number; change: number }, exchangeRate?: number, primaryPrice?: number) {
  const general = data.General || {};
  const highlights = data.Highlights || {};
  const valuation = data.Valuation || {};
  const technicals = data.Technicals || {};

  const rawLogo = general.LogoURL || null;
  const logoUrl = rawLogo ? (rawLogo.startsWith("http") ? rawLogo : `https://eodhd.com${rawLogo}`) : null;

  const sector = classifySector(general.GicsSector || "", general.Industry || "");
  // Build shares map from outstandingShares.annual (year -> shares count)
  const sharesMap: Record<string, number> = {};
  const outstandingSharesAnnual = data.outstandingShares?.annual || {};
  for (const entry of Object.values(outstandingSharesAnnual) as any[]) {
    const year = String(entry?.dateFormatted || entry?.date || "").substring(0, 4);
    const shares = parseFloat(entry?.shares) || 0;
    if (year && shares > 0) sharesMap[year] = shares;
  }
  
  // Fallback: try General/Highlights or derive from MarketCap/Price
  let fallbackShares = parseFloat(general.SharesOutstanding) || parseFloat(highlights.SharesOutstanding) || 0;
  if (fallbackShares === 0) {
    const mc = parseFloat(highlights.MarketCapitalization) || 0;
    const earningsShare = parseFloat(highlights.EarningsShare) || 0;
    const ni = parseFloat(highlights.NetIncomeTTM) || 0;
    if (earningsShare > 0 && ni > 0) {
      fallbackShares = Math.round(ni / earningsShare);
    } else if (mc > 0 && eodPrice && eodPrice.price > 0) {
      fallbackShares = Math.round(mc / eodPrice.price);
    }
  }
  
  console.log(`[${ticker}] SharesMap: ${JSON.stringify(sharesMap)}, fallbackShares: ${fallbackShares}`);

  // Use the already-detected reporting currency passed via eodPrice metadata
  // The caller (serve handler) does the multi-signal detection; parseFundamentals just uses it
  const incomeStatements = data.Financials?.Income_Statement?.yearly || {};
  const firstIncomeKey = Object.keys(incomeStatements).sort().reverse()[0];
  // Fallback detection within parseFundamentals (shouldn't be needed — caller overrides meta.currency)
  const stmtCcyRaw = firstIncomeKey ? incomeStatements[firstIncomeKey]?.currency_symbol : null;
  const stmtCcy = stmtCcyRaw === "ILA" ? "ILS" : stmtCcyRaw;
  const generalReportingCcy = general.ReportingCurrency || general.reporting_currency || null;
  let normalizedCurrency = generalReportingCcy ? (generalReportingCcy === "ILA" ? "ILS" : generalReportingCcy)
    : (stmtCcy && stmtCcy !== "ILS" && stmtCcy !== "None") ? stmtCcy
    : (general.CurrencyCode === "ILA" ? "ILS" : general.CurrencyCode || "ILS");
  // Check for US listing as override signal
  const listings = general.Listings || {};
  for (const [, listing] of Object.entries(listings) as [string, any][]) {
    const exch = (listing?.Exchange || "").toUpperCase();
    if (["NYSE", "NASDAQ", "US"].includes(exch) && normalizedCurrency === "ILS") {
      normalizedCurrency = "USD";
      break;
    }
  }
  console.log(`[${ticker}] parseFundamentals currency: ${normalizedCurrency}`);

  const meta = {
    name: general.Name || ticker,
    price: eodPrice?.price ?? 0,
    change: eodPrice?.change ?? 0,
    marketCap: formatMarketCap(highlights.MarketCapitalization || 0),
    currency: normalizedCurrency,
    logoUrl,
    sector,
    gicsSector: general.GicsSector || "",
    industry: general.Industry || "",
  };

  // incomeStatements already declared above for currency detection
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
  const incomeStatement = buildIncomeRows(incomeStatements, years5, sharesMap, fallbackShares);
  const balanceSheet = buildBalanceRows(balanceSheets, years5);
  const cashFlow = buildCashFlowRows(cashFlowStatements, incomeStatements, years5);
  const detailedBalanceSheet = buildDetailedBalanceRows(balanceSheets, years5);

  // Quarterly 3-statement
  const qIncomeStatements = data.Financials?.Income_Statement?.quarterly || {};
  const qBalanceSheets = data.Financials?.Balance_Sheet?.quarterly || {};
  const qCashFlowStatements = data.Financials?.Cash_Flow?.quarterly || {};
  const allQuarters = Object.keys(qIncomeStatements).sort((a, b) => a.localeCompare(b)).slice(-8);

  const qIncomeStatement = buildIncomeRows(qIncomeStatements, allQuarters, sharesMap, fallbackShares);
  const qBalanceSheet = buildBalanceRows(qBalanceSheets, allQuarters);
  const qCashFlow = buildCashFlowRows(qCashFlowStatements, qIncomeStatements, allQuarters);

  // Key metrics — handle cross-currency valuation multiples
  const rev5 = years5.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni5 = years5.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);
  const rev10 = years10.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni10 = years10.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);

  // Detect trading vs reporting currency mismatch
  const tradingCurrency = (general.CurrencyCode === "ILA" ? "ILS" : general.CurrencyCode) || "ILS";
  const needsCurrencyConversion = exchangeRate && exchangeRate !== 1 && tradingCurrency !== normalizedCurrency;

  // Market cap: for dual-listed stocks, EODHD's MarketCapitalization for .TA only reflects
  // TASE-traded shares, NOT global market cap. Compute from total shares × price instead.
  let adjustedMarketCap = 0;
  const rawMarketCap = parseFloat(highlights.MarketCapitalization) || 0;

  if (needsCurrencyConversion) {
    // Compute global market cap from total shares outstanding × price, converted to reporting currency
    const latestYear = Object.keys(sharesMap).sort().reverse()[0];
    const totalShares = sharesMap[latestYear] || fallbackShares || parseFloat(general.SharesOutstanding) || 0;
    const priceInTradingCcy = eodPrice?.price || 0;

    if (totalShares > 0 && primaryPrice && primaryPrice > 0) {
      // Best: use primary exchange price (already in reporting currency, e.g. USD)
      adjustedMarketCap = totalShares * primaryPrice;
      console.log(`[${ticker}] Using primary price: ${primaryPrice} ${normalizedCurrency}, shares=${totalShares}, mcap=${adjustedMarketCap}`);
    } else if (totalShares > 0 && priceInTradingCcy > 0 && exchangeRate) {
      // Fallback: TASE price converted to reporting currency
      adjustedMarketCap = (totalShares * priceInTradingCcy) / exchangeRate;
      console.log(`[${ticker}] TASE price fallback: ${priceInTradingCcy} / ${exchangeRate}, shares=${totalShares}, mcap=${adjustedMarketCap}`);
    }
    // Fallback: use EODHD Technicals (50DayMA or 200DayMA) as price proxy
    if (adjustedMarketCap === 0 && totalShares > 0 && exchangeRate) {
      let techPrice = parseFloat(technicals["50DayMA"]) || parseFloat(technicals["200DayMA"]) || 0;
      // EODHD fundamentals endpoint reports TASE technicals in Agorot (1/100 ILS) — always convert
      if (techPrice > 0 && tradingCurrency === "ILS") {
        techPrice = techPrice / 100;
        console.log(`[${ticker}] Agorot→ILS correction: techPrice=${techPrice}`);
      }
      if (techPrice > 0) {
        adjustedMarketCap = (totalShares * techPrice) / exchangeRate;
        console.log(`[${ticker}] Technicals price fallback: price=${techPrice} ILS, shares=${totalShares}, mcap=${adjustedMarketCap} ${normalizedCurrency}`);
      }
    }
    // Last resort: use EODHD's MarketCapitalization (WARNING: often wrong for dual-listed)
    if (adjustedMarketCap === 0 && rawMarketCap > 0 && exchangeRate && exchangeRate > 0) {
      adjustedMarketCap = rawMarketCap / exchangeRate;
      console.log(`[${ticker}] Last resort: EODHD mcap ${rawMarketCap} / ${exchangeRate} = ${adjustedMarketCap} (may be inaccurate for dual-listed)`);
    }
    console.log(`[${ticker}] Cross-currency fix: tradingCcy=${tradingCurrency}, reportingCcy=${normalizedCurrency}, rate=${exchangeRate}, adjustedMcap=${adjustedMarketCap}`);
  } else {
    adjustedMarketCap = rawMarketCap;
  }

  // Calculate valuation ratios using adjusted (same-currency) market cap
  let peRatio: number | null = null;
  let psRatio: number | null = null;
  let pbRatio: number | null = null;

  if (needsCurrencyConversion && adjustedMarketCap > 0) {
    // Manually calculate all ratios with currency-adjusted market cap
    const latestIncKey = allYears[allYears.length - 1];
    const latestInc = latestIncKey ? incomeStatements[latestIncKey] : null;
    const latestBal = latestIncKey ? (balanceSheets[latestIncKey] || {}) : {};
    
    const ttmRevenue = parseFloat(latestInc?.totalRevenue) || 0;
    const ttmNetIncome = parseFloat(latestInc?.netIncome) || 0;
    const bookValue = parseFloat(latestBal.totalStockholderEquity) || 0;

    if (ttmNetIncome !== 0) peRatio = Math.round((adjustedMarketCap / ttmNetIncome) * 100) / 100;
    if (ttmRevenue > 0) psRatio = Math.round((adjustedMarketCap / ttmRevenue) * 100) / 100;
    if (bookValue > 0) pbRatio = Math.round((adjustedMarketCap / bookValue) * 100) / 100;
    
    // Sanity check: if ratios are impossibly low, the market cap is likely wrong — null them out
    if (psRatio !== null && psRatio < 0.1 && ttmRevenue > 100_000_000) {
      console.warn(`[${ticker}] P/S=${psRatio} too low (rev=${ttmRevenue}, mcap=${adjustedMarketCap}) — likely bad MarketCap from EODHD. Nulling ratios.`);
      peRatio = null;
      psRatio = null;
      pbRatio = null;
    }
    
    console.log(`[${ticker}] Recalculated multiples: P/E=${peRatio}, P/S=${psRatio}, P/B=${pbRatio}`);
  } else if (needsCurrencyConversion) {
    // Cross-currency but no adjusted market cap available (price=0, market closed)
    // Do NOT use EODHD's pre-calculated ratios — they divide ILS mcap by USD revenue = wrong
    console.log(`[${ticker}] Cross-currency but no price available — skipping EODHD ratios`);
    peRatio = null;
    psRatio = null;
    pbRatio = null;
  } else {
    // Same currency — use EODHD's pre-calculated values
    peRatio = valuation.TrailingPE ? parseFloat(valuation.TrailingPE) : (highlights.PERatio ? parseFloat(highlights.PERatio) : null);
    psRatio = valuation.PriceSalesTTM ? parseFloat(valuation.PriceSalesTTM) : null;
    pbRatio = valuation.PriceBookMRQ ? parseFloat(valuation.PriceBookMRQ) : null;
  }

  const keyMetrics = {
    peRatio,
    psRatio,
    pbRatio,
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

    // Always fetch fresh price (EODHD + Yahoo fallback)
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

    // Yahoo Finance fallback for TASE price when EODHD returns 0
    if (!eodPrice || eodPrice.price === 0) {
      try {
        const ySymbol = `${ticker}.TA`;
        const yResp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${ySymbol}?interval=1d&range=5d`);
        if (yResp.ok) {
          const yData = await yResp.json();
          const closes = yData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
          const lastClose = closes.filter((c: any) => c != null && c > 0).pop();
          if (lastClose) {
            eodPrice = { price: lastClose, change: 0 };
            console.log(`[${ticker}] Yahoo TASE fallback price: ${lastClose}`);
          }
        }
      } catch (e) { console.error("Yahoo TASE price fallback error:", e); }
    }

    // Return cached if fresh (skip cache when force=true)
    if (!force && cached && isCacheFresh(cached.last_updated)) {
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
          commonStock: 0, retainedEarnings: 0, otherEquity: 0, minorityInterest: row.minorityInterest || 0,
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

    // Detect cross-currency mismatch and fetch exchange rate if needed
    let exchangeRate: number | undefined;
    const general = rawData.General || {};
    const tradingCcy = (general.CurrencyCode === "ILA" ? "ILS" : general.CurrencyCode) || "ILS";
    const incStmts = rawData.Financials?.Income_Statement?.yearly || {};
    const latestKey = Object.keys(incStmts).sort().reverse()[0];

    // Multi-signal reporting currency detection (EODHD currency_symbol is unreliable for TASE)
    let reportCcy = tradingCcy; // default
    const stmtCurrencyRaw = latestKey ? incStmts[latestKey]?.currency_symbol : null;
    const stmtCurrency = stmtCurrencyRaw === "ILA" ? "ILS" : stmtCurrencyRaw;
    const generalReportingCurrency = general.ReportingCurrency || general.reporting_currency || null;

    // Signal 1: EODHD General.ReportingCurrency (most reliable when present)
    if (generalReportingCurrency && generalReportingCurrency !== "ILA") {
      reportCcy = generalReportingCurrency === "ILA" ? "ILS" : generalReportingCurrency;
    }
    // Signal 2: statement currency_symbol (if not ILS/ILA and not null)
    else if (stmtCurrency && stmtCurrency !== "ILS" && stmtCurrency !== "None") {
      reportCcy = stmtCurrency;
    }
    // Signal 3: stock has a US/non-TASE listing → likely reports in that exchange's currency
    else {
      const listings = general.Listings || {};
      let hasUSListing = false;
      for (const [, listing] of Object.entries(listings) as [string, any][]) {
        const exch = (listing?.Exchange || "").toUpperCase();
        if (["NYSE", "NASDAQ", "US"].includes(exch)) { hasUSListing = true; break; }
      }
      // Also check PrimaryExchange / HomeCategory from EODHD
      const primaryExch = (general.Exchange || "").toUpperCase();
      const countryISO = (general.CountryISO || "").toUpperCase();
      if (hasUSListing || (general.PrimaryTicker && !String(general.PrimaryTicker).endsWith(".TA"))) {
        reportCcy = "USD";
      }
      // Signal 4: heuristic — if ILS revenue > $500B, it's probably USD values mislabeled
      if (reportCcy === "ILS" && latestKey) {
        const latestRev = parseFloat(incStmts[latestKey]?.totalRevenue) || 0;
        if (latestRev > 500_000_000_000) {
          reportCcy = "USD";
          console.log(`[${ticker}] Revenue ${latestRev} too large for ILS, overriding to USD`);
        }
      }
    }

    console.log(`[${ticker}] Currency detection: tradingCcy=${tradingCcy}, stmtCurrency=${stmtCurrency}, reportingCurrency=${generalReportingCurrency}, final=${reportCcy}`);

    // Hardcoded fallback FX rates (last resort if live API fails)
    const FALLBACK_FX: Record<string, Record<string, number>> = {
      USD: { ILS: 3.75, EUR: 0.92, GBP: 0.79 },
      EUR: { ILS: 4.05, USD: 1.09, GBP: 0.86 },
      GBP: { ILS: 4.70, USD: 1.27, EUR: 1.16 },
    };

    if (tradingCcy !== reportCcy) {
      // Fetch exchange rate: how many units of tradingCcy per 1 unit of reportCcy
      try {
        const fxResp = await fetch(`https://open.er-api.com/v6/latest/${reportCcy}`, { signal: AbortSignal.timeout(5000) });
        if (fxResp.ok) {
          const fxData = await fxResp.json();
          const rate = fxData?.rates?.[tradingCcy];
          if (rate && rate > 0) {
            exchangeRate = rate;
            console.log(`[${ticker}] FX rate ${reportCcy}→${tradingCcy}: ${exchangeRate}`);
          }
        } else {
          console.error(`[${ticker}] FX fetch failed: ${fxResp.status}`);
        }
      } catch (fxErr) {
        console.error(`[${ticker}] Failed to fetch FX rate:`, fxErr);
      }

      // Fallback to hardcoded rate if live fetch failed
      if (!exchangeRate) {
        const fallback = FALLBACK_FX[reportCcy]?.[tradingCcy];
        if (fallback) {
          exchangeRate = fallback;
          console.log(`[${ticker}] Using FALLBACK FX rate ${reportCcy}→${tradingCcy}: ${exchangeRate}`);
        }
      }
    }

    // For dual-listed stocks: resolve a reliable price for market cap calculation
    let primaryPrice: number | undefined;
    if (tradingCcy !== reportCcy) {
      const tasePrice = eodPrice?.price || 0;

      if (tasePrice > 0 && exchangeRate) {
        // TASE price available — will be used in parseFundamentals via shares * tasePrice / FX
        // No need to set primaryPrice; the function handles this
      } else {
        // No TASE price — try fetching primary exchange (e.g. NYSE) price
        const listings = rawData.General?.Listings || {};
        let primarySymbol = "";
        for (const [, listing] of Object.entries(listings) as [string, any][]) {
          const exch = listing?.Exchange || "";
          if (exch && exch !== "TA" && exch !== "TASE") {
            primarySymbol = `${listing.Code || ticker}.${exch === "NYSE" || exch === "NASDAQ" ? "US" : exch}`;
            break;
          }
        }
        if (!primarySymbol) primarySymbol = `${ticker}.US`;

        try {
          console.log(`[${ticker}] Fetching primary listing price: ${primarySymbol}`);
          const pResp = await fetch(`https://eodhd.com/api/real-time/${primarySymbol}?api_token=${apiKey}&fmt=json`);
          if (pResp.ok) {
            const pData = await pResp.json();
            primaryPrice = Number(pData?.close) || Number(pData?.previousClose) || undefined;
            if (primaryPrice) console.log(`[${ticker}] Primary price: ${primaryPrice} ${reportCcy}`);
          }
        } catch (e) { /* ignore rate limits */ }

        // Yahoo Finance fallback
        if (!primaryPrice) {
          try {
            const yTicker = primarySymbol.replace(".US", "");
            const yResp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yTicker}?interval=1d&range=5d`);
            if (yResp.ok) {
              const yData = await yResp.json();
              const closes = yData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
              primaryPrice = closes.filter((c: any) => c != null).pop() || undefined;
              if (primaryPrice) console.log(`[${ticker}] Yahoo price: ${primaryPrice}`);
            }
          } catch (e) { /* ignore */ }
        }

        // If no price source worked, log it — valuation metrics will be null
        if (!primaryPrice) {
          console.warn(`[${ticker}] No price available for cross-currency valuation — metrics will be null`);
        }
      }
    }

    const result = parseFundamentals(rawData, ticker, eodPrice, exchangeRate, primaryPrice);

    // Upsert cache
    const { error: upsertError } = await supabase
      .from("cached_fundamentals")
      .upsert({ ticker, data: result, last_updated: new Date().toISOString() }, { onConflict: "ticker" });
    if (upsertError) console.error("Cache upsert error:", upsertError);
    else console.log(`Cached fundamentals for ${ticker}`);

    // Update tase_symbols with logo and correct reporting currency
    const symbolUpdate: Record<string, string> = {};
    if (result.meta.logoUrl) symbolUpdate.logo_url = result.meta.logoUrl;
    if (result.meta.currency) symbolUpdate.currency = result.meta.currency;
    if (Object.keys(symbolUpdate).length > 0) {
      await supabase.from("tase_symbols").update(symbolUpdate).eq("ticker", ticker);
    }

    // --- Inline audit: auto-compute health status on every fetch ---
    try {
      const bs = result.balanceSheet ?? [];
      const is = result.incomeStatement ?? [];

      // Balance check: Assets = Liabilities + Equity (Equity already includes MI)
      const balanceFailures: string[] = [];
      for (const y of bs) {
        const assets = Number(y.totalAssets || 0);
        const liab = Number(y.totalLiabilities || 0);
        const equity = Number(y.totalEquity || 0);
        if (assets === 0) continue;
        const diff = Math.abs(assets - (liab + equity));
        if (diff / assets > 0.05) balanceFailures.push(`${y.year}: ${((diff / assets) * 100).toFixed(1)}% gap`);
      }

      // Income check
      const incomeFailures: string[] = [];
      for (const y of is) {
        const rev = Number(y.revenue || 0);
        const cogs = Number(y.costOfRevenue || 0);
        const gp = Number(y.grossProfit || 0);
        if (rev === 0 || gp === 0) continue;
        const diff = Math.abs((rev - cogs) - gp);
        if (diff / Math.abs(rev) > 0.02) incomeFailures.push(`${y.year}: ${((diff / Math.abs(rev)) * 100).toFixed(1)}% gap`);
      }

      // Coverage check
      const currentYear = new Date().getFullYear();
      const expectedYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
      const presentYears = (bs.length > 0 ? bs : is).map((y: any) => parseInt(String(y.year || "").substring(0, 4))).filter(Boolean);
      const covered = expectedYears.filter(y => presentYears.includes(y));
      const coveragePassed = covered.length >= 4;

      // EPS check
      const epsFailures: string[] = [];
      for (const y of is) {
        const ni = Number(y.netIncome || 0);
        const eps = Number(y.eps || 0);
        if (Math.abs(ni) > 1000 && eps === 0) epsFailures.push(`${y.year}: EPS=0`);
      }

      const checks = [
        { name: "balance_sheet", passed: balanceFailures.length === 0, details: balanceFailures.length ? balanceFailures.join("; ") : "OK", severity: "critical" },
        { name: "income_statement", passed: incomeFailures.length === 0, details: incomeFailures.length ? incomeFailures.join("; ") : "OK", severity: "critical" },
        { name: "coverage", passed: coveragePassed, details: `${covered.length}/5 years`, severity: coveragePassed ? "minor" : "critical" },
        { name: "eps", passed: epsFailures.length === 0, details: epsFailures.length ? epsFailures.join("; ") : "OK", severity: "minor" },
      ];

      const health = checks.some(c => !c.passed && c.severity === "critical") ? "red" : checks.some(c => !c.passed) ? "yellow" : "green";

      await supabase.from("stock_audit_results").upsert(
        { ticker, health, checks, last_audited: new Date().toISOString() },
        { onConflict: "ticker" }
      );
      console.log(`Auto-audited ${ticker}: ${health}`);
    } catch (auditErr) {
      console.error("Inline audit error:", auditErr);
    }

    return new Response(JSON.stringify(result), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("Edge function error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
