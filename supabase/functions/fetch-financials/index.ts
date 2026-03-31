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
    // ALWAYS calculate FCF manually — API's freeCashFlow field is unreliable
    const calculatedFCF = opsFlow - capex;
    return {
      year: dateKey.length >= 7 ? dateKey.substring(0, 7) : dateKey.substring(0, 4),
      netIncome: parseFloat(inc.netIncome) || 0,
      depreciation: parseFloat(cf.depreciation) || 0,
      capex,
      freeCashFlow: calculatedFCF,
      cashFromOperations: opsFlow,
    };
  });
}

function parseFundamentals(data: any, ticker: string, eodPrice?: { price: number; change: number }, exchangeRate?: number, primaryPrice?: number, overrideCurrency?: string) {
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
  let normalizedCurrency = overrideCurrency || (
    generalReportingCcy ? (generalReportingCcy === "ILA" ? "ILS" : generalReportingCcy)
    : (stmtCcy && stmtCcy !== "ILS" && stmtCcy !== "None") ? stmtCcy
    : (general.CurrencyCode === "ILA" ? "ILS" : general.CurrencyCode || "ILS")
  );
  // Check for US listing as override signal (only if no override was passed)
  if (!overrideCurrency) {
    const listings = general.Listings || {};
    for (const [, listing] of Object.entries(listings) as [string, any][]) {
      const exch = (listing?.Exchange || "").toUpperCase();
      if (["NYSE", "NASDAQ", "US"].includes(exch) && normalizedCurrency === "ILS") {
        normalizedCurrency = "USD";
        break;
      }
    }
  }
  console.log(`[${ticker}] parseFundamentals currency: ${normalizedCurrency}`);

  // ── Canonical Market Cap: calculate from shares × price (most reliable) ──
  // EODHD's General.MarketCapitalization is unreliable for TASE (e.g. LUMI shows 1B instead of 70B)
  const tradingCcy = (general.CurrencyCode || "").toUpperCase();
  let marketCapCurrency = tradingCcy === "ILA" ? "ILS" : (tradingCcy || "ILS");

  // Get total shares outstanding
  const latestShareYear = Object.keys(sharesMap).sort().reverse()[0];
  const totalSharesForMcap = sharesMap[latestShareYear] || fallbackShares || parseFloat(general.SharesOutstanding) || 0;

  // Calculate market cap: shares × price
  let canonicalMarketCap = 0;
  let priceForMcap = 0;

  // For dual-listed stocks: prefer primaryPrice (in reporting currency, e.g. USD)
  // This avoids unreliable ILS→USD conversion via stale technicals or exchange rates
  if (primaryPrice && primaryPrice > 0 && normalizedCurrency !== marketCapCurrency) {
    priceForMcap = primaryPrice;
    marketCapCurrency = normalizedCurrency; // mcap will be in reporting currency directly
    console.log(`[${ticker}] Using primaryPrice for mcap: ${primaryPrice} ${normalizedCurrency}`);
  } else {
    priceForMcap = eodPrice?.price || 0;
  }

  // If no live price, try Technicals as price proxy
  if (priceForMcap === 0) {
    let techPrice = parseFloat(technicals["50DayMA"]) || parseFloat(technicals["200DayMA"]) || 0;
    // Technicals from EODHD for TASE are in agorot
    if (techPrice > 500) techPrice = techPrice / 100;
    priceForMcap = techPrice;
    if (techPrice > 0) console.log(`[${ticker}] Using Technicals price for mcap: ${techPrice}`);
  }

  const eodhMcap = parseFloat(general.MarketCapitalization) || parseFloat(highlights.MarketCapitalization) || 0;

  if (totalSharesForMcap > 0 && priceForMcap > 0) {
    canonicalMarketCap = totalSharesForMcap * priceForMcap;
    console.log(`[${ticker}] Calculated MarketCap: ${totalSharesForMcap} shares × ${priceForMcap} ${marketCapCurrency} = ${canonicalMarketCap}`);

    // Sanity check: if our calculated mcap is >3x or <0.3x the EODHD value, prefer EODHD
    // This catches cases where Technicals MAs are stale/wrong (e.g. TSEM 405 ILS vs real 160 ILS)
    if (eodhMcap > 0 && (canonicalMarketCap > eodhMcap * 3 || canonicalMarketCap < eodhMcap * 0.3)) {
      console.warn(`[${ticker}] MarketCap sanity failed: calculated=${canonicalMarketCap} vs EODHD=${eodhMcap} (ratio=${(canonicalMarketCap/eodhMcap).toFixed(2)}). Using EODHD value.`);
      canonicalMarketCap = eodhMcap;
      // EODHD MarketCap is typically in trading currency
    }
  } else {
    canonicalMarketCap = eodhMcap;
    console.log(`[${ticker}] Fallback to EODHD MarketCap: ${canonicalMarketCap} (no shares/price available)`);
  }

  const meta = {
    name: general.Name || ticker,
    price: eodPrice?.price ?? 0,
    change: eodPrice?.change ?? 0,
    marketCap: formatMarketCap(canonicalMarketCap),
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

  // Key metrics — ALL ratios calculated from canonical market cap
  const rev5 = years5.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni5 = years5.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);
  const rev10 = years10.map(y => parseFloat(incomeStatements[y]?.totalRevenue) || 0);
  const ni10 = years10.map(y => parseFloat(incomeStatements[y]?.netIncome) || 0);

  // For dual-listed stocks (reporting in USD/EUR but trading in ILS),
  // convert canonical market cap to reporting currency
  const needsCurrencyConversion = exchangeRate && exchangeRate !== 1 && marketCapCurrency !== normalizedCurrency;
  let mcapForRatios = canonicalMarketCap;

  if (needsCurrencyConversion && exchangeRate && exchangeRate > 0) {
    mcapForRatios = canonicalMarketCap / exchangeRate;
    console.log(`[${ticker}] Cross-currency mcap: ${canonicalMarketCap} ${marketCapCurrency} / ${exchangeRate} = ${mcapForRatios} ${normalizedCurrency}`);
  }

  // Always calculate ratios ourselves from canonical market cap
  let peRatio: number | null = null;
  let psRatio: number | null = null;
  let pbRatio: number | null = null;

  if (mcapForRatios > 0) {
    const latestIncKey = allYears[allYears.length - 1];
    const latestInc = latestIncKey ? incomeStatements[latestIncKey] : null;
    const latestBal = latestIncKey ? (balanceSheets[latestIncKey] || {}) : {};

    const ttmRevenue = parseFloat(latestInc?.totalRevenue) || 0;
    const ttmNetIncome = parseFloat(latestInc?.netIncome) || 0;
    const bookValue = parseFloat(latestBal.totalStockholderEquity) || 0;

    if (ttmNetIncome !== 0) peRatio = Math.round((mcapForRatios / ttmNetIncome) * 100) / 100;
    if (ttmRevenue > 0) psRatio = Math.round((mcapForRatios / ttmRevenue) * 100) / 100;
    if (bookValue > 0) pbRatio = Math.round((mcapForRatios / bookValue) * 100) / 100;

    console.log(`[${ticker}] Calculated multiples: mcap=${mcapForRatios}, P/E=${peRatio}, P/S=${psRatio}, P/B=${pbRatio}`);
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
        let price = Number(rtData?.close) || Number(rtData?.previousClose) || Number(rtData?.open) || 0;
        const change = Number(rtData?.change_p) || 0;
        // EODHD returns TASE prices in agorot — convert to ILS
        if (price > 0 && price > 500) {
          price = price / 100;
          console.log(`[${ticker}] EODHD real-time agorot→ILS: ${price}`);
        }
        if (price > 0) eodPrice = { price, change };
      }
    } catch (e) {
      console.error("Real-time price fetch error:", e);
    }

    // EODHD EOD endpoint fallback
    if (!eodPrice || eodPrice.price === 0) {
      try {
        const symbol = ticker.includes(".") ? ticker : `${ticker}.TA`;
        const eodResp = await fetch(`https://eodhd.com/api/eod/${symbol}?api_token=${apiKey}&fmt=json&order=d&limit=1`);
        if (eodResp.ok) {
          const eodData = await eodResp.json();
          const entry = Array.isArray(eodData) ? eodData[0] : eodData;
          let price = Number(entry?.close) || Number(entry?.adjusted_close) || 0;
          if (price > 0 && price > 500) price = price / 100; // agorot→ILS
          if (price > 0) {
            eodPrice = { price, change: 0 };
            console.log(`[${ticker}] EODHD EOD fallback price: ${price}`);
          }
        }
      } catch (e) { /* ignore */ }
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

    console.log(`[${ticker}] Final price for mcap: ${eodPrice?.price || 'NONE'}`);


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

    // Scan ALL financial statement types (yearly + quarterly) for any currency_symbol
    // This catches stocks where only some statements have the field populated
    function scanForCurrency(data: any): string | null {
      const paths = [
        "Financials.Income_Statement.yearly",
        "Financials.Income_Statement.quarterly",
        "Financials.Balance_Sheet.yearly",
        "Financials.Balance_Sheet.quarterly",
        "Financials.Cash_Flow.yearly",
        "Financials.Cash_Flow.quarterly",
      ];
      for (const path of paths) {
        const parts = path.split(".");
        let obj = data;
        for (const p of parts) { obj = obj?.[p]; if (!obj) break; }
        if (!obj || typeof obj !== "object") continue;
        const keys = Object.keys(obj).sort().reverse();
        for (const k of keys) {
          const sym = obj[k]?.currency_symbol;
          if (sym && sym !== "None" && sym !== "null") {
            const normalized = sym === "ILA" ? "ILS" : sym;
            if (normalized !== "ILS") return normalized; // non-ILS found
          }
        }
      }
      return null;
    }

    const deepScanCurrency = scanForCurrency(rawData);

    // Signal 1: EODHD General.ReportingCurrency (most reliable when present)
    if (generalReportingCurrency && generalReportingCurrency !== "ILA") {
      reportCcy = generalReportingCurrency === "ILA" ? "ILS" : generalReportingCurrency;
    }
    // Signal 2: yearly statement currency_symbol (if not ILS/ILA and not null)
    else if (stmtCurrency && stmtCurrency !== "ILS" && stmtCurrency !== "None") {
      reportCcy = stmtCurrency;
    }
    // Signal 2b: deep scan across all statement types
    else if (deepScanCurrency) {
      reportCcy = deepScanCurrency;
      console.log(`[${ticker}] Currency from deep scan: ${reportCcy}`);
    }
    // Signal 3: stock has a US/non-TASE listing → likely reports in that exchange's currency
    else {
      const listings = general.Listings || {};
      let hasUSListing = false;
      for (const [, listing] of Object.entries(listings) as [string, any][]) {
        const exch = (listing?.Exchange || "").toUpperCase();
        if (["NYSE", "NASDAQ", "US"].includes(exch)) { hasUSListing = true; break; }
      }
      if (hasUSListing || (general.PrimaryTicker && !String(general.PrimaryTicker).endsWith(".TA"))) {
        reportCcy = "USD";
      }
      // Signal 4: Check ISIN — if starts with "US", the company reports in USD
      const isin = general.ISIN || "";
      if (isin.startsWith("US") && reportCcy === "ILS") {
        reportCcy = "USD";
        console.log(`[${ticker}] ISIN ${isin} indicates USD reporting`);
      }
      // Signal 5: heuristic — if ILS revenue > $500B, it's probably USD values mislabeled
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

    // For dual-listed stocks: ALWAYS try to get the primary exchange price (e.g. USD)
    // This is more reliable than ILS→USD conversion via exchange rates
    let primaryPrice: number | undefined;
    if (tradingCcy !== reportCcy) {
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

      // EODHD EOD fallback for primary listing
      if (!primaryPrice) {
        try {
          const eodPrimaryResp = await fetch(`https://eodhd.com/api/eod/${primarySymbol}?api_token=${apiKey}&fmt=json&order=d&limit=1`);
          if (eodPrimaryResp.ok) {
            const eodPrimaryData = await eodPrimaryResp.json();
            const entry = Array.isArray(eodPrimaryData) ? eodPrimaryData[0] : eodPrimaryData;
            primaryPrice = Number(entry?.close) || Number(entry?.adjusted_close) || undefined;
            if (primaryPrice) console.log(`[${ticker}] Primary EOD price: ${primaryPrice} ${reportCcy}`);
          }
        } catch (e) { /* ignore */ }
      }

      // Yahoo Finance fallback - try multiple ticker formats
      if (!primaryPrice) {
        const yTickers = [primarySymbol.replace(".US", ""), ticker];
        for (const yTicker of yTickers) {
          try {
            const yResp = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${yTicker}?interval=1d&range=5d`, {
              headers: { "User-Agent": "Mozilla/5.0" },
            });
            if (yResp.ok) {
              const yData = await yResp.json();
              const closes = yData?.chart?.result?.[0]?.indicators?.quote?.[0]?.close || [];
              primaryPrice = closes.filter((c: any) => c != null && c > 0).pop() || undefined;
              if (primaryPrice) {
                console.log(`[${ticker}] Yahoo primary price (${yTicker}): ${primaryPrice}`);
                break;
              }
            }
          } catch (e) { /* ignore */ }
        }
      }

      // Final fallback for dual-listed: derive USD market cap from Highlights
      // EODHD Highlights.MarketCapitalization for US-listed stocks is often in USD
      if (!primaryPrice) {
        const hlMcap = parseFloat(rawData.Highlights?.MarketCapitalization) || 0;
        const hlMcapMln = parseFloat(rawData.Highlights?.MarketCapitalizationMln) || 0;
        const genMcap = parseFloat(rawData.General?.MarketCapitalization) || 0;
        // Compute shares for this scope
        const sharesOutstanding = parseFloat(rawData.General?.SharesOutstanding) || 0;
        const outstandingSharesAnnual = rawData.outstandingShares?.annual || {};
        let latestShares = sharesOutstanding;
        for (const entry of Object.values(outstandingSharesAnnual) as any[]) {
          const s = parseFloat(entry?.shares) || 0;
          if (s > 0) latestShares = s; // last entry is most recent
        }

        if (hlMcapMln > 0 && latestShares > 0) {
          primaryPrice = (hlMcapMln * 1_000_000) / latestShares;
          console.log(`[${ticker}] Derived primaryPrice from Highlights.MarketCapitalizationMln: ${hlMcapMln}M / ${latestShares} shares = ${primaryPrice} (assumed ${reportCcy})`);
        } else if (hlMcap > 0 && genMcap > 0 && latestShares > 0) {
          const ratio = genMcap / hlMcap;
          if (ratio > 2 && ratio < 6) {
            primaryPrice = hlMcap / latestShares;
            console.log(`[${ticker}] Derived primaryPrice from Highlights mcap (USD): ${hlMcap} / ${latestShares} = ${primaryPrice}`);
          }
        }
      }

      if (!primaryPrice) {
        console.warn(`[${ticker}] No primary price available — will use TASE price with FX conversion`);
      }
    }

    const result = parseFundamentals(rawData, ticker, eodPrice, exchangeRate, primaryPrice, reportCcy);

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
