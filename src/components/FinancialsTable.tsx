import { useState, useMemo, useCallback } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, CheckCircle2, AlertCircle, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import type { DetailedBalanceSheetRow } from "@/components/DeepDiveFinancials";

// Shared types
export type SectorType = "bank" | "insurance" | "tech" | "general";

export interface FinancialData {
  year: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  debtToEquity: number;
  cashAndEquiv: number;
}

export interface IncomeStatementRow {
  year: string;
  revenue: number;
  costOfRevenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  ebitda: number;
  eps: number;
  researchDevelopment?: number;
  interestIncome?: number;
  nonInterestIncome?: number;
  netPremiumsEarned?: number;
}

export interface BalanceSheetRow {
  year: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cash: number;
  totalDebt: number;
  inventory: number;
  totalDeposits?: number;
  totalInvestments?: number;
}

export interface CashFlowRow {
  year: string;
  netIncome: number;
  depreciation: number;
  capex: number;
  freeCashFlow: number;
  cashFromOperations: number;
}

interface FinancialsTableProps {
  data: FinancialData[];
  incomeStatement?: IncomeStatementRow[];
  balanceSheet?: BalanceSheetRow[];
  cashFlow?: CashFlowRow[];
  detailedBalanceSheet?: DetailedBalanceSheetRow[];
  loading?: boolean;
  sector?: SectorType;
  currency?: string;
}

interface MetricDef {
  labelKey: string;
  getValue: (row: any) => number;
  colored?: boolean;
  isRatio?: boolean;
  isEps?: boolean;
  invertColor?: boolean; // For debt metrics: increase = red
}

// --- Expandable balance sheet config ---
interface ExpandableRow {
  labelKey: string;
  field: keyof DetailedBalanceSheetRow;
  colored?: boolean;
  invertColor?: boolean;
  children?: { labelKey: string; field: keyof DetailedBalanceSheetRow; invertColor?: boolean }[];
  checksumChildren?: (keyof DetailedBalanceSheetRow)[];
}

const EXPANDABLE_BALANCE: ExpandableRow[] = [
  {
    labelKey: "fin.totalAssets", field: "totalAssets",
    children: [
      { labelKey: "deepdive.totalCurrentAssets", field: "totalCurrentAssets" },
      { labelKey: "deepdive.cash", field: "cash" },
      { labelKey: "deepdive.shortTermInvestments", field: "shortTermInvestments" },
      { labelKey: "deepdive.netReceivables", field: "netReceivables" },
      { labelKey: "deepdive.inventory", field: "inventory" },
      { labelKey: "deepdive.otherCurrentAssets", field: "otherCurrentAssets" },
      { labelKey: "deepdive.nonCurrentAssets", field: "nonCurrentAssetsTotal" },
      { labelKey: "deepdive.ppe", field: "propertyPlantEquipment" },
      { labelKey: "deepdive.longTermInvestments", field: "longTermInvestments" },
      { labelKey: "deepdive.goodwill", field: "goodwill" },
      { labelKey: "deepdive.intangibleAssets", field: "intangibleAssets" },
      { labelKey: "deepdive.otherNonCurrentAssets", field: "otherNonCurrentAssets" },
    ],
    checksumChildren: ["totalCurrentAssets", "nonCurrentAssetsTotal"],
  },
  {
    labelKey: "fin.totalLiabilities", field: "totalLiabilities", invertColor: true,
    children: [
      { labelKey: "deepdive.totalCurrentLiabilities", field: "totalCurrentLiabilities", invertColor: true },
      { labelKey: "deepdive.accountsPayable", field: "accountsPayable", invertColor: true },
      { labelKey: "deepdive.shortTermDebt", field: "shortTermDebt", invertColor: true },
      { labelKey: "deepdive.otherCurrentLiabilities", field: "otherCurrentLiabilities", invertColor: true },
      { labelKey: "deepdive.nonCurrentLiabilities", field: "nonCurrentLiabilitiesTotal", invertColor: true },
      { labelKey: "deepdive.longTermDebt", field: "longTermDebt", invertColor: true },
      { labelKey: "deepdive.otherNonCurrentLiabilities", field: "otherNonCurrentLiabilities", invertColor: true },
    ],
    checksumChildren: ["totalCurrentLiabilities", "nonCurrentLiabilitiesTotal"],
  },
  {
    labelKey: "fin.totalEquity", field: "totalEquity",
    children: [
      { labelKey: "deepdive.commonStock", field: "commonStock" },
      { labelKey: "deepdive.retainedEarnings", field: "retainedEarnings" },
      { labelKey: "deepdive.otherEquity", field: "otherEquity" },
      { labelKey: "deepdive.minorityInterest", field: "minorityInterest" },
    ],
    checksumChildren: ["commonStock", "retainedEarnings", "otherEquity", "minorityInterest"],
  },
  { labelKey: "fin.cashBs", field: "cash" },
  { labelKey: "fin.totalDebt", field: "longTermDebt", invertColor: true },
];

