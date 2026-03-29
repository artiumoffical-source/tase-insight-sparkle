import { useLanguage } from "@/hooks/useLanguage";
import { useAuth } from "@/hooks/useAuth";

interface AdSlotProps {
  placement: "leaderboard" | "banner" | "sidebar";
  className?: string;
}

export default function AdSlot({ placement, className = "" }: AdSlotProps) {
  const { t } = useLanguage();
  const { user } = useAuth();

  // Hide ads for logged-in (premium) users
  if (user) return null;

  const sizeClasses: Record<string, string> = {
    leaderboard: "h-[90px] max-w-[728px] mx-auto w-full",
    banner: "h-[90px] w-full",
    sidebar: "w-full h-[600px]",
  };

  return (
    <div
      className={`rounded-lg border border-dashed border-border/50 bg-secondary/20 flex flex-col items-center justify-center gap-1 text-muted-foreground/60 ${sizeClasses[placement]} ${className}`}
    >
      <span className="text-xs font-medium tracking-wide uppercase">{t("ad.space")}</span>
      <span className="text-[10px]">{t("ad.upgrade")}</span>
    </div>
  );
}
