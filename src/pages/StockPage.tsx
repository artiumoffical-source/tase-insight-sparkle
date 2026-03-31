import { useParams } from "react-router-dom";
import { useState, useEffect, lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import FinancialsTable from "@/components/FinancialsTable";
import type { FinancialData, IncomeStatementRow, BalanceSheetRow, CashFlowRow, SectorType } from "@/components/FinancialsTable";
import KeyMetrics from "@/components/KeyMetrics";
import type { KeyMetricsData } from "@/components/KeyMetrics";
import type { DetailedBalanceSheetRow } from "@/components/DeepDiveFinancials";
import AdSlot from "@/components/AdSlot";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Star, Lock, Flag } from "lucide-react";
import { toast } from "sonner";
import StockLogo from "@/components/StockLogo";
import StockNewsSidebar from "@/components/StockNewsSidebar";
import StockPageSEO from "@/components/StockPageSEO";
import TASE_STOCKS, { TA35_TICKERS } from "@/data/tase-stocks";
import { Skeleton } from "@/components/ui/skeleton";
import { getCached, setCache } from "@/lib/stock-cache";

// Lazy load TradingView chart - renders after main layout
const TradingViewSymbolOverview = lazy(() => import("@/components/TradingViewSymbolOverview"));

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
  logoUrl: string | null;
  sector?: string;
}

interface FinancialsResponse {
  meta: StockMeta;
  financials: FinancialData[];
  incomeStatement: IncomeStatementRow[];
  balanceSheet: BalanceSheetRow[];
  cashFlow: CashFlowRow[];
  detailedBalanceSheet: DetailedBalanceSheetRow[];
  qIncomeStatement: IncomeStatementRow[];
  qBalanceSheet: BalanceSheetRow[];
  qCashFlow: CashFlowRow[];
  keyMetrics: KeyMetricsData | null;
}

