import { useState, useMemo } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export interface DetailedBalanceSheetRow {
  year: string;
  // Current Assets
  totalCurrentAssets: number;
  cash: number;
  shortTermInvestments: number;
  netReceivables: number;
  inventory: number;
  otherCurrentAssets: number;
  // Non-Current Assets
  nonCurrentAssetsTotal: number;
  propertyPlantEquipment: number;
  longTermInvestments: number;
  goodwill: number;
  intangibleAssets: number;
  otherNonCurrentAssets: number;
  // Total Assets
  totalAssets: number;
  // Current Liabilities
  totalCurrentLiabilities: number;
  accountsPayable: number;
  shortTermDebt: number;
  otherCurrentLiabilities: number;
  // Non-Current Liabilities
  nonCurrentLiabilitiesTotal: number;
  longTermDebt: number;
  otherNonCurrentLiabilities: number;
  // Total Liabilities
  totalLiabilities: number;
  // Equity
  totalEquity: number;
  minorityInterest: number;
  commonStock: number;
  retainedEarnings: number;
  otherEquity: number;
}

interface HierarchyNode {
  labelKey: string;
  field: keyof DetailedBalanceSheetRow;
  children?: {
    labelKey: string;
    field: keyof DetailedBalanceSheetRow;
  }[];
}

const BALANCE_HIERARCHY: HierarchyNode[] = [
  {
    labelKey: "deepdive.totalAssets", field: "totalAssets",
    children: [
      {
        labelKey: "deepdive.totalCurrentAssets", field: "totalCurrentAssets",
      },
      { labelKey: "deepdive.cash", field: "cash" },
      { labelKey: "deepdive.shortTermInvestments", field: "shortTermInvestments" },
      { labelKey: "deepdive.netReceivables", field: "netReceivables" },
      { labelKey: "deepdive.inventory", field: "inventory" },
      { labelKey: "deepdive.otherCurrentAssets", field: "otherCurrentAssets" },
      {
        labelKey: "deepdive.nonCurrentAssets", field: "nonCurrentAssetsTotal",
      },
      { labelKey: "deepdive.ppe", field: "propertyPlantEquipment" },
      { labelKey: "deepdive.longTermInvestments", field: "longTermInvestments" },
      { labelKey: "deepdive.goodwill", field: "goodwill" },
      { labelKey: "deepdive.intangibleAssets", field: "intangibleAssets" },
      { labelKey: "deepdive.otherNonCurrentAssets", field: "otherNonCurrentAssets" },
    ],
  },
  {
    labelKey: "deepdive.totalLiabilities", field: "totalLiabilities",
    children: [
      { labelKey: "deepdive.totalCurrentLiabilities", field: "totalCurrentLiabilities" },
      { labelKey: "deepdive.accountsPayable", field: "accountsPayable" },
      { labelKey: "deepdive.shortTermDebt", field: "shortTermDebt" },
      { labelKey: "deepdive.otherCurrentLiabilities", field: "otherCurrentLiabilities" },
      { labelKey: "deepdive.nonCurrentLiabilities", field: "nonCurrentLiabilitiesTotal" },
      { labelKey: "deepdive.longTermDebt", field: "longTermDebt" },
      { labelKey: "deepdive.otherNonCurrentLiabilities", field: "otherNonCurrentLiabilities" },
    ],
  },
  {
    labelKey: "deepdive.totalEquity", field: "totalEquity",
    children: [
      { labelKey: "deepdive.commonStock", field: "commonStock" },
      { labelKey: "deepdive.retainedEarnings", field: "retainedEarnings" },
      { labelKey: "deepdive.otherEquity", field: "otherEquity" },
    ],
  },
];

// Parent-child groups for checksum verification
const CHECKSUM_GROUPS: { parent: keyof DetailedBalanceSheetRow; children: (keyof DetailedBalanceSheetRow)[] }[] = [
  { parent: "totalCurrentAssets", children: ["cash", "shortTermInvestments", "netReceivables", "inventory", "otherCurrentAssets"] },
  { parent: "nonCurrentAssetsTotal", children: ["propertyPlantEquipment", "longTermInvestments", "goodwill", "intangibleAssets", "otherNonCurrentAssets"] },
  { parent: "totalAssets", children: ["totalCurrentAssets", "nonCurrentAssetsTotal"] },
  { parent: "totalCurrentLiabilities", children: ["accountsPayable", "shortTermDebt", "otherCurrentLiabilities"] },
  { parent: "nonCurrentLiabilitiesTotal", children: ["longTermDebt", "otherNonCurrentLiabilities"] },
  { parent: "totalLiabilities", children: ["totalCurrentLiabilities", "nonCurrentLiabilitiesTotal"] },
  { parent: "totalEquity", children: ["commonStock", "retainedEarnings", "otherEquity"] },
];

