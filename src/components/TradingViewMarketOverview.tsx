import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";

export default function TradingViewMarketOverview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      dateRange: "1D",
      showChart: true,
      locale: lang === "he" ? "he_IL" : "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: "100%",
      height: 550,
      plotLineColorGrowing: "hsl(153, 69%, 48%)",
      plotLineColorFalling: "hsl(0, 84%, 60%)",
      gridLineColor: "rgba(40, 44, 55, 0.3)",
      scaleFontColor: "rgba(209, 212, 220, 0.7)",
      belowLineFillColorGrowing: "rgba(34, 197, 94, 0.08)",
      belowLineFillColorFalling: "rgba(239, 68, 68, 0.08)",
      belowLineFillColorGrowingBottom: "rgba(34, 197, 94, 0)",
      belowLineFillColorFallingBottom: "rgba(239, 68, 68, 0)",
      symbolActiveColor: "rgba(34, 197, 94, 0.12)",
      tabs: [
        {
          title: "Indices",
          symbols: [
            { s: "TASE:TA35", d: "TA-35" },
            { s: "TASE:TA125", d: "TA-125" },
            { s: "TASE:TA90", d: "TA-90" },
            { s: "TASE:TABANK", d: "TA-Banks" },
            { s: "TASE:TAREAL", d: "TA-Real Estate" },
          ],
        },
        {
          title: "Top Gainers",
          symbols: [
            { s: "TASE:LUMI", d: "Leumi" },
            { s: "TASE:POLI", d: "Poalim" },
            { s: "TASE:TEVA", d: "Teva" },
            { s: "TASE:ICL", d: "ICL" },
            { s: "TASE:ESLT", d: "Elbit" },
          ],
        },
        {
          title: "Top Losers",
          symbols: [
            { s: "TASE:NICE", d: "Nice" },
            { s: "TASE:BEZQ", d: "Bezeq" },
            { s: "TASE:AZRG", d: "Azrieli" },
            { s: "TASE:DSCT", d: "Discount" },
            { s: "TASE:MZTF", d: "Mizrahi" },
          ],
        },
      ],
    });

    containerRef.current.appendChild(script);
  }, [lang]);

  return (
    <div className="w-full max-w-5xl px-4">
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: 550, width: "100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
