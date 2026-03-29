import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";

interface TradingViewSymbolOverviewProps {
  ticker: string;
}

export default function TradingViewSymbolOverview({ ticker }: TradingViewSymbolOverviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [[`TASE:${ticker}|1D`]],
      chartOnly: false,
      width: "100%",
      height: 500,
      locale: lang === "he" ? "he_IL" : "en",
      colorTheme: "dark",
      autosize: false,
      showVolume: true,
      showMA: false,
      hideDateRanges: false,
      hideMarketStatus: false,
      hideSymbolLogo: false,
      scalePosition: "right",
      scaleMode: "Normal",
      fontFamily: "Inter, -apple-system, BlinkMacSystemFont, sans-serif",
      fontSize: "10",
      noTimeScale: false,
      valuesTracking: "1",
      changeMode: "price-and-percent",
      chartType: "area",
      lineWidth: 2,
      lineType: 0,
      dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "60m|1W", "all|1M"],
      lineColor: "rgba(34, 197, 94, 1)",
      topColor: "rgba(34, 197, 94, 0.15)",
      bottomColor: "rgba(34, 197, 94, 0)",
      backgroundColor: "rgba(18, 20, 25, 1)",
      gridLineColor: "rgba(40, 44, 55, 0.3)",
    });

    containerRef.current.appendChild(script);
  }, [ticker, lang]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: 500, width: "100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
