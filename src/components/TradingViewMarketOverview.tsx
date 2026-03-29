import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { BarChart3 } from "lucide-react";

export default function TradingViewMarketOverview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, isRtl } = useLanguage();

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
      height: 380,
      tabs: [
        {
          title: isHe ? "מדדים" : "Indices",
          symbols: [
            { s: "TASE:TA35", d: isHe ? 'ת"א 35' : "TA-35" },
            { s: "TASE:TA125", d: isHe ? 'ת"א 125' : "TA-125" },
            { s: "TASE:TABANK", d: isHe ? 'ת"א בנקים' : "TA-Banks" },
          ],
        },
        {
          title: isHe ? "העולות" : "Gainers",
          symbols: [
            { s: "TASE:LUMI", d: isHe ? "לאומי" : "Leumi" },
            { s: "TASE:POLI", d: isHe ? "פועלים" : "Poalim" },
            { s: "TASE:TEVA", d: isHe ? "טבע" : "Teva" },
            { s: "TASE:ICL", d: "ICL" },
            { s: "TASE:ESLT", d: isHe ? "אלביט" : "Elbit" },
          ],
        },
        {
          title: isHe ? "היורדות" : "Losers",
          symbols: [
            { s: "TASE:NICE", d: "Nice" },
            { s: "TASE:BEZQ", d: isHe ? "בזק" : "Bezeq" },
            { s: "TASE:AZRG", d: isHe ? "עזריאלי" : "Azrieli" },
            { s: "TASE:DSCT", d: isHe ? "דיסקונט" : "Discount" },
            { s: "TASE:MZTF", d: isHe ? "מזרחי" : "Mizrahi" },
          ],
        },
      ],
    });

    containerRef.current.appendChild(script);
  }, [lang]);

  return (
    <div className="w-full max-w-[720px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-primary/10 bg-card/30 backdrop-blur-lg shadow-[0_0_30px_-10px_hsl(var(--primary)/0.15)] overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-5 pt-4 pb-2">
          <BarChart3 className="h-4.5 w-4.5 text-primary" />
          <h2 className="font-display text-base font-semibold tracking-tight text-foreground/90">
            {isRtl ? "סקירת שוק" : "Market Overview"}
          </h2>
        </div>

        {/* Widget */}
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: 380, width: "100%" }}
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
