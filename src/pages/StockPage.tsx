import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import TradingViewChart from "@/components/TradingViewChart";
import FinancialsTable from "@/components/FinancialsTable";
import type { FinancialData, IncomeStatementRow, BalanceSheetRow, CashFlowRow, SectorType } from "@/components/FinancialsTable";
import KeyMetrics from "@/components/KeyMetrics";
import type { KeyMetricsData } from "@/components/KeyMetrics";
import AdSlot from "@/components/AdSlot";
import UpgradeModal from "@/components/UpgradeModal";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown, Lock } from "lucide-react";
import { toast } from "sonner";
import StockLogo from "@/components/StockLogo";
import StockNewsSidebar from "@/components/StockNewsSidebar";
import TASE_STOCKS from "@/data/tase-stocks";

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
  logoUrl: string | null;
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
  const [meta, setMeta] = useState<StockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<"annual" | "quarterly">("annual");
  const [showUpgrade, setShowUpgrade] = useState(false);

  const isPremium = user?.email === "artiumoffical@gmail.com";
  const upperTicker = ticker?.toUpperCase()?.replace(/\.TA$/i, "") ?? "";

  const stock = TASE_STOCKS.find((s) => s.ticker === upperTicker);

  useEffect(() => {
    if (!upperTicker) return;
    setLoading(true);
    setError(null);

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
      .then((data) => {
        setMeta(data.meta);
        setFinancials(data.financials ?? []);
        setIncomeStatement(data.incomeStatement ?? []);
        setBalanceSheet(data.balanceSheet ?? []);
        setCashFlow(data.cashFlow ?? []);
        setQIncomeStatement(data.qIncomeStatement ?? []);
        setQBalanceSheet(data.qBalanceSheet ?? []);
        setQCashFlow(data.qCashFlow ?? []);
        setKeyMetrics(data.keyMetrics ?? null);
        setSector(data.meta?.sector ?? "general");
      })
      .catch((err) => {
        console.error("Failed to fetch financials:", err);
        setError(err.message || "Failed to load data");
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

  const isPositive = (meta?.change ?? 0) >= 0;
  const displayName = isRtl
    ? (stock?.nameHe ?? stock?.name ?? meta?.name ?? upperTicker)
    : (stock?.name ?? meta?.name ?? upperTicker);

  return (
    <div className="container max-w-7xl py-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-6" style={{ direction: isRtl ? "rtl" : "ltr" }}>
        {/* Main content */}
        <div className="space-y-6 min-w-0">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <StockLogo name={displayName} logoUrl={meta?.logoUrl} size="lg" />
                <h1 className="font-display text-3xl font-bold">
                  {loading ? t("stock.loading") : displayName}
                </h1>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleWatchlist}
                  className={inWatchlist ? "text-primary" : "text-muted-foreground"}
                >
                  <Star className={`h-5 w-5 ${inWatchlist ? "fill-current" : ""}`} />
                </Button>
              </div>
              <p className="text-sm text-muted-foreground mt-1">TASE: {upperTicker}</p>
              {stock && (
                <p className="text-sm text-muted-foreground" dir="rtl">{stock.nameHe}</p>
              )}
            </div>

            <div className={isRtl ? "text-start" : "text-end"}>
              {meta ? (
                <>
                  <p className="font-display text-3xl font-bold">
                    ₪{meta.price?.toFixed(2) ?? "—"}
                  </p>
                  <div className={`flex items-center gap-1 text-sm font-medium ${isPositive ? "text-gain" : "text-loss"} ${isRtl ? "justify-start" : "justify-end"}`}>
                    {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    {isPositive ? "+" : ""}{meta.change?.toFixed(2) ?? 0}%
                  </div>
                  {meta.marketCap && (
                    <p className="text-xs text-muted-foreground mt-1">{t("stock.marketCap")}: {meta.marketCap}</p>
                  )}
                </>
              ) : !loading ? (
                <p className="text-muted-foreground">—</p>
              ) : null}
            </div>
          </div>

          {error && (
            <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
              {t("stock.failedLoad")}: {error}
            </div>
          )}

          <TradingViewChart ticker={upperTicker} />

          {/* Mid-content ad between chart and table */}
          <AdSlot placement="banner" />

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
              loading={loading}
              sector={sector}
            />
          </div>

          <UpgradeModal open={showUpgrade} onOpenChange={setShowUpgrade} />
        </div>

        {/* Desktop sidebar ad */}
        <aside className="hidden lg:block">
          <div className="sticky top-24">
            <AdSlot placement="sidebar" />
          </div>
        </aside>
      </div>
    </div>
  );
}
