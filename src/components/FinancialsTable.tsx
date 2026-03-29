import { useLanguage } from "@/hooks/useLanguage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Shared types
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
}

export interface BalanceSheetRow {
  year: string;
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  cash: number;
  totalDebt: number;
  inventory: number;
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
  loading?: boolean;
}

function formatNum(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

interface MetricDef {
  labelKey: string;
  getValue: (row: any) => number;
  colored?: boolean;
  isRatio?: boolean;
  isEps?: boolean;
}

const INCOME_METRICS: MetricDef[] = [
  { labelKey: "fin.revenue", getValue: (r) => r.revenue },
  { labelKey: "fin.costOfRevenue", getValue: (r) => r.costOfRevenue },
  { labelKey: "fin.grossProfit", getValue: (r) => r.grossProfit },
  { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
  { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
  { labelKey: "fin.ebitda", getValue: (r) => r.ebitda },
  { labelKey: "fin.eps", getValue: (r) => r.eps, isEps: true },
];

const BALANCE_METRICS: MetricDef[] = [
  { labelKey: "fin.totalAssets", getValue: (r) => r.totalAssets },
  { labelKey: "fin.totalLiabilities", getValue: (r) => r.totalLiabilities },
  { labelKey: "fin.totalEquity", getValue: (r) => r.totalEquity },
  { labelKey: "fin.cashBs", getValue: (r) => r.cash },
  { labelKey: "fin.totalDebt", getValue: (r) => r.totalDebt },
  { labelKey: "fin.inventory", getValue: (r) => r.inventory },
];

const CASHFLOW_METRICS: MetricDef[] = [
  { labelKey: "fin.netIncome", getValue: (r) => r.netIncome },
  { labelKey: "fin.depreciation", getValue: (r) => r.depreciation },
  { labelKey: "fin.capex", getValue: (r) => r.capex },
  { labelKey: "fin.freeCashFlow", getValue: (r) => r.freeCashFlow, colored: true },
  { labelKey: "fin.cashFromOps", getValue: (r) => r.cashFromOperations, colored: true },
];

function MetricTable({ rows, metrics, t }: { rows: any[]; metrics: MetricDef[]; t: (k: string) => string }) {
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
            {metrics.map((m, idx) => {
              const isEven = idx % 2 === 0;
              return (
                <TableRow key={m.labelKey} className={`border-b-border ${isEven ? "bg-muted/30" : ""}`}>
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
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

export default function FinancialsTable({ data, incomeStatement, balanceSheet, cashFlow, loading }: FinancialsTableProps) {
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

  // Use 3-statement data if available, otherwise fall back to legacy
  const hasStatements = (incomeStatement && incomeStatement.length > 0);

  if (!hasStatements && !data.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  if (!hasStatements) {
    // Legacy fallback
    const legacyMetrics: MetricDef[] = [
      { labelKey: "fin.revenue", getValue: (r) => r.revenue },
      { labelKey: "fin.grossProfit", getValue: (r) => r.grossProfit },
      { labelKey: "fin.operatingIncome", getValue: (r) => r.operatingIncome, colored: true },
      { labelKey: "fin.netIncome", getValue: (r) => r.netIncome, colored: true },
      { labelKey: "fin.deRatio", getValue: (r) => r.debtToEquity, isRatio: true },
      { labelKey: "fin.cash", getValue: (r) => r.cashAndEquiv },
    ];
    return <MetricTable rows={data} metrics={legacyMetrics} t={t} />;
  }

  return (
    <Tabs defaultValue="income" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="income">{t("fin.incomeStatement")}</TabsTrigger>
        <TabsTrigger value="balance">{t("fin.balanceSheet")}</TabsTrigger>
        <TabsTrigger value="cashflow">{t("fin.cashFlow")}</TabsTrigger>
      </TabsList>
      <TabsContent value="income">
        <MetricTable rows={incomeStatement!} metrics={INCOME_METRICS} t={t} />
      </TabsContent>
      <TabsContent value="balance">
        <MetricTable rows={balanceSheet!} metrics={BALANCE_METRICS} t={t} />
      </TabsContent>
      <TabsContent value="cashflow">
        <MetricTable rows={cashFlow!} metrics={CASHFLOW_METRICS} t={t} />
      </TabsContent>
    </Tabs>
  );
}
