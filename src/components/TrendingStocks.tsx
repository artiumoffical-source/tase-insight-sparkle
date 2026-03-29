import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown, Clock } from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import StockLogo from "@/components/StockLogo";

interface TrendingStock {
  ticker: string;
  name: string;
  logoUrl: string | null;
  price: number;
  change: number;
}

export default function TrendingStocks() {
  const [gainers, setGainers] = useState<TrendingStock[]>([]);
  const [losers, setLosers] = useState<TrendingStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [marketOpen, setMarketOpen] = useState(false);
  const [lastDate, setLastDate] = useState("");
  const [tab, setTab] = useState<"gainers" | "losers">("gainers");
  const navigate = useNavigate();
  const { t, isRtl } = useLanguage();

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-market-trends`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" } }
    )
      .then((res) => res.json())
      .then((data) => {
        setGainers(data.gainers ?? []);
        setLosers(data.losers ?? []);
        setMarketOpen(data.marketOpen ?? false);
        setLastDate(data.lastDate ?? "");
      })
      .catch((err) => console.error("Failed to fetch market trends:", err))
      .finally(() => setLoading(false));
  }, []);

  const items = tab === "gainers" ? gainers : losers;

  const formattedDate = lastDate
    ? (() => {
        try {
          return new Date(lastDate + "T00:00:00").toLocaleDateString(
            isRtl ? "he-IL" : "en-US",
            { month: "short", day: "numeric" }
          );
        } catch { return lastDate; }
      })()
    : "";

  if (loading) {
    return (
      <div className="w-full max-w-4xl px-4">
        <h2 className="font-display text-xl font-semibold mb-4">{t("trending.title")}</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="min-w-[180px] rounded-xl border bg-card p-4 animate-pulse">
              <div className="h-7 w-7 bg-muted rounded-full mb-2" />
              <div className="h-4 bg-muted rounded w-20 mb-2" />
              <div className="h-6 bg-muted rounded w-16 mb-1" />
              <div className="h-4 bg-muted rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl px-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <h2 className="font-display text-xl font-semibold">{t("trending.title")}</h2>
          {/* Market status indicator */}
          <div className="flex items-center gap-1.5 text-xs">
            {marketOpen ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
                </span>
                <span className="text-green-500 font-medium">{t("trending.marketOpen")}</span>
              </>
            ) : (
              <>
                <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">{t("trending.marketClosed")}</span>
              </>
            )}
          </div>
        </div>
        <Tabs value={tab} onValueChange={(v) => setTab(v as "gainers" | "losers")}>
          <TabsList className="h-8">
            <TabsTrigger value="gainers" className="text-xs px-3 py-1">
              {t("trending.gainers")}
            </TabsTrigger>
            <TabsTrigger value="losers" className="text-xs px-3 py-1">
              {t("trending.losers")}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {!marketOpen && lastDate && (
        <p className="text-xs text-muted-foreground mb-3">
          {t("trending.lastTradingDay")}: {formattedDate}
        </p>
      )}

      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.length === 0 ? null : (
          items.map((q) => {
            const isPositive = q.change >= 0;
            return (
              <button
                key={q.ticker}
                onClick={() => navigate(`/stock/${q.ticker}`)}
                className="min-w-[180px] rounded-xl border bg-card p-4 text-start hover:border-primary/50 hover:shadow-md transition-all flex-shrink-0 group"
              >
                <div className="flex items-center gap-2 mb-2">
                  <StockLogo name={q.name} logoUrl={q.logoUrl} size="sm" />
                  <div className="min-w-0 flex-1">
                    <span className="font-display font-bold text-sm">{q.ticker}</span>
                    <span className="text-[10px] text-muted-foreground ms-1.5">TASE</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground truncate mb-2">
                  {q.name}
                </p>
                <p className="font-display text-lg font-bold">
                  ₪{q.price.toFixed(2)}
                </p>
                <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? "text-gain" : "text-loss"}`}>
                  {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {isPositive ? "+" : ""}{q.change.toFixed(2)}%
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
