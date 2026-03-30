import { useEffect, useState, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface TickerItem {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number | null;
  change: number | null;
}

const TICKER_SYMBOLS: TickerItem[] = [
  { symbol: "LUMI", nameHe: "לאומי", nameEn: "Leumi", price: null, change: null },
  { symbol: "POLI", nameHe: "פועלים", nameEn: "Poalim", price: null, change: null },
  { symbol: "TEVA", nameHe: "טבע", nameEn: "Teva", price: null, change: null },
  { symbol: "ESLT", nameHe: "אלביט", nameEn: "Elbit", price: null, change: null },
  { symbol: "ICL", nameHe: "כיל", nameEn: "ICL", price: null, change: null },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision", price: null, change: null },
  { symbol: "NICE", nameHe: "נייס", nameEn: "NICE", price: null, change: null },
];

export default function NativeTickerTape() {
  const { isRtl } = useLanguage();
  const [items, setItems] = useState<TickerItem[]>(TICKER_SYMBOLS);

  const fetchData = useCallback(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) return;

    const tickers = TICKER_SYMBOLS.map((t) => t.symbol).join(",");
    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickers}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" }, cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        setItems((prev) =>
          prev.map((item) => {
            const q = data.quotes.find(
              (qq: any) => qq.ticker?.replace(".TA", "") === item.symbol
            );
            if (!q || q.error || q.price <= 0) return item;
            return { ...item, price: q.price, change: q.change };
          })
        );
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const doubled = [...items, ...items];

  return (
    <div className="w-full overflow-hidden border-b border-border/20 bg-card/40">
      <div className="flex animate-[ticker-scroll_30s_linear_infinite] whitespace-nowrap py-2.5">
        {doubled.map((item, i) => {
          const isPositive = (item.change ?? 0) > 0;
          const isNegative = (item.change ?? 0) < 0;

          return (
            <Link
              key={`${item.symbol}-${i}`}
              to={`/stock/${item.symbol}.TA`}
              className="inline-flex items-center gap-2 px-5 text-xs hover:bg-secondary/30 transition-colors border-e border-border/10"
            >
              <span className="font-medium text-foreground/70">
                {isRtl ? item.nameHe : item.nameEn}
              </span>
              {item.price !== null ? (
                <>
                  <span className="font-display font-bold text-foreground">
                    ₪{item.price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 font-semibold ${
                      isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"
                    }`}
                  >
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {isPositive ? "+" : ""}{(item.change ?? 0).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/50 text-[10px] animate-pulse">
                  {isRtl ? "טוען..." : "Loading..."}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
