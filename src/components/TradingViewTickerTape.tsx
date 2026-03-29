import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";

export default function TradingViewTickerTape() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { lang } = useLanguage();

  useEffect(() => {
    if (!containerRef.current) return;
    containerRef.current.innerHTML = "";

    const isHe = lang === "he";

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js";
    script.type = "text/javascript";
    script.async = true;
    script.innerHTML = JSON.stringify({
      symbols: [
        { proName: "TASE:TA35", title: isHe ? 'ת"א 35' : "TA-35" },
        { proName: "TASE:TA125", title: isHe ? 'ת"א 125' : "TA-125" },
        { proName: "TASE:LUMI", title: isHe ? "לאומי" : "Leumi" },
        { proName: "TASE:POLI", title: isHe ? "פועלים" : "Poalim" },
        { proName: "TASE:TEVA", title: isHe ? "טבע" : "Teva" },
        { proName: "TASE:ESLT", title: isHe ? "אלביט" : "Elbit" },
        { proName: "TASE:NXSN", title: isHe ? "נקסט ויז'ן" : "Next Vision" },
      ],
      showSymbolLogo: true,
      isTransparent: true,
      displayMode: "adaptive",
      colorTheme: "dark",
      locale: isHe ? "he_IL" : "en",
    });

    containerRef.current.appendChild(script);
  }, [lang]);

  return (
    <div className="w-full border-b border-border/20">
      <div ref={containerRef} className="tradingview-widget-container">
        <div className="tradingview-widget-container__widget" />
      </div>
    </div>
  );
}
