import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

export interface FinancialData {
  year: string;
  avgClose: number;
  high: number;
  low: number;
  avgVolume: number;
  tradingDays: number;
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
        No historical data available.
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
              <TableHead className="font-display text-muted-foreground text-right">Avg Close (₪)</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">High (₪)</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Low (₪)</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Avg Volume</TableHead>
              <TableHead className="font-display text-muted-foreground text-right">Trading Days</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.map((row) => (
              <TableRow key={row.year} className="border-b-border">
                <TableCell className="font-display font-semibold">{row.year}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.avgClose)}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.high)}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.low)}</TableCell>
                <TableCell className="text-right font-mono">{formatNum(row.avgVolume)}</TableCell>
                <TableCell className="text-right font-mono">{row.tradingDays}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
