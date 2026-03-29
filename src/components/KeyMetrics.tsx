import { useLanguage } from "@/hooks/useLanguage";
import { Lock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { SectorType } from "@/components/FinancialsTable";

export interface KeyMetricsData {
  peRatio: number | null;
  psRatio: number | null;
  pbRatio: number | null;
  roe: number | null;
  roa: number | null;
  revenueGrowth5Y: number | null;
  revenueGrowth10Y: number | null;
  netIncomeMargin5Y: number | null;
  netIncomeMargin10Y: number | null;
}

interface MetricItem {
  key: keyof KeyMetricsData;
  labelKey: string;
  isPercent: boolean;
}

interface KeyMetricsProps {
  data: KeyMetricsData | null;
  isPremium: boolean;
  onUpgrade: () => void;
  loading?: boolean;
  sector?: SectorType;
}

function formatValue(val: number | null, isPercent: boolean): string {
  if (val === null || val === undefined || isNaN(val)) return "—";
  return isPercent ? `${val.toFixed(2)}%` : val.toFixed(2);
}

function getMetricsForSector(sector: SectorType): MetricItem[] {
  switch (sector) {
    case "bank":
      return [
        { key: "pbRatio", labelKey: "metrics.pb", isPercent: false },
        { key: "roe", labelKey: "metrics.roe", isPercent: true },
        { key: "peRatio", labelKey: "metrics.pe", isPercent: false },
        { key: "roa", labelKey: "metrics.roa", isPercent: true },
        { key: "netIncomeMargin5Y", labelKey: "metrics.niMargin5Y", isPercent: true },
        { key: "revenueGrowth5Y", labelKey: "metrics.revGrowth5Y", isPercent: true },
      ];
    case "insurance":
      return [
        { key: "peRatio", labelKey: "metrics.pe", isPercent: false },
        { key: "roe", labelKey: "metrics.roe", isPercent: true },
        { key: "pbRatio", labelKey: "metrics.pb", isPercent: false },
        { key: "roa", labelKey: "metrics.roa", isPercent: true },
        { key: "netIncomeMargin5Y", labelKey: "metrics.niMargin5Y", isPercent: true },
        { key: "revenueGrowth5Y", labelKey: "metrics.revGrowth5Y", isPercent: true },
      ];
    case "tech":
      return [
        { key: "psRatio", labelKey: "metrics.ps", isPercent: false },
        { key: "revenueGrowth5Y", labelKey: "metrics.revGrowth5Y", isPercent: true },
        { key: "peRatio", labelKey: "metrics.pe", isPercent: false },
        { key: "roe", labelKey: "metrics.roe", isPercent: true },
        { key: "netIncomeMargin5Y", labelKey: "metrics.niMargin5Y", isPercent: true },
        { key: "revenueGrowth10Y", labelKey: "metrics.revGrowth10Y", isPercent: true },
      ];
    default:
      return [
        { key: "peRatio", labelKey: "metrics.pe", isPercent: false },
        { key: "psRatio", labelKey: "metrics.ps", isPercent: false },
        { key: "pbRatio", labelKey: "metrics.pb", isPercent: false },
        { key: "roe", labelKey: "metrics.roe", isPercent: true },
        { key: "roa", labelKey: "metrics.roa", isPercent: true },
        { key: "revenueGrowth5Y", labelKey: "metrics.revGrowth5Y", isPercent: true },
        { key: "revenueGrowth10Y", labelKey: "metrics.revGrowth10Y", isPercent: true },
        { key: "netIncomeMargin5Y", labelKey: "metrics.niMargin5Y", isPercent: true },
        { key: "netIncomeMargin10Y", labelKey: "metrics.niMargin10Y", isPercent: true },
      ];
  }
}

export default function KeyMetrics({ data, isPremium, onUpgrade, loading, sector = "general" }: KeyMetricsProps) {
  const { t } = useLanguage();
  const metrics = getMetricsForSector(sector);

  if (loading) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[...Array(6)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-4">
              <div className="animate-pulse space-y-2">
                <div className="h-3 w-20 rounded bg-secondary" />
                <div className="h-6 w-16 rounded bg-secondary" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <h2 className="font-display text-xl font-semibold">{t("metrics.title")}</h2>

      {!isPremium ? (
        <div className="relative rounded-xl border bg-card p-6 cursor-pointer" onClick={onUpgrade}>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 blur-sm select-none pointer-events-none">
            {metrics.slice(0, 8).map((m) => (
              <Card key={m.key} className="border-0 shadow-none bg-secondary/30">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t(m.labelKey)}</p>
                  <p className="font-display text-xl font-bold mt-1">12.34</p>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-card/60 rounded-xl">
            <Lock className="h-6 w-6 text-muted-foreground" />
            <p className="font-medium text-sm text-muted-foreground">{t("metrics.upgrade")}</p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {metrics.map((m) => {
            const val = data?.[m.key] ?? null;
            return (
              <Card key={m.key} className="border bg-card">
                <CardContent className="p-4">
                  <p className="text-xs text-muted-foreground">{t(m.labelKey)}</p>
                  <p className="font-display text-xl font-bold mt-1">
                    {formatValue(val, m.isPercent)}
                  </p>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
