import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TradingViewChart from "@/components/TradingViewChart";
import FinancialsTable from "@/components/FinancialsTable";
import type { FinancialData } from "@/components/FinancialsTable";
import AdSlot from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import TASE_STOCKS from "@/data/tase-stocks";

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
}

// Mock 5-year financials until EODHD fundamentals plan is available
function generateMockFinancials(ticker: string): FinancialData[] {
  const seed = ticker.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const baseRevenue = ((seed % 50) + 5) * 1e8;

  return ["2024", "2023", "2022", "2021", "2020"].map((year, i) => {
    const factor = 1 - i * 0.06 + (((seed * (i + 1)) % 20) - 10) / 100;
    const revenue = baseRevenue * factor;
    const grossProfit = revenue * (0.3 + ((seed % 20) / 100));
    const operatingIncome = grossProfit * (0.4 + ((seed % 15) / 100));
    const netIncome = operatingIncome * (0.7 + ((seed % 10) / 100));
    const debtToEquity = 0.3 + ((seed + i) % 20) / 10;
    const cashAndEquiv = revenue * (0.1 + ((seed % 12) / 100));

    return { year, revenue, grossProfit, operatingIncome, netIncome, debtToEquity, cashAndEquiv };
  });
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { user } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [meta, setMeta] = useState<StockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const upperTicker = ticker?.toUpperCase()?.replace(/\.TA$/i, "") ?? "";

  const stock = TASE_STOCKS.find((s) => s.ticker === upperTicker);
  const financials = generateMockFinancials(upperTicker);

  // Fetch live price from edge function
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
      .then((data) => setMeta(data.meta))
      .catch((err) => {
        console.error("Failed to fetch stock data:", err);
        setError(err.message || "Failed to load data");
      })
      .finally(() => setLoading(false));
  }, [upperTicker]);

  // Check watchlist status
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
      toast.error("Sign in to use watchlists");
      return;
    }
    if (inWatchlist) {
      await supabase.from("watchlist").delete().eq("user_id", user.id).eq("ticker", upperTicker);
      setInWatchlist(false);
      toast.success("Removed from watchlist");
    } else {
      await supabase.from("watchlist").insert({
        user_id: user.id,
        ticker: upperTicker,
        name: stock?.name ?? meta?.name ?? upperTicker,
      });
      setInWatchlist(true);
      toast.success("Added to watchlist");
    }
  };

  const isPositive = (meta?.change ?? 0) >= 0;
  const displayName = stock?.name ?? meta?.name ?? upperTicker;

  return (
    <div className="container max-w-5xl py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold">
              {loading ? "Loading…" : displayName}
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

        <div className="text-right">
          {meta ? (
            <>
              <p className="font-display text-3xl font-bold">
                ₪{meta.price?.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? "—"}
              </p>
              <div className={`flex items-center justify-end gap-1 text-sm font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isPositive ? "+" : ""}{meta.change?.toFixed(2) ?? 0}%
              </div>
            </>
          ) : !loading ? (
            <p className="text-muted-foreground">—</p>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load price data: {error}
        </div>
      )}

      {/* Chart */}
      <TradingViewChart ticker={upperTicker} />

      {/* Financials (mock data) */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <h2 className="font-display text-xl font-semibold">Historical Financials (5Y)</h2>
          <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full">Mock Data</span>
        </div>
        <FinancialsTable data={financials} loading={false} />
      </div>

      {/* Ad */}
      <AdSlot placement="banner" />
    </div>
  );
}
