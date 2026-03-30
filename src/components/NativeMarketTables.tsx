import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, Circle, RefreshCw } from "lucide-react";
import StockLogo from "@/components/StockLogo";

interface StockRow {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number | null;
  change: number | null;
  flash?: "up" | "down" | "";
}

const ALL_STOCKS: StockRow[] = [
  { symbol: "LUMI", nameHe: "בנק לאומי", nameEn: "Bank Leumi", price: null, change: null },
  { symbol: "POLI", nameHe: "בנק הפועלים", nameEn: "Bank Hapoalim", price: null, change: null },
  { symbol: "TEVA", nameHe: "טבע תעשיות", nameEn: "Teva Pharma", price: null, change: null },
  { symbol: "ICL", nameHe: "כיל", nameEn: "ICL Group", price: null, change: null },
  { symbol: "ESLT", nameHe: "אלביט מערכות", nameEn: "Elbit Systems", price: null, change: null },
  { symbol: "AZRG", nameHe: "קבוצת עזריאלי", nameEn: "Azrieli Group", price: null, change: null },
  { symbol: "DSCT", nameHe: "בנק דיסקונט", nameEn: "Bank Discount", price: null, change: null },
  { symbol: "MZTF", nameHe: "מזרחי טפחות", nameEn: "Mizrahi Tefahot", price: null, change: null },
  { symbol: "NICE", nameHe: "נייס מערכות", nameEn: "NICE Systems", price: null, change: null },
  { symbol: "BEZQ", nameHe: "בזק", nameEn: "Bezeq", price: null, change: null },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision", price: null, change: null },
  { symbol: "PHOE", nameHe: "הפניקס", nameEn: "The Phoenix", price: null, change: null },
  { symbol: "CEL", nameHe: "סלקום", nameEn: "Cellcom", price: null, change: null },
  { symbol: "CLIS", nameHe: "כלל ביטוח", nameEn: "Clal Insurance", price: null, change: null },
];

function useMarketOpen() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    const check = () => {
      const il = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
      const day = il.getDay();
      const mins = il.getHours() * 60 + il.getMinutes();
      setOpen(day >= 0 && day <= 4 && mins >= 600 && mins <= 1050);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);
  return open;
}

export default function NativeMarketTables() {
  const { isRtl } = useLanguage();
  const marketOpen = useMarketOpen();
  const [stocks, setStocks] = useState<StockRow[]>(ALL_STOCKS);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const prevPrices = useRef<Record<string, number>>({});

  const fetchData = useCallback(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) {
      setLoading(false);
      return;
    }

    const tickers = ALL_STOCKS.map((s) => s.symbol).join(",");
    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickers}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" }, cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        setStocks((prev) =>
          prev.map((s) => {
            const q = data.quotes.find(
              (qq: any) => qq.ticker?.replace(".TA", "") === s.symbol
            );
            if (!q || q.error || q.price <= 0) return { ...s, flash: "" };
            const oldPrice = prevPrices.current[s.symbol];
            let flash: "up" | "down" | "" = "";
            if (oldPrice != null && oldPrice !== q.price) {
              flash = q.price > oldPrice ? "up" : "down";
            }
            prevPrices.current[s.symbol] = q.price;
            return { ...s, price: q.price, change: q.change, flash };
          })
        );
        // Clear flash after animation
        setTimeout(() => {
          setStocks((prev) => prev.map((s) => ({ ...s, flash: "" })));
        }, 1200);

        const now = new Date();
        setLastUpdate(now.toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Initial fetch + polling every 60s
  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  const withData = stocks.filter((s) => s.price !== null);
  const gainers = [...withData].sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 7);
  const losers = [...withData].sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 7);

  return (
    <div className="w-full max-w-[700px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-base font-semibold text-foreground/90">
          {isRtl ? "סקירת שוק" : "Market Overview"}
        </h2>
        <div className="flex items-center gap-3">
          {lastUpdate && (
            <span className="text-[10px] text-muted-foreground/50 flex items-center gap-1">
              <RefreshCw className="h-2.5 w-2.5" />
              {lastUpdate}
            </span>
          )}
          <div className="flex items-center gap-1.5">
            <Circle
              className={`h-2 w-2 fill-current ${marketOpen ? "text-gain animate-pulse" : "text-muted-foreground/40"}`}
            />
            <span className="text-[11px] text-muted-foreground">
              {isRtl
                ? marketOpen ? "הבורסה פתוחה" : "הבורסה סגורה"
                : marketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm animate-pulse">
          {isRtl ? "טוען נתונים..." : "Loading data..."}
        </div>
      ) : withData.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground text-sm animate-pulse">
          {isRtl ? "טוען נתונים..." : "Loading data..."}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Gainers */}
          <div className="rounded-xl border border-gain/10 bg-card/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5 text-gain" />
              <h3 className="text-xs font-bold text-gain">
                {isRtl ? "המרוויחות" : "Top Gainers"}
              </h3>
            </div>
            {gainers.map((s) => (
              <StockRowLink key={s.symbol} stock={s} isRtl={isRtl} />
            ))}
          </div>

          {/* Losers */}
          <div className="rounded-xl border border-loss/10 bg-card/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5 text-loss" />
              <h3 className="text-xs font-bold text-loss">
                {isRtl ? "המפסידות" : "Top Losers"}
              </h3>
            </div>
            {losers.map((s) => (
              <StockRowLink key={s.symbol} stock={s} isRtl={isRtl} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StockRowLink({ stock, isRtl }: { stock: StockRow; isRtl: boolean }) {
  const change = stock.change ?? 0;
  const isPositive = change > 0;
  const isNegative = change < 0;

  const flashClass = stock.flash === "up"
    ? "animate-flash-green"
    : stock.flash === "down"
    ? "animate-flash-red"
    : "";

  return (
    <Link
      to={`/stock/${stock.symbol}.TA`}
      className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors border-b border-border/8 last:border-b-0 ${flashClass}`}
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <StockLogo name={stock.nameEn} size="sm" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground/90 truncate">
            {isRtl ? stock.nameHe : stock.nameEn}
          </p>
          <p className="text-[10px] text-muted-foreground/60">{stock.symbol}</p>
        </div>
      </div>
      <div className="text-end flex-shrink-0 ms-3">
        <p className="text-sm font-display font-bold tabular-nums">
          ₪{(stock.price ?? 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`text-xs font-bold tabular-nums ${isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"}`}>
          {isPositive ? "+" : ""}{change.toFixed(2)}%
        </p>
      </div>
    </Link>
  );
}
