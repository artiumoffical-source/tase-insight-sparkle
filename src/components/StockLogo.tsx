import { useState } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

interface StockLogoProps {
  name: string;
  logoUrl?: string | null;
  /** Company domain for clearbit fallback (e.g. "bankleumi.co.il") */
  domain?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizeMap = {
  sm: "h-7 w-7 text-xs",
  md: "h-10 w-10 text-sm",
  lg: "h-14 w-14 text-lg",
};

// Generate a consistent color from a string
function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue}, 55%, 45%)`;
}

export default function StockLogo({ name, logoUrl, domain, size = "md", className }: StockLogoProps) {
  const [imgError, setImgError] = useState(false);
  const [clearbitError, setClearbitError] = useState(false);
  const initial = (name || "?").charAt(0).toUpperCase();
  const bgColor = hashColor(name || "X");

  const clearbitUrl = domain ? `https://logo.clearbit.com/${domain}` : null;
  const showPrimary = logoUrl && !imgError;
  const showClearbit = !showPrimary && clearbitUrl && !clearbitError;

  return (
    <Avatar className={cn(sizeMap[size], "shrink-0", className)}>
      {showPrimary && (
        <AvatarImage
          src={logoUrl!}
          alt={name}
          onError={() => setImgError(true)}
        />
      )}
      {showClearbit && (
        <AvatarImage
          src={clearbitUrl!}
          alt={name}
          onError={() => setClearbitError(true)}
        />
      )}
      <AvatarFallback
        style={{ backgroundColor: bgColor, color: "white" }}
        className="font-display font-bold"
      >
        {initial}
      </AvatarFallback>
    </Avatar>
  );
}
