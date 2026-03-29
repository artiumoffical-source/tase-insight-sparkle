import { useLanguage } from "@/hooks/useLanguage";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Crown, Zap, BarChart3, ShieldOff } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface UpgradeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function UpgradeModal({ open, onOpenChange }: UpgradeModalProps) {
  const { t } = useLanguage();

  const features = [
    { icon: BarChart3, labelKey: "upgrade.feat1" },
    { icon: ShieldOff, labelKey: "upgrade.feat2" },
    { icon: Zap, labelKey: "upgrade.feat3" },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md border-primary/20">
        <DialogHeader className="text-center items-center gap-2">
          <div className="mx-auto rounded-full bg-primary/10 p-3 mb-2">
            <Crown className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="font-display text-2xl">
            {t("upgrade.title")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground max-w-xs mx-auto">
            {t("upgrade.subtitle")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-4">
          {features.map((f) => (
            <div key={f.labelKey} className="flex items-center gap-3 rounded-lg bg-secondary/40 p-3">
              <f.icon className="h-5 w-5 text-primary shrink-0" />
              <span className="text-sm font-medium">{t(f.labelKey)}</span>
            </div>
          ))}
        </div>

        <Button
          size="lg"
          className="w-full font-display text-base"
          onClick={() => {
            onOpenChange(false);
            window.location.href = "/auth";
          }}
        >
          {t("upgrade.signUpLogin")}
        </Button>

        <p className="text-center text-[11px] text-muted-foreground mt-1">
          {t("upgrade.cancel")}
        </p>
      </DialogContent>
    </Dialog>
  );
}
