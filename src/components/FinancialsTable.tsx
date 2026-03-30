import { useState } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ChevronRight, CheckCircle2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
}

interface MetricDef {
  labelKey: string;
  getValue: (row: any) => number;
  colored?: boolean;
  isRatio?: boolean;
  isEps?: boolean;
}

// --- Expandable balance sheet config ---
interface ExpandableRow {
  labelKey: string;
  field: keyof DetailedBalanceSheetRow;
  colored?: boolean;
  children?: { labelKey: string; field: keyof DetailedBalanceSheetRow }[];
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
    labelKey: "fin.totalLiabilities", field: "totalLiabilities",
    children: [
      { labelKey: "deepdive.totalCurrentLiabilities", field: "totalCurrentLiabilities" },
      { labelKey: "deepdive.accountsPayable", field: "accountsPayable" },
      { labelKey: "deepdive.shortTermDebt", field: "shortTermDebt" },
      { labelKey: "deepdive.otherCurrentLiabilities", field: "otherCurrentLiabilities" },
      { labelKey: "deepdive.nonCurrentLiabilities", field: "nonCurrentLiabilitiesTotal" },
      { labelKey: "deepdive.longTermDebt", field: "longTermDebt" },
      { labelKey: "deepdive.otherNonCurrentLiabilities", field: "otherNonCurrentLiabilities" },
    ],
    checksumChildren: ["totalCurrentLiabilities", "nonCurrentLiabilitiesTotal"],
  },
  {
    labelKey: "fin.totalEquity", field: "totalEquity",
    children: [
      { labelKey: "deepdive.commonStock", field: "commonStock" },
      { labelKey: "deepdive.retainedEarnings", field: "retainedEarnings" },
      { labelKey: "deepdive.otherEquity", field: "otherEquity" },
    ],
    checksumChildren: ["commonStock", "retainedEarnings", "otherEquity"],
  },
  { labelKey: "fin.cashBs", field: "cash" },
  { labelKey: "fin.totalDebt", field: "longTermDebt" },
];

function formatNum(value: number): string {
  if (value === 0) return "—";
  const abs = Math.abs(value);
  if (abs >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (abs >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
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
  const tolerance = Math.abs(parentVal) * 0.02;
  return Math.abs(parentVal - childSum) <= tolerance ? "verified" : "mismatch";
}

// --- Simple MetricTable for Income & Cash Flow ---
function SimpleMetricTable({ rows, metrics, t }: { rows: any[]; metrics: MetricDef[]; t: (k: string) => string }) {
  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const years = [...rows].sort((a, b) => a.year.localeCompare(b.year)).map((r) => r.year);
  const byYear: Record<string, any> = {};
  rows.forEach((r) => (byYear[r.year] = r));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-border hover:bg-transparent">
              <TableHead className="font-display text-muted-foreground">{t("fin.metric")}</TableHead>
              {years.map((y) => (
                <TableHead key={y} className="font-display text-muted-foreground text-end">{y}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m, idx) => (
              <TableRow key={m.labelKey} className={`border-b-border ${idx % 2 === 0 ? "bg-muted/30" : ""}`}>
                <TableCell className="font-display font-semibold">{t(m.labelKey)}</TableCell>
                {years.map((y) => {
                  const val = m.getValue(byYear[y]) ?? 0;
                  const colorClass = m.colored ? (val >= 0 ? "text-gain" : "text-loss") : "";
                  return (
                    <TableCell key={y} className={`text-end font-mono ${colorClass}`}>
                      {m.isEps ? val.toFixed(2) : m.isRatio ? val.toFixed(2) : formatNum(val)}
                    </TableCell>
                  );
                })}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

// --- Expandable Balance Sheet Table ---
function ExpandableBalanceTable({ rows, t }: { rows: DetailedBalanceSheetRow[]; t: (k: string) => string }) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!rows.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const years = [...rows].sort((a, b) => a.year.localeCompare(b.year)).map(r => r.year);
  const byYear: Record<string, DetailedBalanceSheetRow> = {};
  rows.forEach(r => (byYear[r.year] = r));

  const toggleExpand = (key: string) => setExpanded(prev => ({ ...prev, [key]: !prev[key] }));

  const hasChildData = (children: { field: keyof DetailedBalanceSheetRow }[]) =>
    children.some(child => years.some(y => {
      const val = byYear[y]?.[child.field] as number;
      return val !== 0 && val != null;
    }));

  return (
    <TooltipProvider>
      <div className="rounded-xl border bg-card overflow-hidden">
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
              {EXPANDABLE_BALANCE.map((node, nodeIdx) => {
                const isExpanded = expanded[node.field] ?? false;
                const canExpand = node.children && hasChildData(node.children);

                const checksumResult = node.checksumChildren
                  ? (() => {
                      const latestYear = years[years.length - 1];
                      const latestRow = byYear[latestYear];
                      if (!latestRow) return null;
                      return verifyChecksum(latestRow, node.field, node.checksumChildren!);
                    })()
                  : null;

                return (
                  <RowGroup key={node.field}>
                    {/* Parent row */}
                    <tr
                      className={cn(
                        "border-b border-border/30 transition-colors",
                        nodeIdx % 2 === 0 ? "bg-muted/30" : "bg-transparent",
                        "hover:bg-muted/50",
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
                          ) : null}
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
                                {checksumResult === "verified" ? t("deepdive.verified") : t("deepdive.checksumMismatch")}
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
                        {node.field === "totalAssets" ? "100%" : (() => {
                          const latestYear = years[years.length - 1];
                          const total = Math.abs((byYear[latestYear]?.totalAssets as number) || 1);
                          const val = (byYear[latestYear]?.[node.field] as number) || 0;
                          return formatPct((val / total) * 100);
                        })()}
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

export default function FinancialsTable({ data, incomeStatement, balanceSheet, cashFlow, detailedBalanceSheet, loading, sector = "general" }: FinancialsTableProps) {
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

  // Use detailed balance sheet for the expandable table
  const useDetailedBS = detailedBalanceSheet && detailedBalanceSheet.length > 0;

  return (
    <Tabs defaultValue="income" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="income">{t("fin.incomeStatement")}</TabsTrigger>
        <TabsTrigger value="balance">{t("fin.balanceSheet")}</TabsTrigger>
        <TabsTrigger value="cashflow">{t("fin.cashFlow")}</TabsTrigger>
      </TabsList>
      <TabsContent value="income">
        <SimpleMetricTable rows={incomeStatement!} metrics={getIncomeMetrics(sector)} t={t} />
      </TabsContent>
      <TabsContent value="balance">
        {useDetailedBS ? (
          <ExpandableBalanceTable rows={detailedBalanceSheet!} t={t} />
        ) : (
          <SimpleMetricTable rows={balanceSheet!} metrics={[
            { labelKey: "fin.totalAssets", getValue: (r) => r.totalAssets },
            { labelKey: "fin.totalLiabilities", getValue: (r) => r.totalLiabilities },
            { labelKey: "fin.totalEquity", getValue: (r) => r.totalEquity },
            { labelKey: "fin.cashBs", getValue: (r) => r.cash },
            { labelKey: "fin.totalDebt", getValue: (r) => r.totalDebt },
            { labelKey: "fin.inventory", getValue: (r) => r.inventory },
          ]} t={t} />
        )}
      </TabsContent>
      <TabsContent value="cashflow">
        <SimpleMetricTable rows={cashFlow!} metrics={getCashFlowMetrics(sector)} t={t} />
      </TabsContent>
    </Tabs>
  );
}
