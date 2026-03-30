import { useEffect, useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, Circle, RefreshCw, BarChart3 } from "lucide-react";
import { prefetchFinancials, prefetchNews } from "@/lib/stock-cache";
import { supabase } from "@/integrations/supabase/client";

interface StockRow {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number | null;
  change: number | null;
  flash?: "up" | "down" | "";
}

interface IndexRow {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number | null;
  change: number | null;
  flash?: "up" | "down" | "";
}

// TA-125 tier stocks whitelist — only well-known, high-cap companies
const TA125_TICKERS = new Set([
  "LUMI","POLI","TEVA","ICL","ESLT","AZRG","DSCT","MZTF","NICE","BEZQ",
  "NXSN","PHOE","CEL","CLIS","HARL","MGDL","FIBI","ORA","SPNS","PTNR",
  "AMOT","GZIT","SHPG","DLEKG","ELCO","ISOP",
  "NVMI","TSEM","CHKP","CYBR","ENLT","ENRG","OPCE","FTAL","DIMRI",
  "MLSR","STRS","RMLI","MTRX","MLTM","HLAN","SAE","FOX","DALT",
  "SKBN","ISCN","PERI","ISRA","ELAL","DNYA","ORL","PZOL","ILCO",
  "MMHD","NYAX","NWMD","NVPT","GCT","DLEA","DORL","ECNR","BIG",
  "GVYM","AYAL","ELTR","GILT","INCR","SPEN","MTRN","AUDC","MAXO",
  "KEN","KLIL","ISRO","RANI","CBI","MTDS","MSHR","MVNE","PLSN",
  "TASE","DANH","KAFR","CLBV","DISI","BVC","FORTY","HOD","MDTR",
  "ORMP","LPSN","PAYT","ARBE","FRSX","BLRX",
]);

const INDICES: IndexRow[] = [
  { symbol: "TA35", nameHe: "מדד ת\"א 35", nameEn: "TA-35 Index", price: null, change: null },
  { symbol: "TA90", nameHe: "מדד ת\"א 90", nameEn: "TA-90 Index", price: null, change: null },
  { symbol: "TABANKS", nameHe: "מדד ת\"א בנקים", nameEn: "TA Banks Index", price: null, change: null },
  { symbol: "TATECH", nameHe: "מדד ת\"א טכנולוגיה", nameEn: "TA Tech Index", price: null, change: null },
];

