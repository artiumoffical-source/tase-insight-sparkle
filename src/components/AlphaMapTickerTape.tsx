import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown } from "lucide-react";

interface TickerItem {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number;
  change: number;
}

const TICKER_ITEMS: TickerItem[] = [
  { symbol: "TA35", nameHe: 'ת"א 35', nameEn: "TA-35", price: 2145.3, change: 0.42 },
  { symbol: "TA125", nameHe: 'ת"א 125', nameEn: "TA-125", price: 2089.1, change: 0.31 },
  { symbol: "LUMI", nameHe: "בנק לאומי", nameEn: "Leumi", price: 40.12, change: 1.25 },
  { symbol: "POLI", nameHe: "בנק הפועלים", nameEn: "Poalim", price: 38.5, change: -0.65 },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision", price: 12.8, change: 2.1 },
  { symbol: "TEVA", nameHe: "טבע", nameEn: "Teva", price: 68.4, change: -0.32 },
];

export default function AlphaMapTickerTape() {
  const { isRtl } = useLanguage();
  const [items, setItems] = useState<TickerItem[]>(TICKER_ITEMS);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch live data
  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) return;

    const tickers = TICKER_ITEMS.map((t) => t.symbol).join(",");
    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickers}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        setItems((prev) =>
          prev.map((item) => {
            const q = data.quotes.find(
              (qq: any) =>
                qq.ticker?.replace(".TA", "") === item.symbol ||
                qq.code?.replace(".TA", "") === item.symbol
            );
            if (!q) return item;
            const price = q.close || q.previousClose || q.adjusted_close || item.price;
            const change = q.change_p ?? item.change;
            return { ...item, price, change };
          })
        );
      })
      .catch(() => {});
  }, []);

  // Double items for seamless loop
  const doubled = [...items, ...items];

  return (
    <div className="w-full overflow-hidden border-b border-border/20 bg-card/50 backdrop-blur-sm">
      <div
        ref={scrollRef}
        className="flex animate-[ticker-scroll_25s_linear_infinite] gap-0 whitespace-nowrap py-2"
      >
        {doubled.map((item, i) => {
          const isPositive = item.change >= 0;
          const isIndex = item.symbol === "TA35" || item.symbol === "TA125";
          const href = isIndex ? "/" : `/stock/${item.symbol}.TA`;

          return (
            <Link
              key={`${item.symbol}-${i}`}
              to={href}
              className="inline-flex items-center gap-2 px-4 text-xs hover:bg-secondary/40 transition-colors border-e border-border/10"
            >
              <span className="font-medium text-foreground/80">
                {isRtl ? item.nameHe : item.nameEn}
              </span>
              <span className="font-display font-semibold text-foreground">
                ₪{item.price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
              <span
                className={`flex items-center gap-0.5 font-semibold ${
                  isPositive ? "text-gain" : "text-loss"
                }`}
              >
                {isPositive ? (
                  <TrendingUp className="h-3 w-3" />
                ) : (
                  <TrendingDown className="h-3 w-3" />
                )}
                {isPositive ? "+" : ""}
                {item.change.toFixed(2)}%
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
