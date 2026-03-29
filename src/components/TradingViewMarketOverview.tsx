import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { BarChart3 } from "lucide-react";

const LEGEND_HE = [
  { index: "ת\"א 35", desc: "35 החברות הגדולות בבורסה" },
  { index: "ת\"א 125", desc: "125 החברות המובילות" },
  { index: "ת\"א בנקים", desc: "מדד הבנקים" },
  { index: "ת\"א נדל\"ן", desc: "מדד הנדל\"ן" },
];

const LEGEND_EN = [
  { index: "TA-35", desc: "Top 35 companies on TASE" },
  { index: "TA-125", desc: "Top 125 companies" },
  { index: "TA-Banks", desc: "Banking sector index" },
  { index: "TA-Real Estate", desc: "Real estate sector index" },
];

export default function TradingViewMarketOverview() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang, isRtl } = useLanguage();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const isHe = lang === "he";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 420,
      symbolsGroups: [
        {
          name: isHe ? "מדדים" : "Indices",
          originalName: "Indices",
          symbols: [
            { name: "TASE:TA35", displayName: isHe ? "ת\"א 35" : "TA-35" },
            { name: "TASE:TA125", displayName: isHe ? "ת\"א 125" : "TA-125" },
            { name: "TASE:TA90", displayName: isHe ? "ת\"א 90" : "TA-90" },
            { name: "TASE:TABANK", displayName: isHe ? "ת\"א בנקים" : "TA-Banks" },
            { name: "TASE:TAREAL", displayName: isHe ? "ת\"א נדל\"ן" : "TA-Real Estate" },
          ],
        },
        {
          name: isHe ? "מרוויחות" : "Top Gainers",
          originalName: "Top Gainers",
          symbols: [
            { name: "TASE:LUMI", displayName: isHe ? "לאומי" : "Leumi" },
            { name: "TASE:POLI", displayName: isHe ? "פועלים" : "Poalim" },
            { name: "TASE:TEVA", displayName: isHe ? "טבע" : "Teva" },
            { name: "TASE:ICL", displayName: "ICL" },
            { name: "TASE:ESLT", displayName: isHe ? "אלביט" : "Elbit" },
          ],
        },
        {
          name: isHe ? "מפסידות" : "Top Losers",
          originalName: "Top Losers",
          symbols: [
            { name: "TASE:NICE", displayName: "Nice" },
            { name: "TASE:BEZQ", displayName: isHe ? "בזק" : "Bezeq" },
            { name: "TASE:AZRG", displayName: isHe ? "עזריאלי" : "Azrieli" },
            { name: "TASE:DSCT", displayName: isHe ? "דיסקונט" : "Discount" },
            { name: "TASE:MZTF", displayName: isHe ? "מזרחי" : "Mizrahi" },
          ],
        },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      colorTheme: "dark",
      locale: isHe ? "he_IL" : "en",
    });

    containerRef.current.appendChild(script);
  }, [lang]);

  const legend = isRtl ? LEGEND_HE : LEGEND_EN;

  return (
    <div className="w-full max-w-[800px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-border/40 bg-card/40 backdrop-blur-md shadow-xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-6 pt-5 pb-3">
          <BarChart3 className="h-5 w-5 text-primary" />
          <h2 className="font-display text-lg font-semibold tracking-tight">
            {isRtl ? "מבט מהיר על הבורסה" : "TASE Market Overview"}
          </h2>
        </div>

        {/* Widget */}
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: 420, width: "100%" }}
        >
          <div
            className="tradingview-widget-container__widget"
            style={{ height: "100%", width: "100%" }}
          />
        </div>

        {/* Legend */}
        <div className="px-6 py-3.5 border-t border-border/30">
          <div className="flex flex-wrap gap-x-5 gap-y-1">
            {legend.map((l) => (
              <span key={l.index} className="text-[11px] text-muted-foreground/70">
                <span className="font-semibold text-foreground/60">{l.index}</span>
                {" — "}
                {l.desc}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
