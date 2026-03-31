import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import StockLogo from "@/components/StockLogo";
import { supabase } from "@/integrations/supabase/client";
import { useMarketData } from "@/hooks/useMarketData";

interface TickerItem {
  symbol: string;
  nameHe: string;
  nameEn: string;
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
  { symbol: "LUMI", nameHe: "לאומי", nameEn: "Leumi" },
  { symbol: "POLI", nameHe: "פועלים", nameEn: "Poalim" },
  { symbol: "TEVA", nameHe: "טבע", nameEn: "Teva" },
  { symbol: "ESLT", nameHe: "אלביט", nameEn: "Elbit" },
  { symbol: "ICL", nameHe: "כיל", nameEn: "ICL" },
  { symbol: "NXSN", nameHe: "נקסט ויז'ן", nameEn: "Next Vision" },
  { symbol: "NICE", nameHe: "נייס", nameEn: "NICE" },
  { symbol: "AZRG", nameHe: "עזריאלי", nameEn: "Azrieli" },
  { symbol: "DSCT", nameHe: "דיסקונט", nameEn: "Discount" },
  { symbol: "MZTF", nameHe: "מזרחי", nameEn: "Mizrahi" },
];

const TAPE_TICKERS = TICKER_SYMBOLS.map((t) => t.symbol);

export default function NativeTickerTape() {
  const { isRtl } = useLanguage();
  const [items, setItems] = useState<TickerItem[]>(TICKER_SYMBOLS);

  // Fetch logos from DB once
  useEffect(() => {
    supabase
      .from("tase_symbols")
      .select("ticker, logo_url")
      .in("ticker", TAPE_TICKERS)
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

  const { quotes, flashes, status, marketOpen } = useMarketData({ tickers: TAPE_TICKERS });

  // Triple for seamless infinite loop
  const tripled = [...items, ...items, ...items];

  return (
    <div className="w-full overflow-hidden border-b border-border/20 bg-card/40" dir="ltr">
      <div
        className="flex whitespace-nowrap py-2.5"
        style={{ animation: "ticker-scroll 40s linear infinite" }}
      >
        {tripled.map((item, i) => {
          const q = quotes[item.symbol];
          const price = q?.price ?? null;
          const change = q?.change ?? null;
          const isPositive = (change ?? 0) > 0;
          const isNegative = (change ?? 0) < 0;
          const flash = flashes[item.symbol] || "";

          const flashBg = flash === "up"
            ? "animate-flash-green"
            : flash === "down"
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
              {price !== null ? (
                <>
                  <span className="font-display font-bold text-foreground tabular-nums">
                    ₪{price.toLocaleString("he-IL", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                  <span
                    className={`flex items-center gap-0.5 font-semibold tabular-nums ${
                      isPositive ? "text-gain" : isNegative ? "text-loss" : "text-muted-foreground"
                    }`}
                  >
                    {isPositive ? <TrendingUp className="h-3 w-3" /> : isNegative ? <TrendingDown className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                    {Math.abs(change ?? 0).toFixed(2)}%
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
