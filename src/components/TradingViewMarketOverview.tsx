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
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      width: "100%",
      height: 450,
      symbolsGroups: [
        {
          name: isHe ? "מדדים" : "Indices",
          originalName: "Indices",
          symbols: [
            { name: "TASE:TA35", displayName: isHe ? 'מדד ת"א 35' : "TA-35" },
            { name: "TASE:TA125", displayName: isHe ? 'מדד ת"א 125' : "TA-125" },
            { name: "TASE:TABANK", displayName: isHe ? 'ת"א בנקים' : "TA-Banks" },
          ],
        },
        {
          name: isHe ? "העולות" : "Top Gainers",
          originalName: "Top Gainers",
          symbols: [
            { name: "TASE:LUMI", displayName: isHe ? "בנק לאומי" : "Bank Leumi" },
            { name: "TASE:POLI", displayName: isHe ? "בנק הפועלים" : "Bank Hapoalim" },
            { name: "TASE:TEVA", displayName: isHe ? "טבע תעשיות" : "Teva Pharma" },
            { name: "TASE:ICL", displayName: isHe ? "כיל" : "ICL Group" },
            { name: "TASE:ESLT", displayName: isHe ? "אלביט מערכות" : "Elbit Systems" },
          ],
        },
        {
          name: isHe ? "היורדות" : "Top Losers",
          originalName: "Top Losers",
          symbols: [
            { name: "TASE:NICE", displayName: isHe ? "נייס מערכות" : "NICE Systems" },
            { name: "TASE:BEZQ", displayName: isHe ? "בזק" : "Bezeq" },
            { name: "TASE:AZRG", displayName: isHe ? "קבוצת עזריאלי" : "Azrieli Group" },
            { name: "TASE:DSCT", displayName: isHe ? "בנק דיסקונט" : "Bank Discount" },
            { name: "TASE:MZTF", displayName: isHe ? "מזרחי טפחות" : "Mizrahi Tefahot" },
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

  return (
    <div className="w-full max-w-[700px] px-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-xl border border-border/30 bg-card/20 backdrop-blur-md shadow-lg overflow-hidden">
        <div className="flex items-center gap-2 px-5 pt-4 pb-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <h2 className="font-display text-sm font-semibold text-foreground/90">
            {isRtl ? "סקירת שוק" : "Market Overview"}
          </h2>
        </div>
        <div
          ref={containerRef}
          className="tradingview-widget-container"
          style={{ height: 450, width: "100%" }}
        >
          <div className="tradingview-widget-container__widget" style={{ height: "100%", width: "100%" }} />
        </div>
      </div>
    </div>
  );
}