const CURRENCY_SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", ILS: "₪", GBP: "£", ILA: "₪" };

function formatNum(value: number, currencyCode?: string): string {
  if (value === 0) return "—";
  const prefix = currencyCode ? (CURRENCY_SYMBOLS[currencyCode] || "") : "";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${prefix}${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${prefix}${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${prefix}${(value / 1e3).toFixed(1)}K`;
  return `${prefix}${value.toFixed(2)}`;
}

function formatYoY(current: number, previous: number): { text: string; color: string } | null {
  if (!previous || previous === 0 || !current) return null;
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!isFinite(pct) || isNaN(pct)) return null;
  return { text: `${pct.toFixed(1)}%`, color: pct >= 0 ? "gain" : "loss" };
}

function getYoYColor(current: number, previous: number, invertColor?: boolean): string {
  if (!previous || previous === 0 || !current) return "";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!isFinite(pct) || isNaN(pct)) return "";
  const isPositive = pct >= 0;
  if (invertColor) return isPositive ? "text-loss" : "text-gain";
  return isPositive ? "text-gain" : "text-loss";
}

function formatYoYText(current: number, previous: number): string {
  if (!previous || previous === 0 || !current) return "—";
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  if (!isFinite(pct) || isNaN(pct)) return "—";
  return `${pct.toFixed(1)}%`;
}

// --- Mini Sparkline SVG ---
function Sparkline({ values, invertColor }: { values: number[]; invertColor?: boolean }) {
  const filtered = values.filter(v => v !== 0 && v != null);
  if (filtered.length < 2) return null;
  const min = Math.min(...filtered);
  const max = Math.max(...filtered);
  const range = max - min || 1;
  const w = 48, h = 16;
  const points = filtered.map((v, i) => {
    const x = (i / (filtered.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 2) - 1;
    return `${x},${y}`;
  }).join(" ");

  const trend = filtered[filtered.length - 1] - filtered[0];
  const isUp = trend >= 0;
  const color = invertColor ? (isUp ? "hsl(var(--loss))" : "hsl(var(--gain))") : (isUp ? "hsl(var(--gain))" : "hsl(var(--loss))");

  return (
    <svg width={w} height={h} className="inline-block ms-2 opacity-70 shrink-0">
      <polyline fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" points={points} />
    </svg>
  );
}

function verifyChecksum(row: DetailedBalanceSheetRow, parent: keyof DetailedBalanceSheetRow, children: (keyof DetailedBalanceSheetRow)[]): "verified" | "mismatch" | "unavailable" {
  const parentVal = row[parent] as number;
  if (!parentVal) return "unavailable";
  const childSum = children.reduce((s, c) => s + ((row[c] as number) || 0), 0);
  if (childSum === 0 && children.every(c => !(row[c] as number))) return "unavailable";
  const tolerance = Math.abs(parentVal) * 0.02;
  return Math.abs(parentVal - childSum) <= tolerance ? "verified" : "mismatch";
}

// --- Export to CSV (universal Excel-compatible) ---
function exportToCSV(headers: string[], rows: string[][], filename: string) {
  const BOM = "\uFEFF";
  const csv = BOM + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// --- Simple MetricTable for Income & Cash Flow ---
function SimpleMetricTable({ rows, metrics, t, tabName, currency }: { rows: any[]; metrics: MetricDef[]; t: (k: string) => string; tabName?: string; currency?: string }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.year.localeCompare(b.year));
  const years = sortedRows.map((r) => r.year);
  const byYear: Record<string, any> = {};
  rows.forEach((r) => (byYear[r.year] = r));

  const displayYears = years.map(y => y.replace(/-\d{2}$/, ""));

  const handleExport = () => {
    const headers = [t("fin.metric"), ...displayYears];
    const csvRows = metrics.map(m => {
      const vals = years.map(y => {
        const val = m.getValue(byYear[y]) ?? 0;
        return m.isEps ? val.toFixed(2) : m.isRatio ? val.toFixed(2) : String(val);
      });
      return [`"${t(m.labelKey)}"`, ...vals];
    });
    exportToCSV(headers, csvRows, `${tabName || "financials"}.csv`);
  };

  return (
    <div className="space-y-2">
      <div className="flex justify-end">
        <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={handleExport}>
          <Download className="h-3.5 w-3.5" />
          {t("fin.exportExcel")}
        </Button>
      </div>
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="border-b-border hover:bg-transparent">
                <TableHead className="font-display text-muted-foreground min-w-[220px]">{t("fin.metric")}</TableHead>
                {displayYears.map((y, i) => (
                  <TableHead key={years[i]} className="font-display text-muted-foreground text-end min-w-[90px]">{y}</TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {metrics.map((m, idx) => {
                const allValues = years.map(y => m.getValue(byYear[y]) ?? 0);

                return (
                  <TableRow key={m.labelKey} className={`border-b-border ${idx % 2 === 0 ? "bg-muted/30" : ""}`}>
                    <TableCell className="font-display font-semibold">
                      <div className="flex items-center">
                        <span>{t(m.labelKey)}</span>
                        <Sparkline values={allValues} invertColor={m.invertColor} />
                      </div>
                    </TableCell>
                    {years.map((y) => {
                      const val = m.getValue(byYear[y]) ?? 0;
                      const colorClass = m.colored ? (val >= 0 ? "text-gain" : "text-loss") : "";
                      return (
                        <TableCell key={y} className={`text-end font-mono ${colorClass}`}>
                          {m.isEps ? val.toFixed(2) : m.isRatio ? val.toFixed(2) : formatNum(val, currency)}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}

// --- Expandable Balance Sheet Table ---
function ExpandableBalanceTable({ rows, t, detailedBS, currency }: { rows: DetailedBalanceSheetRow[]; t: (k: string) => string; detailedBS?: DetailedBalanceSheetRow[]; currency?: string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [hoveredParent, setHoveredParent] = useState<string | null>(null);

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const sortedRows = [...rows].sort((a, b) => a.year.localeCompare(b.year));
  const years = sortedRows.map(r => r.year);
  const byYear: Record<string, DetailedBalanceSheetRow> = {};
  rows.forEach(r => (byYear[r.year] = r));

  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const childHasData = (field: keyof DetailedBalanceSheetRow) =>
    years.some(y => {
      const val = byYear[y]?.[field] as number;
      return val !== 0 && val != null;
    });

  const hasChildData = (children: { field: keyof DetailedBalanceSheetRow }[]) =>
    children.some(child => childHasData(child.field));

  // Solvency ratios
  const solvencyRatios = years.map(y => {
    const row = byYear[y];
    if (!row) return { year: y, currentRatio: 0, debtToEquity: 0, quickRatio: 0 };
    const currentAssets = (row.totalCurrentAssets as number) || 0;
    const currentLiab = (row.totalCurrentLiabilities as number) || 0;
    const totalDebt = ((row.longTermDebt as number) || 0) + ((row.shortTermDebt as number) || 0);
    const equity = (row.totalEquity as number) || 0;
    const inventory = (row.inventory as number) || 0;
    return {
      year: y,
      currentRatio: currentLiab ? currentAssets / currentLiab : 0,
      debtToEquity: equity ? totalDebt / equity : 0,
      quickRatio: currentLiab ? (currentAssets - inventory) / currentLiab : 0,
    };
  });

  const displayYears = years.map(y => y.replace(/-\d{2}$/, ""));

  const handleExport = () => {
    const headers = [t("fin.metric"), ...displayYears];
    const csvRows: string[][] = [];
    EXPANDABLE_BALANCE.forEach(node => {
      const vals = years.map(y => String((byYear[y]?.[node.field] as number) || 0));
      csvRows.push([`"${t(node.labelKey)}"`, ...vals]);
    });
    csvRows.push([`"${t("fin.currentRatio")}"`, ...solvencyRatios.map(r => r.currentRatio.toFixed(2))]);
    csvRows.push([`"${t("fin.deRatio")}"`, ...solvencyRatios.map(r => r.debtToEquity.toFixed(2))]);
    csvRows.push([`"${t("fin.quickRatio")}"`, ...solvencyRatios.map(r => r.quickRatio.toFixed(2))]);
    exportToCSV(headers, csvRows, "balance-sheet.csv");
  };

  return (
    <TooltipProvider>
      <div className="space-y-2">
        <div className="flex justify-end">
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground gap-1.5" onClick={handleExport}>
            <Download className="h-3.5 w-3.5" />
            {t("fin.exportExcel")}
          </Button>
        </div>
        <div className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/40 bg-muted/20">
                  <th className="text-start py-3 px-4 font-display text-muted-foreground font-medium min-w-[260px]">
                    {t("fin.metric")}
                  </th>
                  {displayYears.map((y, i) => (
                    <th key={years[i]} className="text-end py-3 px-3 font-display text-muted-foreground font-medium min-w-[90px]">
                      {y}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {EXPANDABLE_BALANCE.map((node) => {
                  const isExpanded = expanded[node.field] ?? false;
                  const canExpand = node.children && hasChildData(node.children);
                  const isHovered = hoveredParent === node.field;

                  const checksumResult = node.checksumChildren
                    ? (() => {
                        const latestYear = years[years.length - 1];
                        const latestRow = byYear[latestYear];
                        if (!latestRow) return null;
                        return verifyChecksum(latestRow, node.field, node.checksumChildren!);
                      })()
                    : null;

                  const visibleChildren = canExpand
                    ? node.children!.filter(child => childHasData(child.field))
                    : [];

                  const parentValues = years.map(y => (byYear[y]?.[node.field] as number) || 0);

                  return (
                    <RowGroup key={node.field}>
                      {/* Parent row */}
                      <tr
                        className={cn(
                          "border-b border-border/30 transition-all duration-150",
                          "bg-secondary/30 hover:bg-secondary/50",
                          canExpand && "cursor-pointer",
                          isHovered && "bg-secondary/50"
                        )}
                        onClick={() => canExpand && toggleExpand(node.field)}
                        onMouseEnter={() => setHoveredParent(node.field)}
                        onMouseLeave={() => setHoveredParent(null)}
                      >
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2" dir="rtl">
                            {canExpand && (
                              <ChevronRight
                                className={cn(
                                  "h-4.5 w-4.5 shrink-0 text-primary transition-transform duration-300 ease-out",
                                  isExpanded && "rotate-90"
                                )}
                              />
                            )}
                            <span className="font-display font-bold text-foreground">{t(node.labelKey)}</span>
                            <Sparkline values={parentValues} invertColor={node.invertColor} />
                            {checksumResult && checksumResult !== "unavailable" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inline-flex">
                                    {checksumResult === "verified" ? (
                                      <CheckCircle2 className="h-3.5 w-3.5 text-gain" />
                                    ) : (
                                      <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                                    )}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {checksumResult === "verified" ? t("deepdive.verified") : t("deepdive.checksumMismatch")}
                                </TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </td>
                        {years.map(y => (
                          <td key={y} className="text-end py-3 px-3 font-mono font-bold text-foreground">
                            {formatNum((byYear[y]?.[node.field] as number) || 0)}
                          </td>
                        ))}
                      </tr>

                      {/* Child rows */}
                      {isExpanded && visibleChildren.length > 0 && (
                        <tr>
                          <td colSpan={years.length + 1} className="p-0">
                            <div className="animate-accordion-down overflow-hidden">
                              <table className="w-full text-sm">
                                <tbody>
                                  {visibleChildren.map((child, childIdx) => {
                                    const isLast = childIdx === visibleChildren.length - 1;

                                    return (
                                      <tr
                                        key={child.field}
                                        className={cn(
                                          "border-b border-border/10 transition-colors duration-150",
                                          "hover:bg-primary/5",
                                          hoveredParent === node.field && "bg-primary/[0.02]"
                                        )}
                                        onMouseEnter={() => setHoveredParent(node.field)}
                                        onMouseLeave={() => setHoveredParent(null)}
                                      >
                                        <td className="py-2 px-4 min-w-[260px]" dir="rtl">
                                          <div className="flex items-center gap-0" dir="rtl">
                                            <div className="relative w-6 h-full shrink-0 flex items-center justify-center" dir="ltr">
                                              <div className={cn(
                                                "absolute right-0 top-0 w-px bg-border/40",
                                                isLast ? "h-1/2" : "h-full"
                                              )} />
                                              <div className="absolute right-0 top-1/2 h-px w-3 bg-border/40" />
                                            </div>
                                            <span className="text-muted-foreground font-display text-[13px] font-normal">
                                              {t(child.labelKey)}
                                            </span>
                                          </div>
                                        </td>
                                        {years.map(y => (
                                          <td key={y} className="text-end py-2 px-3 font-mono text-muted-foreground text-[13px] min-w-[90px]">
                                            {formatNum((byYear[y]?.[child.field] as number) || 0)}
                                          </td>
                                        ))}
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </td>
                        </tr>
                      )}
                    </RowGroup>
                  );
                })}

                {/* Solvency Ratios Section */}
                <tr>
                  <td colSpan={years.length + 1} className="p-0">
                    <div className="border-t-2 border-border/40 bg-muted/10 px-4 py-2">
                      <span className="font-display font-bold text-xs text-muted-foreground uppercase tracking-wide">
                        {t("fin.solvencyRatios")}
                      </span>
                    </div>
                  </td>
                </tr>
                {[
                  { labelKey: "fin.currentRatio", getValue: (r: any) => r.currentRatio },
                  { labelKey: "fin.deRatio", getValue: (r: any) => r.debtToEquity, invertColor: true },
                  { labelKey: "fin.quickRatio", getValue: (r: any) => r.quickRatio },
                ].map((ratio, idx) => (
                  <tr key={ratio.labelKey} className={cn("border-b border-border/20", idx % 2 === 0 ? "bg-muted/20" : "")}>
                    <td className="py-2.5 px-4 font-display font-semibold text-sm">{t(ratio.labelKey)}</td>
                    {solvencyRatios.map((r) => (
                      <td key={r.year} className="text-end py-2.5 px-3 font-mono text-sm">
                        {ratio.getValue(r) ? ratio.getValue(r).toFixed(2) : "—"}
                      </td>
                    ))}
                  </tr>
                ))}
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

// Sector-specific income statement metrics
function getIncomeMetrics(sector: SectorType): MetricDef[] {
  switch (sector) {
    case "bank":
      return [
        { labelKey: "fin.interestIncome", getValue: (r) => r.interestIncome ?? 0 },
        { labelKey: "fin.nonInterestIncome", getValue: (r) => r.nonInterestIncome ?? 0 },
        { labelKey: "fin.revenue", getValue: (r) => r.revenue },
        { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
        { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
        { labelKey: "fin.eps", getValue: (r) => r.eps, isEps: true },
      ];
    case "insurance":
      return [
        { labelKey: "fin.netPremiumsEarned", getValue: (r) => r.netPremiumsEarned ?? r.revenue },
        { labelKey: "fin.revenue", getValue: (r) => r.revenue },
        { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
        { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
        { labelKey: "fin.eps", getValue: (r) => r.eps, isEps: true },
      ];
    case "tech":
      return [
        { labelKey: "fin.revenue", getValue: (r) => r.revenue },
        { labelKey: "fin.grossProfit", getValue: (r) => r.grossProfit },
        { labelKey: "fin.researchDev", getValue: (r) => r.researchDevelopment ?? 0 },
        { labelKey: "fin.ebitda", getValue: (r) => r.ebitda },
        { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
        { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
        { labelKey: "fin.eps", getValue: (r) => r.eps, isEps: true },
      ];
    default:
      return [
        { labelKey: "fin.revenue", getValue: (r) => r.revenue },
        { labelKey: "fin.costOfRevenue", getValue: (r) => r.costOfRevenue },
        { labelKey: "fin.grossProfit", getValue: (r) => r.grossProfit },
        { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
        { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
        { labelKey: "fin.ebitda", getValue: (r) => r.ebitda },
        { labelKey: "fin.eps", getValue: (r) => r.eps, isEps: true },
      ];
  }
}

function getCashFlowMetrics(sector: SectorType): MetricDef[] {
  if (sector === "tech") {
    return [
      { labelKey: "fin.cashFromOps", getValue: (r) => r.cashFromOperations, colored: true },
      { labelKey: "fin.capex", getValue: (r) => r.capex },
      { labelKey: "fin.freeCashFlow", getValue: (r) => r.freeCashFlow, colored: true },
      { labelKey: "fin.netIncome", getValue: (r) => r.netIncome },
      { labelKey: "fin.depreciation", getValue: (r) => r.depreciation },
    ];
  }
  return [
    { labelKey: "fin.netIncome", getValue: (r) => r.netIncome },
    { labelKey: "fin.depreciation", getValue: (r) => r.depreciation },
    { labelKey: "fin.capex", getValue: (r) => r.capex },
    { labelKey: "fin.freeCashFlow", getValue: (r) => r.freeCashFlow, colored: true },
    { labelKey: "fin.cashFromOps", getValue: (r) => r.cashFromOperations, colored: true },
  ];
}

export default function FinancialsTable({ data, incomeStatement, balanceSheet, cashFlow, detailedBalanceSheet, loading, sector = "general", currency }: FinancialsTableProps) {
  const { t } = useLanguage();

  if (loading) {
    return (
      <div className="rounded-xl border bg-card p-8">
        <div className="animate-pulse space-y-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-8 rounded bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  const hasStatements = incomeStatement && incomeStatement.length > 0;

  if (!hasStatements && !data.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  if (!hasStatements) {
    const legacyMetrics: MetricDef[] = [
      { labelKey: "fin.revenue", getValue: (r) => r.revenue },
      { labelKey: "fin.grossProfit", getValue: (r) => r.grossProfit },
      { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
      { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
      { labelKey: "fin.deRatio", getValue: (r) => r.debtToEquity, isRatio: true },
      { labelKey: "fin.cash", getValue: (r) => r.cashAndEquiv },
    ];
    return <SimpleMetricTable rows={data} metrics={legacyMetrics} t={t} />;
  }

  const useDetailedBS = detailedBalanceSheet && detailedBalanceSheet.length > 0;

  const currencyLabel = currency && currency !== "ILS" && currency !== "ILA"
    ? ` (${CURRENCY_SYMBOLS[currency] || currency})`
    : "";

  return (
    <Tabs defaultValue="income" className="w-full">
      <div className="flex items-center gap-3 mb-4">
        <TabsList>
          <TabsTrigger value="income">{t("fin.incomeStatement")}</TabsTrigger>
          <TabsTrigger value="balance">{t("fin.balanceSheet")}</TabsTrigger>
          <TabsTrigger value="cashflow">{t("fin.cashFlow")}</TabsTrigger>
        </TabsList>
        {currency && (
          <span className="text-xs font-medium bg-secondary px-2 py-1 rounded-md text-muted-foreground">
            {CURRENCY_SYMBOLS[currency] || currency} {currency}
          </span>
        )}
      </div>
      <TabsContent value="income">
        <SimpleMetricTable rows={incomeStatement!} metrics={getIncomeMetrics(sector)} t={t} tabName="income-statement" currency={currency} />
      </TabsContent>
      <TabsContent value="balance">
        {useDetailedBS ? (
          <ExpandableBalanceTable rows={detailedBalanceSheet!} t={t} currency={currency} />
        ) : (
          <SimpleMetricTable rows={balanceSheet!} metrics={[
            { labelKey: "fin.totalAssets", getValue: (r) => r.totalAssets },
            { labelKey: "fin.totalLiabilities", getValue: (r) => r.totalLiabilities, invertColor: true },
            { labelKey: "fin.totalEquity", getValue: (r) => r.totalEquity },
            { labelKey: "fin.cashBs", getValue: (r) => r.cash },
            { labelKey: "fin.totalDebt", getValue: (r) => r.totalDebt, invertColor: true },
            { labelKey: "fin.inventory", getValue: (r) => r.inventory },
          ]} t={t} tabName="balance-sheet" currency={currency} />
        )}
      </TabsContent>
      <TabsContent value="cashflow">
        <SimpleMetricTable rows={cashFlow!} metrics={getCashFlowMetrics(sector)} t={t} tabName="cash-flow" currency={currency} />
      </TabsContent>
    </Tabs>
  );
}
