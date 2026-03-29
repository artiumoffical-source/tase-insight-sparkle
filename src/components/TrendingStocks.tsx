import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, TrendingDown } from "lucide-react";
import TASE_STOCKS, { TRENDING_TICKERS } from "@/data/tase-stocks";

interface Quote {
  ticker: string;
  price: number;
  change: number;
  error: boolean;
}

export default function TrendingStocks() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${TRENDING_TICKERS.join(",")}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" } }
    )
      .then((res) => res.json())
      .then((data) => setQuotes(data.quotes ?? []))
      .catch((err) => console.error("Failed to fetch quotes:", err))
      .finally(() => setLoading(false));
  }, []);

  const getStock = (ticker: string) =>
    TASE_STOCKS.find((s) => s.ticker === ticker);

  if (loading) {
    return (
      <div className="w-full max-w-4xl px-4">
        <h2 className="font-display text-xl font-semibold mb-4">📈 Trending TASE Stocks</h2>
        <div className="flex gap-3 overflow-x-auto pb-2">
          {TRENDING_TICKERS.map((t) => (
            <div
              key={t}
              className="min-w-[180px] rounded-xl border bg-card p-4 animate-pulse"
            >
              <div className="h-4 bg-muted rounded w-16 mb-2" />
              <div className="h-6 bg-muted rounded w-20 mb-1" />
              <div className="h-4 bg-muted rounded w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl px-4">
      <h2 className="font-display text-xl font-semibold mb-4">📈 Trending TASE Stocks</h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {quotes.map((q) => {
          const stock = getStock(q.ticker);
          const isPositive = q.change >= 0;
          return (
            <button
              key={q.ticker}
              onClick={() => navigate(`/stock/${q.ticker}`)}
              className="min-w-[180px] rounded-xl border bg-card p-4 text-left hover:border-primary/50 hover:shadow-md transition-all flex-shrink-0 group"
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-display font-bold text-sm">{q.ticker}</span>
                <span className="text-xs text-muted-foreground">TASE</span>
              </div>
              <p className="text-xs text-muted-foreground truncate mb-2">
                {stock?.name}
              </p>
              <p className="text-xs text-muted-foreground truncate mb-2" dir="rtl">
                {stock?.nameHe}
              </p>
              {!q.error ? (
                <>
                  <p className="font-display text-lg font-bold">
                    ₪{q.price.toFixed(2)}
                  </p>
                  <div
                    className={`flex items-center gap-1 text-xs font-medium ${
                      isPositive ? "text-gain" : "text-loss"
                    }`}
                  >
                    {isPositive ? (
                      <TrendingUp className="h-3 w-3" />
                    ) : (
                      <TrendingDown className="h-3 w-3" />
                    )}
                    {isPositive ? "+" : ""}
                    {q.change.toFixed(2)}%
                  </div>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Price unavailable</p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