function formatNum(value: number): string {
  if (value === 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(0);
}

function formatPct(value: number): string {
  if (!isFinite(value) || isNaN(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function verifyChecksum(row: DetailedBalanceSheetRow, parent: keyof DetailedBalanceSheetRow, children: (keyof DetailedBalanceSheetRow)[]): "verified" | "mismatch" | "unavailable" {
  const parentVal = row[parent] as number;
  if (!parentVal) return "unavailable";
  const childSum = children.reduce((s, c) => s + ((row[c] as number) || 0), 0);
  if (childSum === 0 && children.every(c => !(row[c] as number))) return "unavailable";
  const tolerance = Math.abs(parentVal) * 0.02; // 2% tolerance
  return Math.abs(parentVal - childSum) <= tolerance ? "verified" : "mismatch";
}

interface DeepDiveFinancialsProps {
  data: DetailedBalanceSheetRow[];
  loading?: boolean;
}

export default function DeepDiveFinancials({ data, loading }: DeepDiveFinancialsProps) {
  const { t } = useLanguage();
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // Debug: log data to verify it arrives
  

  const years = useMemo(() => {
    if (!data.length) return [];
    return [...data].sort((a, b) => a.year.localeCompare(b.year)).map(r => r.year);
  }, [data]);

  const byYear = useMemo(() => {
    const m: Record<string, DetailedBalanceSheetRow> = {};
    data.forEach(r => (m[r.year] = r));
    return m;
  }, [data]);

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-6">
        <div className="animate-pulse space-y-3">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-7 rounded bg-secondary/50" />
          ))}
        </div>
      </div>
    );
  }

  if (!data.length) {
    return (
      <div className="rounded-xl border border-border/50 bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const toggleExpand = (key: string) => {
    setExpanded(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Check if children have any data for a given parent
  const hasChildData = (children: { field: keyof DetailedBalanceSheetRow }[]) => {
    return children.some(child =>
      years.some(y => {
        const val = byYear[y]?.[child.field] as number;
        return val !== 0 && val != null;
      })
    );
  };

  return (
    <TooltipProvider>
      <div className="space-y-3">
        <h2 className="font-display text-xl font-semibold">{t("deepdive.title")}</h2>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/50">
                  <th className="text-start py-3 px-4 font-display text-muted-foreground font-medium min-w-[220px]">
                    {t("fin.metric")}
                  </th>
                  {years.map(y => (
                    <th key={y} className="text-end py-3 px-3 font-display text-muted-foreground font-medium min-w-[100px]">
                      {y}
                    </th>
                  ))}
                  <th className="text-end py-3 px-3 font-display text-muted-foreground font-medium min-w-[80px]">
                    {t("deepdive.commonSize")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {BALANCE_HIERARCHY.map((node, nodeIdx) => {
                  const isExpanded = expanded[node.field] ?? false;
                  const canExpand = node.children && hasChildData(node.children);

                  // Find matching checksum group for this parent
                  const checksumResult = node.children
                    ? (() => {
                        // Use latest year for checksum
                        const latestYear = years[years.length - 1];
                        const latestRow = byYear[latestYear];
                        if (!latestRow) return null;
                        const group = CHECKSUM_GROUPS.find(g => g.parent === node.field);
                        if (!group) return null;
                        return verifyChecksum(latestRow, group.parent, group.children);
                      })()
                    : null;

                  return (
                    <RowGroup key={node.field}>
                      {/* Parent row */}
                      <tr
                        className={cn(
                          "border-b border-border/30 transition-colors",
                          "bg-secondary/20 hover:bg-secondary/40",
                          canExpand && "cursor-pointer"
                        )}
                        onClick={() => canExpand && toggleExpand(node.field)}
                      >
                         <td className="py-2.5 px-4 font-display font-semibold">
                          <div className="flex items-center gap-2" dir="rtl">
                            <span>{t(node.labelKey)}</span>
                            {canExpand ? (
                              <ChevronRight
                                className={cn(
                                  "h-5 w-5 shrink-0 text-primary transition-transform duration-200",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            ) : (
                              <span className="w-5" />
                            )}
                            {checksumResult && checksumResult !== "unavailable" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span>
                                    {checksumResult === "verified" ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-gain" />
                                    ) : (
                                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {checksumResult === "verified"
                                    ? t("deepdive.verified")
                                    : t("deepdive.checksumMismatch")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        {years.map(y => (
                          <td key={y} className="text-end py-2.5 px-3 font-mono font-semibold">
                            {formatNum((byYear[y]?.[node.field] as number) || 0)}
                          </td>
                        ))}
                        <td className="text-end py-2.5 px-3 font-mono text-muted-foreground">
                          100%
                        </td>
                      </tr>

                      {/* Child rows */}
                      {isExpanded && canExpand && node.children!.map((child, childIdx) => {
                        const latestYear = years[years.length - 1];
                        const parentVal = Math.abs((byYear[latestYear]?.[node.field] as number) || 1);
                        const childVal = (byYear[latestYear]?.[child.field] as number) || 0;
                        const commonSize = parentVal ? (childVal / parentVal) * 100 : 0;

                        const allZero = years.every(y => !((byYear[y]?.[child.field] as number) || 0));

                        return (
                          <tr
                            key={child.field}
                            className={cn(
                              "border-b border-border/20 transition-colors",
                              childIdx % 2 === 0 ? "bg-muted/10" : "bg-transparent",
                              "hover:bg-muted/30"
                            )}
                          >
                            <td className="py-2 px-4 pe-10 text-muted-foreground font-display" dir="rtl">
                              {allZero ? (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <span className="opacity-50">{t(child.labelKey)}</span>
                                  </TooltipTrigger>
                                  <TooltipContent>{t("deepdive.unavailable")}</TooltipContent>
                                </Tooltip>
                              ) : (
                                t(child.labelKey)
                              )}
                            </td>
                            {years.map(y => (
                              <td key={y} className="text-end py-2 px-3 font-mono text-muted-foreground">
                                {formatNum((byYear[y]?.[child.field] as number) || 0)}
                              </td>
                            ))}
                            <td className="text-end py-2 px-3 font-mono text-xs text-muted-foreground/70">
                              {allZero ? "—" : formatPct(commonSize)}
                            </td>
                          </tr>
                        );
                      })}
                    </RowGroup>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}

function RowGroup({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
