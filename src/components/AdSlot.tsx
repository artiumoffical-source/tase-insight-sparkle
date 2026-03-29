import { useEffect, useRef } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";

interface AdSlotProps {
  placement: "leaderboard" | "banner" | "sidebar";
  className?: string;
}

export default function AdSlot({ placement, className = "" }: AdSlotProps) {
  const { t } = useLanguage();
  const { user } = useAuth();
  const adRef = useRef<HTMLDivElement>(null);

  const isPremium = user?.email === "artiumoffical@gmail.com";

  const adFormats: Record<string, { style: React.CSSProperties; containerClass: string }> = {
    leaderboard: {
      style: { display: "block", width: "100%", height: "90px", maxWidth: "728px" },
      containerClass: "h-[90px] max-w-[728px] mx-auto w-full",
    },
    banner: {
      style: { display: "block", width: "100%", height: "90px" },
      containerClass: "h-[90px] w-full",
    },
    sidebar: {
      style: { display: "block", width: "100%", height: "600px" },
      containerClass: "w-full h-[600px]",
    },
  };

  useEffect(() => {
    if (isPremium) return;
    try {
      ((window as any).adsbygoogle = (window as any).adsbygoogle || []).push({});
    } catch {
      // AdSense not loaded yet
    }
  }, [isPremium]);

  if (isPremium) return null;

  const { style, containerClass } = adFormats[placement];

  return (
    <div className={`${containerClass} ${className}`} ref={adRef}>
      <ins
        className="adsbygoogle"
        style={style}
        data-ad-client="ca-pub-7502989047307633"
        data-ad-format="auto"
        data-full-width-responsive="true"
      />
    </div>
  );
}