function ChartSkeleton() {
  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <Skeleton className="h-[80px] w-full" />
      <Skeleton className="h-[500px] w-full" />
    </div>
  );
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { user } = useAuth();
  const { t, isRtl } = useLanguage();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [financials, setFinancials] = useState<FinancialData[]>([]);
  const [incomeStatement, setIncomeStatement] = useState<IncomeStatementRow[]>([]);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetRow[]>([]);
  const [cashFlow, setCashFlow] = useState<CashFlowRow[]>([]);
  const [keyMetrics, setKeyMetrics] = useState<KeyMetricsData | null>(null);
  const [qIncomeStatement, setQIncomeStatement] = useState<IncomeStatementRow[]>([]);
  const [qBalanceSheet, setQBalanceSheet] = useState<BalanceSheetRow[]>([]);
  const [qCashFlow, setQCashFlow] = useState<CashFlowRow[]>([]);
  const [sector, setSector] = useState<SectorType>("general");
  const [detailedBalanceSheet, setDetailedBalanceSheet] = useState<DetailedBalanceSheetRow[]>([]);
  const [meta, setMeta] = useState<StockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = user?.email === "artiumoffical@gmail.com";
  const upperTicker = ticker?.toUpperCase()?.replace(/\.TA$/i, "") ?? "";
  const stock = TASE_STOCKS.find((s) => s.ticker === upperTicker);

  // Apply cached financials data to state
  // Build detailed balance sheet from basic data as fallback
  const buildFallbackDetailedBS = (bs: BalanceSheetRow[]): DetailedBalanceSheetRow[] => {
    return bs.map(row => ({
      year: row.year,
      totalAssets: row.totalAssets,
      totalCurrentAssets: row.cash + row.inventory,
      cash: row.cash,
      shortTermInvestments: 0,
      netReceivables: 0,
      inventory: row.inventory,
      otherCurrentAssets: 0,
      nonCurrentAssetsTotal: row.totalAssets - (row.cash + row.inventory),
      propertyPlantEquipment: 0,
      longTermInvestments: row.totalInvestments || 0,
      goodwill: 0,
      intangibleAssets: 0,
      otherNonCurrentAssets: 0,
      totalLiabilities: row.totalLiabilities,
      totalCurrentLiabilities: 0,
      accountsPayable: 0,
      shortTermDebt: 0,
      otherCurrentLiabilities: 0,
      nonCurrentLiabilitiesTotal: 0,
      longTermDebt: row.totalDebt,
      otherNonCurrentLiabilities: 0,
      totalEquity: row.totalEquity,
      commonStock: 0,
      retainedEarnings: 0,
      otherEquity: 0,
    }));
  };

  const applyFinancialsData = (data: FinancialsResponse) => {
    setMeta(data.meta);
    setFinancials(data.financials ?? []);
    setIncomeStatement(data.incomeStatement ?? []);
    setBalanceSheet(data.balanceSheet ?? []);
    setCashFlow(data.cashFlow ?? []);
    // Use detailed data if available, otherwise reconstruct from basic balance sheet
    const detailed = data.detailedBalanceSheet?.length ? data.detailedBalanceSheet : buildFallbackDetailedBS(data.balanceSheet ?? []);
    setDetailedBalanceSheet(detailed);
    setQIncomeStatement(data.qIncomeStatement ?? []);
    setQBalanceSheet(data.qBalanceSheet ?? []);
    setQCashFlow(data.qCashFlow ?? []);
    setKeyMetrics(data.keyMetrics ?? null);
    setSector(data.meta?.sector as SectorType ?? "general");
  };

  useEffect(() => {
    if (!upperTicker) return;
    setError(null);

    // 1. Check cache first for instant display
    const cached = getCached<FinancialsResponse>("financials", upperTicker);
    if (cached) {
      applyFinancialsData(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }

    // 2. Fetch fresh data in background
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-financials?ticker=${upperTicker}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" } }
    )
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body.error || `HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data: FinancialsResponse) => {
        applyFinancialsData(data);
        setCache("financials", upperTicker, data);
      })
      .catch((err) => {
        if (!cached) {
          console.error("Failed to fetch financials:", err);
          setError(err.message || "Failed to load data");
        }
      })
      .finally(() => setLoading(false));
  }, [upperTicker]);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("watchlist")
      .select("id")
      .eq("user_id", user.id)
      .eq("ticker", upperTicker)
      .maybeSingle()
      .then(({ data }) => setInWatchlist(!!data));
  }, [user, upperTicker]);

  const toggleWatchlist = async () => {
    if (!user) {
      toast.error(t("stock.signInWatchlist"));
      return;
    }
    if (inWatchlist) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("ticker", upperTicker);
      setInWatchlist(false);
      toast.success(t("stock.removedWatchlist"));
    } else {
      await supabase.from("watchlist").insert({
        user_id: user.id,
        ticker: upperTicker,
        name: stock?.name ?? meta?.name ?? upperTicker,
      });
      setInWatchlist(true);
      toast.success(t("stock.addedWatchlist"));
    }
  };

  const displayName = isRtl
    ? (stock?.nameHe ?? stock?.name ?? meta?.name ?? upperTicker)
    : (stock?.name ?? meta?.name ?? upperTicker);

  return (
    <div className="container max-w-7xl py-8 animate-fade-in">
      <StockPageSEO
        ticker={upperTicker}
        nameHe={isRtl ? displayName : (stock?.nameHe ?? displayName)}
        nameEn={stock?.name ?? meta?.name ?? upperTicker}
        price={meta?.price}
        change={meta?.change}
        currency={meta?.currency ?? "ILS"}
      />
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6" style={{ direction: isRtl ? "rtl" : "ltr" }}>
        {/* Main content */}
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap items-center gap-4">
            <StockLogo name={displayName} logoUrl={meta?.logoUrl} size="lg" />
            <div>
              <h1 className="font-display text-3xl font-bold">
                {loading && !meta ? t("stock.loading") : displayName}
              </h1>
              <p className="text-sm text-muted-foreground mt-1">TASE: {upperTicker}</p>
              {stock && (
                <p className="text-sm text-muted-foreground" dir="rtl">{stock.nameHe}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleWatchlist}
              className={`ms-auto ${inWatchlist ? "text-primary" : "text-muted-foreground"}`}
            >
              <Star className={`h-5 w-5 ${inWatchlist ? "fill-current" : ""}`} />
            </Button>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {t("stock.failedLoad")}: {error}
            </div>
          )}

          {/* Lazy-loaded TradingView chart with skeleton fallback */}
          <Suspense fallback={<ChartSkeleton />}>
            <TradingViewSymbolOverview ticker={upperTicker} />
          </Suspense>

          <AdSlot placement="banner" />
          <AdSlot placement="leaderboard" />

          <KeyMetrics
            data={keyMetrics}
            isPremium={isPremium}
            onUpgrade={() => setShowUpgrade(true)}
            loading={loading}
            sector={sector}
          />

          <div>
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-display text-xl font-semibold">{t("stock.historicalData")}</h2>
              <div className="flex items-center rounded-lg border bg-secondary/30 overflow-hidden text-sm">
                <button
                  onClick={() => setPeriod("annual")}
                  className={`px-3 py-1.5 font-medium transition-colors ${period === "annual" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("fin.annual")}
                </button>
                <button
                  onClick={() => {
                    if (!isPremium) {
                      setShowUpgrade(true);
                    } else {
                      setPeriod("quarterly");
                    }
                  }}
                  className={`px-3 py-1.5 font-medium transition-colors flex items-center gap-1.5 ${period === "quarterly" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {t("fin.quarterly")}
                  {!isPremium && <Lock className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>
            <FinancialsTable
              data={financials}
              incomeStatement={period === "quarterly" ? qIncomeStatement : incomeStatement}
              balanceSheet={period === "quarterly" ? qBalanceSheet : balanceSheet}
              cashFlow={period === "quarterly" ? qCashFlow : cashFlow}
              detailedBalanceSheet={period === "annual" ? detailedBalanceSheet : undefined}
              loading={loading}
              sector={sector}
            />
          </div>

          <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>

        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-24 space-y-4">
            <StockNewsSidebar ticker={upperTicker} isPremium={isPremium} onUpgrade={() => setShowUpgrade(true)} />
            {!isPremium && <AdSlot placement="sidebar" />}
          </div>
        </aside>

        {/* Mobile: News below financials */}
        <div className="lg:hidden">
          <StockNewsSidebar ticker={upperTicker} isPremium={isPremium} onUpgrade={() => setShowUpgrade(true)} />
        </div>
      </div>
    </div>
  );
}
