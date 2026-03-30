import { useEffect, useState, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import StockLogo from "@/components/StockLogo";
import { supabase } from "@/integrations/supabase/client";

interface TickerItem {
  symbol: string;
  nameHe: string;
  nameEn: string;
  price: number | null;
  change: number | null;
  flash?: "up" | "down" | "";
  logoUrl?: string | null;
  domain?: string | null;
}

const COMPANY_DOMAINS: Record<string, string> = {
  LUMI: "bankleumi.co.il",
  POLI: "bankhapoalim.co.il",
  TEVA: "tevapharm.com",
  ESLT: "elbitsystems.com",
  ICL: "icl-group.com",
  NXSN: "nextvision.com",
  NICE: "nice.com",
  AZRG: "azrieli.com",
  DSCT: "discountbank.co.il",
  MZTF: "mizrahi-tefahot.co.il",
};

const TICKER_SYMBOLS: TickerItem[] = [
  { symbol: "LUMI", nameHe: "לאומי", nameEn: "Leumi", price: null, change: null },
  { symbol: "POLI", nameHe: "פועלים", nameEn: "Poalim", price: null, change: null },
  { symbol: "TEVA", nameHe: "טבע", nameEn: "Teva", price: null, change: null },
  { symbol: "ESLT", nameHe: "אלביט", nameEn: "Elbit", price: null, change: null },
  { symbol: "ICL", nameHe: "כיל", nameEn: "ICL", price: null, change: null },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision", price: null, change: null },
  { symbol: "NICE", nameHe: "נייס", nameEn: "NICE", price: null, change: null },
  { symbol: "AZRG", nameHe: "עזריאלי", nameEn: "Azrieli", price: null, change: null },
  { symbol: "DSCT", nameHe: "דיסקונט", nameEn: "Discount", price: null, change: null },
  { symbol: "MZTF", nameHe: "מזרחי", nameEn: "Mizrahi", price: null, change: null },
];

// All items are stocks with internal pages

export default function NativeTickerTape() {
  const { isRtl } = useLanguage();
  const [items, setItems] = useState<TickerItem[]>(TICKER_SYMBOLS);
  const prevPrices = useRef<Record<string, number>>({});

  // Fetch logos from DB once
  useEffect(() => {
    const tickers = TICKER_SYMBOLS.map((s) => s.symbol);
    supabase
      .from("tase_symbols")
      .select("ticker, logo_url")
      .in("ticker", tickers)
      .then(({ data }) => {
        if (!data || data.length === 0) return;
        const logoMap: Record<string, string> = {};
        data.forEach((row) => { if (row.logo_url) logoMap[row.ticker] = row.logo_url; });
        setItems((prev) =>
          prev.map((s) => ({
            ...s,
            logoUrl: logoMap[s.symbol] || null,
            domain: COMPANY_DOMAINS[s.symbol] || null,
          }))
        );
      });
  }, []);


  const fetchData = useCallback(() => {
    const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
    const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!projectId || !anonKey) return;

    const tickers = TICKER_SYMBOLS.map((t) => t.symbol).join(",");
    fetch(
      `https://${projectId}.supabase.co/functions/v1/fetch-quotes?tickers=${tickers}&_ts=${Date.now()}`,
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
            if (!q || q.error || q.price <= 0) return { ...item, flash: "" };
            const oldPrice = prevPrices.current[item.symbol];
            let flash: "up" | "down" | "" = "";
            if (oldPrice != null && oldPrice !== q.price) {
              flash = q.price > oldPrice ? "up" : "down";
            }
            prevPrices.current[item.symbol] = q.price;
            return { ...item, price: q.price, change: q.change, flash };
          })
        );
        setTimeout(() => {
          setItems((prev) => prev.map((s) => ({ ...s, flash: "" })));
        }, 800);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchData();
    let id: ReturnType<typeof setInterval> | null = null;
    const start = () => { if (!id) id = setInterval(fetchData, 5_000); };
    const stop = () => { if (id) { clearInterval(id); id = null; } };
    const onVis = () => { if (document.hidden) { stop(); } else { fetchData(); start(); } };
    document.addEventListener("visibilitychange", onVis);
    start();
    return () => { stop(); document.removeEventListener("visibilitychange", onVis); };
  }, [fetchData]);

  // Triple the items for seamless infinite loop
  const tripled = [...items, ...items, ...items];

  return (
    <div className="w-full overflow-hidden border-b border-border/20 bg-card/40" dir="ltr">
      <div
        className="flex whitespace-nowrap py-2.5"
        style={{ animation: "ticker-scroll 40s linear infinite" }}
      >
        {tripled.map((item, i) => {
          const isPositive = (item.change ?? 0) > 0;
          const isNegative = (item.change ?? 0) < 0;

          const flashBg = item.flash === "up"
            ? "animate-flash-green"
            : item.flash === "down"
            ? "animate-flash-red"
            : "";

          return (
            <Link
              key={`${item.symbol}-${i}`}
              to={`/stock/${item.symbol}.TA`}
              className={`inline-flex items-center gap-2 px-5 text-xs hover:bg-secondary/30 transition-colors border-e border-border/10 ${flashBg}`}
            >
              <StockLogo name={isRtl ? item.nameHe : item.nameEn} logoUrl={item.logoUrl} domain={item.domain ?? COMPANY_DOMAINS[item.symbol]} size="sm" className="h-5 w-5" />
              <span className="font-medium text-foreground/70">
                {isRtl ? item.nameHe : item.nameEn}
              </span>
              {item.price !== null ? (
                <>
                  <span className="font-display font-bold text-foreground tabular-nums">
                    ₪{item.price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 font-semibold tabular-nums ${
                      isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"
                    }`}
                  >
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(item.change ?? 0).toFixed(2)}%
                  </span>
                </>
              ) : (
                <span className="text-muted-foreground/50 text-[10px] animate-pulse">
                  {isRtl ? "טוען..." : "..."}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