const FALLBACK_STOCKS: StockRow[] = [
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
  const [stocks, setStocks] = useState<StockRow[]>([]);
  const [indices, setIndices] = useState<IndexRow[]>(INDICES);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string | null>(null);
  const prevPrices = useRef<Record<string, number>>({});
  const tickerListRef = useRef<string[]>([]);
  const stockMetaRef = useRef<Record<string, { nameHe: string; nameEn: string }>>({});

  // Load tickers from DB, filtered to TA-125 quality
  useEffect(() => {
    supabase
      .from("tase_symbols")
      .select("ticker, name, name_he")
      .eq("exchange", "TA")
      .limit(200)
      .then(({ data }) => {
        if (!data || data.length === 0) {
          tickerListRef.current = FALLBACK_STOCKS.map((s) => s.symbol);
          const meta: Record<string, { nameHe: string; nameEn: string }> = {};
          FALLBACK_STOCKS.forEach((s) => { meta[s.symbol] = { nameHe: s.nameHe, nameEn: s.nameEn }; });
          stockMetaRef.current = meta;
          return;
        }
        const tickers: string[] = [];
        const meta: Record<string, { nameHe: string; nameEn: string }> = {};
        data
          .filter((row) => /^[A-Z]{2,10}$/.test(row.ticker) && TA125_TICKERS.has(row.ticker))
          .forEach((row) => {
            tickers.push(row.ticker);
            meta[row.ticker] = {
              nameHe: row.name_he || row.name,
              nameEn: row.name,
            };
          });
        // Ensure fallback stocks are included
        FALLBACK_STOCKS.forEach((s) => {
          if (!meta[s.symbol]) {
            tickers.push(s.symbol);
            meta[s.symbol] = { nameHe: s.nameHe, nameEn: s.nameEn };
          }
        });
        tickerListRef.current = tickers;
        stockMetaRef.current = meta;
      });
  }, []);

  const fetchData = useCallback(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) { setLoading(false); return; }

    const stockTickers = tickerListRef.current.length > 0
      ? tickerListRef.current
      : FALLBACK_STOCKS.map((s) => s.symbol);

    const indexTickers = ["TA35", "TA90", "TABANKS", "TATECH"];
    const allTickers = [...indexTickers, ...stockTickers].join(",");

    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${allTickers}&_ts=${Date.now()}`,
      { headers: { apikey: anonKey, "Content-Type": "application/json" }, cache: "no-store" }
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data?.quotes) return;
        const meta = stockMetaRef.current;
        const indexSet = new Set(indexTickers);

        // Process indices
        const updatedIndices = INDICES.map((idx) => {
          const q = data.quotes.find((qq: any) => qq.ticker === idx.symbol);
          if (!q || q.error || q.price <= 0) return idx;
          const oldPrice = prevPrices.current[idx.symbol];
          let flash: "up" | "down" | "" = "";
          if (oldPrice != null && oldPrice !== q.price) {
            flash = q.price > oldPrice ? "up" : "down";
          }
          prevPrices.current[idx.symbol] = q.price;
          return { ...idx, price: q.price, change: q.change, flash };
        });
        setIndices(updatedIndices);

        // Process stocks
        const updatedStocks: StockRow[] = data.quotes
          .filter((q: any) => !q.error && q.price > 0 && !indexSet.has(q.ticker))
          .map((q: any) => {
            const sym = q.ticker?.replace(".TA", "") ?? q.ticker;
            if (!TA125_TICKERS.has(sym)) return null;
            const m = meta[sym] || { nameHe: sym, nameEn: sym };
            const oldPrice = prevPrices.current[sym];
            let flash: "up" | "down" | "" = "";
            if (oldPrice != null && oldPrice !== q.price) {
              flash = q.price > oldPrice ? "up" : "down";
            }
            prevPrices.current[sym] = q.price;
            return { symbol: sym, nameHe: m.nameHe, nameEn: m.nameEn, price: q.price, change: q.change, flash };
          })
          .filter(Boolean) as StockRow[];

        setStocks(updatedStocks);

        setTimeout(() => {
          setStocks((prev) => prev.map((s) => ({ ...s, flash: "" })));
          setIndices((prev) => prev.map((s) => ({ ...s, flash: "" })));
        }, 800);

        setLastUpdate(new Date().toLocaleTimeString("he-IL", { hour: "2-digit", minute: "2-digit", second: "2-digit" }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const initTimeout = setTimeout(fetchData, 300);
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(fetchData, 5_000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => { if (document.hidden) { stop(); } else { fetchData(); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { clearTimeout(initTimeout); stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchData]);

  const gainers = [...stocks].filter((s) => (s.change ?? 0) > 0).sort((a, b) => (b.change ?? 0) - (a.change ?? 0)).slice(0, 10);
  const losers = [...stocks].filter((s) => (s.change ?? 0) < 0).sort((a, b) => (a.change ?? 0) - (b.change ?? 0)).slice(0, 10);

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
      ) : (
        <div className="space-y-4">
          {/* Indices Section */}
          <div className="rounded-xl border border-border/20 bg-card/30 overflow-hidden">
            <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" />
              <h3 className="text-xs font-bold text-primary">
                {isRtl ? "מדדים" : "Indices"}
              </h3>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4">
              {indices.map((idx) => (
                <IndexCard key={idx.symbol} index={idx} isRtl={isRtl} />
              ))}
            </div>
          </div>

          {/* Gainers & Losers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-gain/10 bg-card/30 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-gain" />
                <h3 className="text-xs font-bold text-gain">
                  {isRtl ? "המרוויחות" : "Top Gainers"}
                </h3>
              </div>
              {gainers.length > 0 ? (
                gainers.map((s) => <StockRowLink key={s.symbol} stock={s} isRtl={isRtl} />)
              ) : (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {isRtl ? "אין מניות עולות כרגע" : "No gainers right now"}
                </div>
              )}
            </div>

            <div className="rounded-xl border border-loss/10 bg-card/30 overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border/15 flex items-center gap-1.5">
                <TrendingDown className="h-3.5 w-3.5 text-loss" />
                <h3 className="text-xs font-bold text-loss">
                  {isRtl ? "המפסידות" : "Top Losers"}
                </h3>
              </div>
              {losers.length > 0 ? (
                losers.map((s) => <StockRowLink key={s.symbol} stock={s} isRtl={isRtl} />)
              ) : (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                  {isRtl ? "אין מניות יורדות כרגע" : "No losers right now"}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function IndexCard({ index, isRtl }: { index: IndexRow; isRtl: boolean }) {
  const change = index.change ?? 0;
  const isPositive = change > 0;
  const isNegative = change < 0;
  const flashClass = index.flash === "up" ? "animate-flash-green" : index.flash === "down" ? "animate-flash-red" : "";

  return (
    <div className={`px-3 py-3 border-e border-b border-border/10 last:border-e-0 ${flashClass}`}>
      <p className="text-[11px] font-medium text-muted-foreground truncate mb-1">
        {isRtl ? index.nameHe : index.nameEn}
      </p>
      {index.price !== null ? (
        <>
          <p className="text-sm font-display font-bold tabular-nums text-foreground">
            {index.price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className={`text-[11px] font-bold tabular-nums ${change > 0 ? "text-gain" : change < 0 ? "text-loss" : "text-muted-foreground"}`}>
            {Math.abs(change).toFixed(2)}%
          </p>
        </>
      ) : (
        <p className="text-xs text-muted-foreground/50 animate-pulse">—</p>
      )}
    </div>
  );
}

function StockRowLink({ stock, isRtl }: { stock: StockRow; isRtl: boolean }) {
  const change = stock.change ?? 0;
  const isPositive = change > 0;
  const isNegative = change < 0;
  const flashClass = stock.flash === "up" ? "animate-flash-green" : stock.flash === "down" ? "animate-flash-red" : "";

  const handleMouseEnter = () => {
    prefetchFinancials(stock.symbol);
    prefetchNews(stock.symbol);
  };

  return (
    <Link
      to={`/stock/${stock.symbol}.TA`}
      onMouseEnter={handleMouseEnter}
      className={`flex items-center justify-between px-4 py-3 hover:bg-secondary/20 transition-colors border-b border-border/8 last:border-b-0 ${flashClass}`}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-foreground/90 truncate">
          {isRtl ? stock.nameHe : stock.nameEn}
        </p>
        <p className="text-[10px] text-muted-foreground/60">{stock.symbol}</p>
      </div>
      <div className="text-end flex-shrink-0 ms-3">
        <p className="text-sm font-display font-bold tabular-nums">
          ₪{(stock.price ?? 0).toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
        </p>
        <p className={`text-xs font-bold tabular-nums ${change > 0 ? "text-gain" : change < 0 ? "text-loss" : "text-muted-foreground"}`}>
          {Math.abs(change).toFixed(2)}%
        </p>
      </div>
    </Link>
  );
}
