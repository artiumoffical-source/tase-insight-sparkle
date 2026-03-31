import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  severity: "critical" | "minor";
}

function runBalanceCheck(years: any[]): CheckResult {
  const failures: string[] = [];
  for (const y of years) {
    const assets = Number(y.totalAssets || 0);
    const liab = Number(y.totalLiabilities || 0);
    const equity = Number(y.totalEquity || 0);
    if (assets === 0) continue;
    const diff = Math.abs(assets - (liab + equity));
    const pct = diff / assets;
    if (pct > 0.02) {
      failures.push(`${y.year}: ${(pct * 100).toFixed(1)}% gap`);
    }
  }
  return {
    name: "balance_sheet",
    passed: failures.length === 0,
    details: failures.length ? failures.join("; ") : "All years balanced",
    severity: "critical",
  };
}

function runIncomeCheck(years: any[]): CheckResult {
  const failures: string[] = [];
  for (const y of years) {
    const revenue = Number(y.revenue || y.totalRevenue || 0);
    const costOfRevenue = Number(y.costOfRevenue || y.costOfGoodsSold || 0);
    const grossProfit = Number(y.grossProfit || 0);
    if (revenue === 0 || grossProfit === 0) continue;
    const expected = revenue - costOfRevenue;
    const diff = Math.abs(expected - grossProfit);
    const pct = diff / Math.abs(revenue);
    if (pct > 0.02) {
      failures.push(`${y.year}: ${(pct * 100).toFixed(1)}% gap`);
    }
  }
  return {
    name: "income_statement",
    passed: failures.length === 0,
    details: failures.length ? failures.join("; ") : "Income checks passed",
    severity: "critical",
  };
}

function runCoverageCheck(years: any[]): CheckResult {
  const currentYear = new Date().getFullYear();
  const expectedYears = Array.from({ length: 5 }, (_, i) => currentYear - i);
  const presentYears = years.map((y: any) => {
    const yr = String(y.year || y.date || "");
    return parseInt(yr.substring(0, 4));
  }).filter(Boolean);
  const covered = expectedYears.filter((y) => presentYears.includes(y));
  const passed = covered.length >= 4;
  return {
    name: "coverage",
    passed,
    details: `${covered.length}/5 years present (${covered.join(", ")})`,
    severity: passed ? "minor" : "critical",
  };
}

function runCurrencyCheck(meta: any, incomeYears: any[]): CheckResult {
  const currency = (meta?.currency || "ILS").toUpperCase();
  if (currency !== "ILS") {
    return { name: "currency", passed: true, details: `Currency: ${currency} (non-ILS, skipped)`, severity: "minor" };
  }
  // ILS stocks with revenue > 500B ILS are suspicious (could be USD values)
  const suspiciousYears: string[] = [];
  for (const y of incomeYears) {
    const rev = Number(y.revenue || y.totalRevenue || 0);
    if (rev > 500_000_000_000) {
      suspiciousYears.push(`${y.year}: ${(rev / 1e9).toFixed(1)}B`);
    }
  }
  return {
    name: "currency",
    passed: suspiciousYears.length === 0,
    details: suspiciousYears.length
      ? `Suspect USD values in ILS stock: ${suspiciousYears.join("; ")}`
      : "Currency values look reasonable",
    severity: "minor",
  };
}

function runEpsCheck(incomeYears: any[]): CheckResult {
  const failures: string[] = [];
  for (const y of incomeYears) {
    const netIncome = Number(y.netIncome || 0);
    const eps = Number(y.eps || 0);
    if (Math.abs(netIncome) > 1000 && eps === 0) {
      failures.push(`${y.year}: EPS=0 but NI=${(netIncome / 1e6).toFixed(1)}M`);
    }
  }
  return {
    name: "eps",
    passed: failures.length === 0,
    details: failures.length ? failures.join("; ") : "EPS values present",
    severity: "minor",
  };
}

function computeHealth(checks: CheckResult[]): string {
  if (checks.some((c) => !c.passed && c.severity === "critical")) return "red";
  if (checks.some((c) => !c.passed)) return "yellow";
  return "green";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const tickerParam = url.searchParams.get("ticker");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch cached fundamentals
    let query = supabase.from("cached_fundamentals").select("ticker, data");
    if (tickerParam) {
      query = query.eq("ticker", tickerParam.toUpperCase());
    }
    const { data: rows, error } = await query;
    if (error) throw error;

    const results: any[] = [];

    for (const row of rows || []) {
      const d = row.data as any;
      const balanceSheet = d?.balanceSheet || d?.balance_sheet || [];
      const incomeStatement = d?.incomeStatement || d?.income_statement || [];
      const meta = d?.meta || {};

      const checks = [
        runBalanceCheck(balanceSheet),
        runIncomeCheck(incomeStatement),
        runCoverageCheck(balanceSheet.length > 0 ? balanceSheet : incomeStatement),
        runCurrencyCheck(meta, incomeStatement),
        runEpsCheck(incomeStatement),
      ];

      const health = computeHealth(checks);

      // Upsert
      const { error: upsertErr } = await supabase
        .from("stock_audit_results")
        .upsert(
          {
            ticker: row.ticker,
            health,
            checks: checks,
            last_audited: new Date().toISOString(),
          },
          { onConflict: "ticker" }
        );

      if (upsertErr) console.error(`Upsert error for ${row.ticker}:`, upsertErr);

      results.push({ ticker: row.ticker, health });
    }

    return new Response(
      JSON.stringify({ audited: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Audit error:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
