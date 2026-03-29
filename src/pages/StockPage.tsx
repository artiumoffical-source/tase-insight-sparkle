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

interface StockMeta {
  name: string;
  price: number;
  change: number;
  marketCap: string;
  currency: string;
}

export default function StockPage() {
  const { ticker } = useParams<{ ticker: string }>();
  const { user } = useAuth();
  const [inWatchlist, setInWatchlist] = useState(false);
  const [financials, setFinancials] = useState<FinancialData[]>([]);
  const [meta, setMeta] = useState<StockMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const upperTicker = ticker?.toUpperCase() ?? "";

  // Fetch real financial data from EODHD via edge function
  useEffect(() => {
    if (!upperTicker) return;
    setLoading(true);
    setError(null);

    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-financials?ticker=${upperTicker}`,
      {
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
      }
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
        setFinancials(data.financials);
      })
      .catch((err) => {
        console.error("Failed to fetch financials:", err);
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
            <h1 className="font-display text-3xl font-bold">
              {loading ? "Loading…" : meta?.name ?? upperTicker}
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
        </div>

        <div className="text-right">
          {meta ? (
            <>
              <p className="font-display text-3xl font-bold">
                {meta.currency === "ILS" ? "₪" : "$"}{meta.price?.toFixed(2) ?? "—"}
              </p>
              <div className={`flex items-center justify-end gap-1 text-sm font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                {isPositive ? "+" : ""}{meta.change?.toFixed(2) ?? 0}%
              </div>
              {meta.marketCap && (
                <p className="text-xs text-muted-foreground mt-1">Market Cap: {meta.marketCap}</p>
              )}
            </>
          ) : !loading ? (
            <p className="text-muted-foreground">—</p>
          ) : null}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          Failed to load financial data: {error}
        </div>
      )}

      {/* Chart */}
      <TradingViewChart ticker={upperTicker} />

      {/* Financials */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-3">Historical Price Data (5Y)</h2>
        <FinancialsTable data={financials} loading={loading} />
      </div>

      {/* Ad sidebar placeholder */}
      <AdSlot placement="banner" />
    </div>
  );
}
