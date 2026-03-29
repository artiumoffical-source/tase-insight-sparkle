import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3 } from "lucide-react";

const LEGEND_HE = [
  { index: "ת\"א 35", desc: "35 החברות הגדולות בבורסה" },
  { index: "ת\"א 125", desc: "125 החברות המובילות" },
  { index: "ת\"א 90", desc: "90 חברות ביניים" },
  { index: "ת\"א בנקים", desc: "מדד הבנקים" },
  { index: "ת\"א נדל\"ן", desc: "מדד הנדל\"ן" },
];

const LEGEND_EN = [
  { index: "TA-35", desc: "Top 35 companies on TASE" },
  { index: "TA-125", desc: "Top 125 companies" },
  { index: "TA-90", desc: "90 mid-cap companies" },
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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      colorTheme: "dark",
      dateRange: "1D",
      showChart: false,
      locale: isHe ? "he_IL" : "en",
      largeChartUrl: "",
      isTransparent: true,
      showSymbolLogo: true,
      showFloatingTooltip: false,
      width: "100%",
      height: 460,
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
          title: isHe ? "מדדים" : "Indices",
          symbols: [
            { s: "TASE:TA35", d: isHe ? "ת\"א 35" : "TA-35" },
            { s: "TASE:TA125", d: isHe ? "ת\"א 125" : "TA-125" },
            { s: "TASE:TA90", d: isHe ? "ת\"א 90" : "TA-90" },
            { s: "TASE:TABANK", d: isHe ? "ת\"א בנקים" : "TA-Banks" },
            { s: "TASE:TAREAL", d: isHe ? "ת\"א נדל\"ן" : "TA-Real Estate" },
          ],
        },
        {
          title: isHe ? "מרוויחות" : "Top Gainers",
          symbols: [
            { s: "TASE:LUMI", d: isHe ? "לאומי" : "Leumi" },
            { s: "TASE:POLI", d: isHe ? "פועלים" : "Poalim" },
            { s: "TASE:TEVA", d: isHe ? "טבע" : "Teva" },
            { s: "TASE:ICL", d: "ICL" },
            { s: "TASE:ESLT", d: isHe ? "אלביט" : "Elbit" },
          ],
        },
        {
          title: isHe ? "מפסידות" : "Top Losers",
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

  const legend = isRtl ? LEGEND_HE : LEGEND_EN;

  return (
    <div className="w-full max-w-5xl px-4" dir={isRtl ? "rtl" : "ltr"}>
      <Card className="border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden">
        <CardHeader className="pb-3 pt-5 px-6">
          <CardTitle className="flex items-center gap-2.5 font-display text-xl">
            <BarChart3 className="h-5 w-5 text-primary" />
            {isRtl ? "מבט מהיר על הבורסה" : "TASE Market Overview"}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-0 pb-0">
          <div
            ref={containerRef}
            className="tradingview-widget-container"
            style={{ height: 460, width: "100%" }}
          >
            <div
              className="tradingview-widget-container__widget"
              style={{ height: "100%", width: "100%" }}
            />
          </div>
        </CardContent>

        {/* Index Legend */}
        <div className="px-6 py-4 border-t border-border/40">
          <p className="text-xs font-medium text-muted-foreground mb-2.5">
            {isRtl ? "מקרא מדדים" : "Index Legend"}
          </p>
          <div className="flex flex-wrap gap-x-5 gap-y-1.5">
            {legend.map((l) => (
              <span key={l.index} className="text-xs text-muted-foreground/80">
                <span className="font-semibold text-foreground/70">{l.index}</span>
                {" — "}
                {l.desc}
              </span>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
