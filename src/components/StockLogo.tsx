import { useState } from "react";
import { cn } from "@/lib/utils";

interface StockLogoProps {
  name: string;
  logoUrl?: string | null;
  domain?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: { container: "h-7 w-7", text: "text-[9px]", imgPad: "p-[3px]" },
  md: { container: "h-10 w-10", text: "text-xs", imgPad: "p-1" },
  lg: { container: "h-14 w-14", text: "text-base", imgPad: "p-1.5" },
};

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 50%, 40%)`;
}

export default function StockLogo({ name, logoUrl, domain, size = "md", className }: StockLogoProps) {
  const [primaryErr, setPrimaryErr] = useState(false);
  const [clearbitErr, setClearbitErr] = useState(false);

  const s = sizeMap[size];
  const initial = (name || "?").charAt(0).toUpperCase();
  const bgColor = hashColor(name || "X");

  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const activeSrc = logoUrl && !primaryErr
    ? logoUrl
    : clearbitUrl && !clearbitErr
    ? clearbitUrl
    : null;

  return (
    <div
      className={cn(
        s.container,
        "rounded-full shrink-0 overflow-hidden flex items-center justify-center",
        "ring-1 ring-border/20 shadow-sm",
        className
      )}
      style={activeSrc ? { backgroundColor: "hsl(0 0% 96%)" } : { backgroundColor: bgColor }}
    >
      {activeSrc ? (
        <img
          src={activeSrc}
          alt={name}
          className={cn("object-contain rounded-full", s.imgPad, "h-full w-full")}
          onError={() => {
            if (logoUrl && !primaryErr) setPrimaryErr(true);
            else setClearbitErr(true);
          }}
          loading="lazy"
        />
      ) : (
        <span className={cn(s.text, "font-display font-bold text-white select-none")}>
          {initial}
        </span>
      )}
    </div>
  );
}
