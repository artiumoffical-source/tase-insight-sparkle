import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, BarChart3, Circle } from "lucide-react";
import StockLogo from "@/components/StockLogo";

interface StockRow {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number;
  change: number;
  logoUrl?: string | null;
}

const DEFAULT_STOCKS: StockRow[] = [
  { symbol: "LUMI", nameHe: "בנק לאומי", nameEn: "Bank Leumi", price: 40.12, change: 1.25 },
  { symbol: "POLI", nameHe: "בנק הפועלים", nameEn: "Bank Hapoalim", price: 38.5, change: 0.85 },
  { symbol: "TEVA", nameHe: "טבע תעשיות", nameEn: "Teva Pharma", price: 68.4, change: 0.62 },
  { symbol: "ICL", nameHe: "כיל", nameEn: "ICL Group", price: 21.3, change: 0.45 },
  { symbol: "ESLT", nameHe: "אלביט מערכות", nameEn: "Elbit Systems", price: 310.0, change: 0.38 },
  { symbol: "AZRG", nameHe: "קבוצת עזריאלי", nameEn: "Azrieli Group", price: 85.2, change: -0.22 },
  { symbol: "DSCT", nameHe: "בנק דיסקונט", nameEn: "Bank Discount", price: 27.8, change: -0.55 },
  { symbol: "MZTF", nameHe: "מזרחי טפחות", nameEn: "Mizrahi Tefahot", price: 45.6, change: -0.72 },
  { symbol: "NICE", nameHe: "נייס מערכות", nameEn: "NICE Systems", price: 195.0, change: -1.1 },
  { symbol: "BEZQ", nameHe: "בזק", nameEn: "Bezeq", price: 4.52, change: -1.35 },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision", price: 12.8, change: 2.1 },
  { symbol: "PHOE", nameHe: "הפניקס", nameEn: "The Phoenix", price: 52.3, change: 0.15 },
  { symbol: "CLIS", nameHe: "כלל ביטוח", nameEn: "Clal Insurance", price: 78.1, change: -0.33 },
  { symbol: "MGDL", nameHe: "מגדל ביטוח", nameEn: "Migdal Insurance", price: 12.4, change: -0.48 },
  { symbol: "CEL", nameHe: "סלקום", nameEn: "Cellcom", price: 33.2, change: 0.28 },
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

export default function MarketTables() {
  const { isRtl } = useLanguage();
  const marketOpen = useMarketOpen();
  const [stocks, setStocks] = useState<StockRow[]>(DEFAULT_STOCKS);

  useEffect(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) return;

    const tickers = DEFAULT_STOCKS.map((s) => s.symbol).join(",");
    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickers}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" } }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        setStocks((prev) =>
          prev.map((s) => {
            const q = data.quotes.find(
              (qq: any) =>
                qq.ticker?.replace(".TA", "") === s.symbol ||
                qq.code?.replace(".TA", "") === s.symbol
            );
            if (!q) return s;
            const price = q.close || q.previousClose || q.adjusted_close || s.price;
            const change = q.change_p ?? s.change;
            return { ...s, price, change };
          })
        );
      })
      .catch(() => {});
  }, []);

  const gainers = [...stocks].sort((a, b) => b.change - a.change).slice(0, 7);
  const losers = [...stocks].sort((a, b) => a.change - b.change).slice(0, 7);

  return (
    <div className="w-full max-w-[700px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground/90">
            {isRtl ? "סקירת שוק" : "Market Overview"}
          </h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Circle
            className={`h-2 w-2 fill-current ${
              marketOpen ? "text-gain animate-pulse" : "text-muted-foreground/50"
            }`}
          />
          <span className="text-[11px] text-muted-foreground">
            {isRtl
              ? marketOpen
                ? "הבורסה פתוחה"
                : "הבורסה סגורה"
              : marketOpen
              ? "Market Open"
              : "Market Closed"}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Gainers */}
        <div className="rounded-xl border border-border/30 bg-card/20 backdrop-blur-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/20">
            <h3 className="text-xs font-semibold text-gain flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              {isRtl ? "העולות" : "Top Gainers"}
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            {gainers.map((s) => (
              <StockRowItem key={s.symbol} stock={s} isRtl={isRtl} />
            ))}
          </div>
        </div>

        {/* Losers */}
        <div className="rounded-xl border border-border/30 bg-card/20 backdrop-blur-md overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border/20">
            <h3 className="text-xs font-semibold text-loss flex items-center gap-1.5">
              <TrendingDown className="h-3.5 w-3.5" />
              {isRtl ? "היורדות" : "Top Losers"}
            </h3>
          </div>
          <div className="divide-y divide-border/10">
            {losers.map((s) => (
              <StockRowItem key={s.symbol} stock={s} isRtl={isRtl} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StockRowItem({ stock, isRtl }: { stock: StockRow; isRtl: boolean }) {
  const isPositive = stock.change >= 0;

  return (
    <Link
      to={`/stock/${stock.symbol}.TA`}
      className="flex items-center justify-between px-4 py-2.5 hover:bg-secondary/30 transition-colors"
    >
      <div className="flex items-center gap-2.5">
        <StockLogo name={stock.nameEn} logoUrl={stock.logoUrl} size="sm" />
        <div>
          <p className="text-sm font-medium text-foreground/90">
            {isRtl ? stock.nameHe : stock.nameEn}
          </p>
          <p className="text-[10px] text-muted-foreground">{stock.symbol}</p>
        </div>
      </div>
      <div className="text-end">
        <p className="text-sm font-display font-semibold">
          ₪{stock.price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p
          className={`text-xs font-semibold ${
            isPositive ? "text-gain" : "text-loss"
          }`}
        >
          {isPositive ? "+" : ""}
          {stock.change.toFixed(2)}%
        </p>
      </div>
    </Link>
  );
}
