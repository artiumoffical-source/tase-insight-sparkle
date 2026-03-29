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

export default function FinancialsTable({ data, loading }: FinancialsTableProps) {
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
        No financial data available.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="border-b-border hover:bg-transparent">
              <TableHead className="font-display text-muted-foreground">Year</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Revenue</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Gross Profit</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Operating Inc.</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Net Income</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">D/E Ratio</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Cash & Equiv.</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.year} className="border-b-border">
                <TableCell className="font-display font-semibold">{row.year}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.revenue)}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.grossProfit)}</TableCell>
                <TableCell className={`text-right font-mono ${row.operatingIncome >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatNum(row.operatingIncome)}
                </TableCell>
                <TableCell className={`text-right font-mono ${row.netIncome >= 0 ? "text-gain" : "text-loss"}`}>
                  {formatNum(row.netIncome)}
                </TableCell>
                <TableCell className="text-right font-mono">{row.debtToEquity.toFixed(2)}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.cashAndEquiv)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
