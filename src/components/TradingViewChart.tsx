import { useEffect, useRef } from "react";

interface TradingViewChartProps {
  ticker: string;
}

export default function TradingViewChart({ ticker }: TradingViewChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;

    // Clear previous widget
    containerRef.current.innerHTML = "";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: `TASE:${ticker}`,
      interval: "D",
      timezone: "Asia/Jerusalem",
      theme: "dark",
      style: "1",
      locale: "en",
      backgroundColor: "rgba(18, 20, 25, 1)",
      gridColor: "rgba(40, 44, 55, 0.3)",
      hide_top_toolbar: false,
      hide_legend: false,
      allow_symbol_change: false,
      save_image: false,
      calendar: false,
      support_host: "https://www.tradingview.com",
    });

    containerRef.current.appendChild(script);
  }, [ticker]);

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div ref={containerRef} className="tradingview-widget-container" style={{ height: 450, width: "100%" }}>
        <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
      </div>
    </div>
  );
}
