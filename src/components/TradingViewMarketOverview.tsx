import { useEffect, useRef, useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { BarChart3, Circle } from "lucide-react";

function useMarketOpen() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const check = () => {
      const now = new Date();
      // Israel time (UTC+2 winter / UTC+3 summer)
      const il = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Jerusalem" }));
      const day = il.getDay(); // 0=Sun
      const h = il.getHours();
      const m = il.getMinutes();
      const mins = h * 60 + m;
      // TASE: Sun-Thu 10:00-17:30
      setOpen(day >= 0 && day <= 4 && mins >= 600 && mins <= 1050);
    };
    check();
    const id = setInterval(check, 60_000);
    return () => clearInterval(id);
  }, []);

  return open;
}

export default function TradingViewMarketOverview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, isRtl } = useLanguage();
  const marketOpen = useMarketOpen();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const isHe = lang === "he";

    const script = document.createElement("script");
    script.src =
      "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      dateRange: "1D",
      showChart: false,
      locale: isHe ? "he_IL" : "en",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: "100%",
      height: 350,
      tabs: [
        {
          title: isHe ? "מדדים" : "Indices",
          symbols: [
            { s: "TASE:TA35", d: isHe ? 'מדד ת"א 35' : "TA-35 Index" },
            { s: "TASE:TA125", d: isHe ? 'מדד ת"א 125' : "TA-125 Index" },
            { s: "TASE:TABANK", d: isHe ? 'מדד ת"א בנקים' : "TA-Banks" },
          ],
        },
        {
          title: isHe ? "העולות" : "Gainers",
          symbols: [
            { s: "TASE:LUMI", d: isHe ? "בנק לאומי" : "Bank Leumi" },
            { s: "TASE:POLI", d: isHe ? "בנק הפועלים" : "Bank Hapoalim" },
            { s: "TASE:TEVA", d: isHe ? "טבע תעשיות" : "Teva Pharma" },
            { s: "TASE:ICL", d: isHe ? "כיל" : "ICL Group" },
            { s: "TASE:ESLT", d: isHe ? "אלביט מערכות" : "Elbit Systems" },
          ],
        },
        {
          title: isHe ? "היורדות" : "Losers",
          symbols: [
            { s: "TASE:NICE", d: isHe ? "נייס מערכות" : "NICE Systems" },
            { s: "TASE:BEZQ", d: isHe ? "בזק החברה" : "Bezeq" },
            { s: "TASE:AZRG", d: isHe ? "קבוצת עזריאלי" : "Azrieli Group" },
            { s: "TASE:DSCT", d: isHe ? "בנק דיסקונט" : "Bank Discount" },
            { s: "TASE:MZTF", d: isHe ? "מזרחי טפחות" : "Mizrahi Tefahot" },
          ],
        },
      ],
    });

    containerRef.current.appendChild(script);
  }, [lang]);

  return (
    <div className="w-full max-w-[600px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-xl border border-border/30 bg-card/20 backdrop-blur-lg shadow-lg overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            <h2 className="font-display text-sm font-semibold tracking-tight text-foreground/90">
              {isRtl ? "סקירת שוק" : "Market Overview"}
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <Circle
              className={`h-2 w-2 fill-current ${marketOpen ? "text-gain animate-pulse" : "text-muted-foreground/50"}`}
            />
            <span className="text-[11px] text-muted-foreground">
              {isRtl
                ? marketOpen ? "הבורסה פתוחה" : "הבורסה סגורה"
                : marketOpen ? "Market Open" : "Market Closed"}
            </span>
          </div>
        </div>

        {/* Widget */}
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: 350, width: "100%" }}
        >
          <div
            className="tradingview-widget-container__widget"
            style={{ height: "100%", width: "100%" }}
          />
        </div>
      </div>
    </div>
  );
}
