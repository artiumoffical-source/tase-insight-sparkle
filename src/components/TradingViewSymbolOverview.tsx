import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";

interface Props {
  ticker: string;
}

export default function TradingViewSymbolOverview({ ticker }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const isHe = lang === "he";
    const symbol = `TASE:${ticker}`;

    // Symbol Info widget (price + change)
    const infoDiv = document.createElement("div");
    infoDiv.className = "tradingview-widget-container mb-1";
    const infoWidget = document.createElement("div");
    infoWidget.className = "tradingview-widget-container__widget";
    infoDiv.appendChild(infoWidget);
    const infoScript = document.createElement("script");
    infoScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-symbol-info.js";
    infoScript.type = "text/javascript";
    infoScript.async = true;
    infoScript.innerHTML = JSON.stringify({
      symbol,
      width: "100%",
      locale: isHe ? "he_IL" : "en",
      colorTheme: "dark",
      isTransparent: true,
    });
    infoDiv.appendChild(infoScript);

    // Advanced Chart widget
    const chartDiv = document.createElement("div");
    chartDiv.className = "tradingview-widget-container";
    chartDiv.id = `tv-chart-${ticker}`;
    const chartWidget = document.createElement("div");
    chartWidget.className = "tradingview-widget-container__widget";
    chartWidget.style.height = "500px";
    chartWidget.style.width = "100%";
    chartDiv.appendChild(chartWidget);
    const chartScript = document.createElement("script");
    chartScript.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    chartScript.type = "text/javascript";
    chartScript.async = true;
    chartScript.innerHTML = JSON.stringify({
      autosize: false,
      width: "100%",
      height: 500,
      symbol,
      interval: "D",
      timezone: "Asia/Jerusalem",
      theme: "dark",
      style: "1",
      locale: isHe ? "he_IL" : "en",
      allow_symbol_change: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
      backgroundColor: "rgba(18, 20, 25, 1)",
      gridColor: "rgba(40, 44, 55, 0.3)",
      hide_side_toolbar: false,
      withdateranges: true,
      hide_volume: false,
    });
    chartDiv.appendChild(chartScript);

    containerRef.current.appendChild(infoDiv);
    containerRef.current.appendChild(chartDiv);
  }, [ticker, lang]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div ref={containerRef} style={{ width: "100%" }} />
    </div>
  );
}
