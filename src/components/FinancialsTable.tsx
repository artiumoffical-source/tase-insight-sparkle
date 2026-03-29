import { useLanguage } from "@/hooks/useLanguage";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FinancialData {
  year: string;
  revenue: number;
  grossProfit: number;
  operatingIncome: number;
  netIncome: number;
  debtToEquity: number;
  cashAndEquiv: number;
}

interface FinancialsTableProps {
  data: FinancialData[];
  loading?: boolean;
}

function formatNum(value: number): string {
  if (Math.abs(value) >= 1e9) return `${(value / 1e9).toFixed(2)}B`;
  if (Math.abs(value) >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (Math.abs(value) >= 1e3) return `${(value / 1e3).toFixed(1)}K`;
  return value.toFixed(2);
}

type MetricKey = "revenue" | "grossProfit" | "operatingIncome" | "netIncome" | "debtToEquity" | "cashAndEquiv";

const METRICS: { key: MetricKey; labelKey: string; colored?: boolean; isRatio?: boolean }[] = [
  { key: "revenue", labelKey: "fin.revenue" },
  { key: "grossProfit", labelKey: "fin.grossProfit" },
  { key: "operatingIncome", labelKey: "fin.operatingIncome", colored: true },
  { key: "netIncome", labelKey: "fin.netIncome", colored: true },
  { key: "debtToEquity", labelKey: "fin.deRatio", isRatio: true },
  { key: "cashAndEquiv", labelKey: "fin.cash" },
];

export default function FinancialsTable({ data, loading }: FinancialsTableProps) {
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

  if (!data.length) {
    return (
      <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
        {t("stock.noData")}
      </div>
    );
  }

  const years = [...data].sort((a, b) => a.year.localeCompare(b.year)).map((d) => d.year);
  const byYear: Record<string, FinancialData> = {};
  data.forEach((d) => (byYear[d.year] = d));

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-border hover:bg-transparent">
              <TableHead className="font-display text-muted-foreground">{t("fin.year")}</TableHead>
              {years.map((y) => (
                <TableHead key={y} className="font-display text-muted-foreground text-end">{y}</TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {METRICS.map((m) => (
              <TableRow key={m.key} className="border-b-border">
                <TableCell className="font-display font-semibold">{t(m.labelKey)}</TableCell>
                {years.map((y) => {
                  const val = byYear[y]?.[m.key] ?? 0;
                  const colorClass = m.colored ? (val >= 0 ? "text-gain" : "text-loss") : "";
                  return (
                    <TableCell key={y} className={`text-end font-mono ${colorClass}`}>
                      {m.isRatio ? val.toFixed(2) : formatNum(val)}
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
