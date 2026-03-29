import { useParams } from "react-router-dom";
import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import TradingViewChart from "@/components/TradingViewChart";
import FinancialsTable, { type FinancialData } from "@/components/FinancialsTable";
import AdSlot from "@/components/AdSlot";
import { Button } from "@/components/ui/button";
import { Star, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";

// Mock stock metadata — in production this comes from EODHD
const STOCK_META: Record<string, { name: string; price: number; change: number; marketCap: string }> = {
  TEVA: { name: "Teva Pharmaceutical", price: 62.4, change: 1.85, marketCap: "71.2B" },
  LUMI: { name: "Bank Leumi", price: 34.12, change: -0.42, marketCap: "52.8B" },
  DSCT: { name: "Bank Discount", price: 28.9, change: 0.73, marketCap: "28.4B" },
  HARL: { name: "Harel Insurance", price: 42.55, change: -1.1, marketCap: "14.2B" },
  POLI: { name: "Bank Hapoalim", price: 39.8, change: 0.95, marketCap: "56.1B" },
  ICL: { name: "ICL Group", price: 21.3, change: 2.1, marketCap: "27.6B" },
  NICE: { name: "NICE Systems", price: 245.0, change: -0.35, marketCap: "16.3B" },
  BEZQ: { name: "Bezeq", price: 5.12, change: 0.2, marketCap: "14.1B" },
  ELCO: { name: "Elco Holdings", price: 108.5, change: -0.8, marketCap: "3.2B" },
  AZRG: { name: "Azrieli Group", price: 312.0, change: 1.45, marketCap: "38.5B" },
};

// Mock financials — in production fetched from EODHD
function getMockFinancials(ticker: string): FinancialData[] {
  const base = ticker.length * 100_000_000;
  return [2024, 2023, 2022, 2021, 2020].map((year) => ({
    year: String(year),
    revenue: base * (1 + (year - 2020) * 0.08),
    grossProfit: base * 0.4 * (1 + (year - 2020) * 0.06),
    operatingIncome: base * 0.2 * (1 + (year - 2020) * 0.05),
    netIncome: base * 0.15 * (1 + (year - 2020) * 0.04),
    debtToEquity: 0.8 + (2024 - year) * 0.05,
    cashAndEquiv: base * 0.25 * (1 + (year - 2020) * 0.03),
  }));
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { user } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [financials, setFinancials] = useState<FinancialData[]>([]);
  const [loading, setLoading] = useState(true);
  const upperTicker = ticker?.toUpperCase() ?? "";
  const meta = STOCK_META[upperTicker];

  useEffect(() => {
    // Simulate loading financials
    setLoading(true);
    const timeout = setTimeout(() => {
      setFinancials(getMockFinancials(upperTicker));
      setLoading(false);
    }, 600);
    return () => clearTimeout(timeout);
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
        name: meta?.name ?? upperTicker,
      });
      setInWatchlist(true);
      toast.success("Added to watchlist");
    }
  };

  const isPositive = (meta?.change ?? 0) >= 0;

  return (
    <div className="container max-w-5xl py-8 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="font-display text-3xl font-bold">{meta?.name ?? upperTicker}</h1>
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
        </div>

        <div className="text-right">
          <p className="font-display text-3xl font-bold">₪{meta?.price?.toFixed(2) ?? "—"}</p>
          <div className={`flex items-center justify-end gap-1 text-sm font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
            {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
            {isPositive ? "+" : ""}{meta?.change?.toFixed(2) ?? 0}%
          </div>
          {meta?.marketCap && (
            <p className="text-xs text-muted-foreground mt-1">Market Cap: ₪{meta.marketCap}</p>
          )}
        </div>
      </div>

      {/* Chart */}
      <TradingViewChart ticker={upperTicker} />

      {/* Financials */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-3">Historical Financials (5Y)</h2>
        <FinancialsTable data={financials} loading={loading} />
      </div>

      {/* Ad sidebar placeholder */}
      <AdSlot placement="banner" />
    </div>
  );
}
