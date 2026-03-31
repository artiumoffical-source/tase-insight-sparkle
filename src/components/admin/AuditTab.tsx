import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Loader2, ShieldCheck, AlertTriangle, Info, ChevronDown } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

interface CheckResult {
  name: string;
  passed: boolean;
  details: string;
  severity: "critical" | "minor";
}

function ChecksTooltip({ checks }: { checks: CheckResult[] }) {
  const failed = checks.filter((c) => !c.passed);
  if (!failed.length) return <span className="text-xs text-muted-foreground">הכל תקין</span>;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
            <Info className="h-3.5 w-3.5 text-destructive" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="left" className="max-w-xs text-right" dir="rtl">
          <div className="space-y-1.5">
            {failed.map((c) => (
              <div key={c.name} className="text-xs">
                <span className="font-semibold">
                  {c.name === "balance_sheet" ? "מאזן" : c.name === "income_statement" ? "דוח רווח" : c.name === "coverage" ? "כיסוי שנים" : "מטבע"}
                </span>
                <span className={`mr-1 ${c.severity === "critical" ? "text-destructive" : "text-yellow-500"}`}>
                  ({c.severity === "critical" ? "קריטי" : "קל"})
                </span>
                <p className="text-muted-foreground">{c.details}</p>
              </div>
            ))}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

export default function AuditTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");
  const [refetchingTicker, setRefetchingTicker] = useState<string | null>(null);
  const [manualEditTicker, setManualEditTicker] = useState<string | null>(null);
  const [manualEditData, setManualEditData] = useState<Record<string, string>>({});
  const [bulkRefreshing, setBulkRefreshing] = useState(false);

  const { data: auditResults, isLoading } = useQuery({
    queryKey: ["audit-results"],
    queryFn: async () => {
      const { data, error } = await supabase.from("stock_audit_results").select("*").order("health", { ascending: true });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: issueReports } = useQuery({
    queryKey: ["issue-reports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("data_issue_reports").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as any[];
    },
  });

  const { data: cachedFundamentals } = useQuery({
    queryKey: ["cached-fundamentals-meta"],
    queryFn: async () => {
      const { data, error } = await supabase.from("cached_fundamentals").select("ticker, data");
      if (error) throw error;
      return data as any[];
    },
  });

  const runAuditMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-financials`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => { toast.success(`נבדקו ${data.audited} מניות`); queryClient.invalidateQueries({ queryKey: ["audit-results"] }); },
    onError: (err: any) => toast.error(`שגיאה: ${err.message}`),
  });

  const toggleVerified = async (ticker: string, current: boolean) => {
    const { error } = await supabase.from("stock_audit_results").update({ verified_by_admin: !current }).eq("ticker", ticker);
    if (error) { toast.error("שגיאה בעדכון"); return; }
    queryClient.invalidateQueries({ queryKey: ["audit-results"] });
  };

  const resolveReport = async (id: string) => {
    const { error } = await supabase.from("data_issue_reports").update({ resolved: true }).eq("id", id);
    if (error) { toast.error("שגיאה"); return; }
    queryClient.invalidateQueries({ queryKey: ["issue-reports"] });
    toast.success("דיווח סומן כטופל");
  };

  const forceRefetch = async (ticker: string) => {
    setRefetchingTicker(ticker);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fetch-financials?ticker=${ticker}&force=true`,
        { headers: { Authorization: `Bearer ${session.access_token}`, apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      toast.success(`הנתונים של ${ticker} רועננו בהצלחה`);
      // Re-run audit for this ticker
      await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/audit-financials?ticker=${ticker}`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      queryClient.invalidateQueries({ queryKey: ["audit-results"] });
      queryClient.invalidateQueries({ queryKey: ["cached-fundamentals-meta"] });
    } catch (err: any) {
      toast.error(`שגיאה ברענון: ${err.message}`);
    } finally {
      setRefetchingTicker(null);
    }
  };

  const changeCurrency = async (ticker: string, currency: string) => {
    // Update in cached_fundamentals meta
    const fund = cachedFundamentals?.find((f: any) => f.ticker === ticker);
    if (!fund) { toast.error("לא נמצאו נתונים"); return; }
    const updatedData = { ...fund.data as any, meta: { ...(fund.data as any).meta, currency } };
    const { error } = await supabase.from("cached_fundamentals").update({ data: updatedData }).eq("ticker", ticker);
    if (error) { toast.error("שגיאה בעדכון מטבע"); return; }
    // Also update tase_symbols
    await supabase.from("tase_symbols").update({ currency }).eq("ticker", ticker);
    toast.success(`מטבע ${ticker} עודכן ל-${currency}`);
    queryClient.invalidateQueries({ queryKey: ["cached-fundamentals-meta"] });
  };

  const bulkRefreshEps = async () => {
    setBulkRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/bulk-refresh-eps`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      const data = await res.json();
      toast.success(`רוענו ${data.refreshed} מתוך ${data.total} מניות עם EPS=0`);
      queryClient.invalidateQueries({ queryKey: ["audit-results"] });
      queryClient.invalidateQueries({ queryKey: ["cached-fundamentals-meta"] });
    } catch (err: any) {
      toast.error(`שגיאה: ${err.message}`);
    } finally {
      setBulkRefreshing(false);
    }
  };

  const openManualEdit = (ticker: string) => {
    const fund = cachedFundamentals?.find((f: any) => f.ticker === ticker);
    if (!fund) { toast.error("לא נמצאו נתונים לעריכה"); return; }
    const d = fund.data as any;
    const latestBS = d?.balanceSheet?.[0] || d?.detailedBalanceSheet?.[0] || {};
    const latestIncome = d?.incomeStatement?.[0] || {};
    setManualEditData({
      totalAssets: String(latestBS.totalAssets || 0),
      totalLiabilities: String(latestBS.totalLiabilities || 0),
      totalEquity: String(latestBS.totalEquity || 0),
      revenue: String(latestIncome.revenue || 0),
      grossProfit: String(latestIncome.grossProfit || 0),
      netIncome: String(latestIncome.netIncome || 0),
    });
    setManualEditTicker(ticker);
  };

  const saveManualEdit = async () => {
    if (!manualEditTicker) return;
    const fund = cachedFundamentals?.find((f: any) => f.ticker === manualEditTicker);
    if (!fund) return;
    const d = { ...(fund.data as any) };

    // Update latest year in balanceSheet and incomeStatement
    if (d.balanceSheet?.[0]) {
      d.balanceSheet[0] = { ...d.balanceSheet[0], totalAssets: Number(manualEditData.totalAssets), totalLiabilities: Number(manualEditData.totalLiabilities), totalEquity: Number(manualEditData.totalEquity) };
    }
    if (d.detailedBalanceSheet?.[0]) {
      d.detailedBalanceSheet[0] = { ...d.detailedBalanceSheet[0], totalAssets: Number(manualEditData.totalAssets), totalLiabilities: Number(manualEditData.totalLiabilities), totalEquity: Number(manualEditData.totalEquity) };
    }
    if (d.incomeStatement?.[0]) {
      d.incomeStatement[0] = { ...d.incomeStatement[0], revenue: Number(manualEditData.revenue), grossProfit: Number(manualEditData.grossProfit), netIncome: Number(manualEditData.netIncome) };
    }

    const { error } = await supabase.from("cached_fundamentals").update({ data: d }).eq("ticker", manualEditTicker);
    if (error) { toast.error("שגיאה בשמירה"); return; }

    // Mark as verified
    await supabase.from("stock_audit_results").update({ verified_by_admin: true, health: "green" }).eq("ticker", manualEditTicker);

    toast.success(`${manualEditTicker} עודכן ידנית וסומן כמאומת`);
    setManualEditTicker(null);
    queryClient.invalidateQueries({ queryKey: ["audit-results"] });
    queryClient.invalidateQueries({ queryKey: ["cached-fundamentals-meta"] });
  };

  const getCurrency = (ticker: string) => {
    const fund = cachedFundamentals?.find((f: any) => f.ticker === ticker);
    return (fund?.data as any)?.meta?.currency || "ILS";
  };

  const filtered = auditResults?.filter((r: any) => filter === "all" || r.health === filter) ?? [];
  const healthBadge = (h: string) => h === "green" ? "bg-green-600 text-white" : h === "yellow" ? "bg-yellow-500 text-black" : "bg-red-600 text-white";
  const healthLabel = (h: string) => h === "green" ? "תקין" : h === "yellow" ? "חלקי" : "שגיאה";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          {(["all", "red", "yellow", "green"] as const).map((f) => (
            <Button key={f} size="sm" variant={filter === f ? "default" : "outline"} onClick={() => setFilter(f)}>
              {f === "all" ? "הכל" : f === "red" ? "🔴 שגיאה" : f === "yellow" ? "🟡 חלקי" : "🟢 תקין"}
            </Button>
          ))}
        </div>
        <Button onClick={() => runAuditMutation.mutate()} disabled={runAuditMutation.isPending} className="gap-2">
          {runAuditMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          הרץ ביקורת מלאה
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : !filtered.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין תוצאות ביקורת. הרץ ביקורת מלאה כדי להתחיל.</CardContent></Card>
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-right p-3 font-medium">טיקר</th>
                <th className="text-right p-3 font-medium">בריאות</th>
                <th className="text-right p-3 font-medium">פירוט</th>
                <th className="text-right p-3 font-medium">מטבע</th>
                <th className="text-right p-3 font-medium">בדיקה אחרונה</th>
                <th className="text-center p-3 font-medium">מאומת ✓</th>
                <th className="text-center p-3 font-medium">פעולות</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => {
                const checks: CheckResult[] = Array.isArray(r.checks) ? r.checks : [];
                const currency = getCurrency(r.ticker);
                return (
                  <tr key={r.ticker} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-3 font-mono font-medium">{r.ticker}</td>
                    <td className="p-3"><Badge className={healthBadge(r.health)}>{healthLabel(r.health)}</Badge></td>
                    <td className="p-3"><ChecksTooltip checks={checks} /></td>
                    <td className="p-3">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm" className="h-7 gap-1 text-xs">
                            {currency} <ChevronDown className="h-3 w-3" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                          {["ILS", "USD", "EUR"].map((c) => (
                            <DropdownMenuItem key={c} onClick={() => changeCurrency(r.ticker, c)}>{c}</DropdownMenuItem>
                          ))}
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                    <td className="p-3 text-muted-foreground">{new Date(r.last_audited).toLocaleDateString("he-IL")}</td>
                    <td className="p-3 text-center">
                      <Checkbox checked={r.verified_by_admin} onCheckedChange={() => toggleVerified(r.ticker, r.verified_by_admin)} />
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 w-7 p-0"
                          disabled={refetchingTicker === r.ticker}
                          onClick={() => forceRefetch(r.ticker)}
                          title="רענן נתונים מהAPI"
                        >
                          {refetchingTicker === r.ticker ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 text-xs"
                          onClick={() => openManualEdit(r.ticker)}
                        >
                          עריכה
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Manual Edit Dialog */}
      <Dialog open={!!manualEditTicker} onOpenChange={(open) => !open && setManualEditTicker(null)}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>עריכה ידנית — {manualEditTicker}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p className="text-xs text-muted-foreground">עדכון השנה האחרונה. לאחר שמירה, המניה תסומן כמאומתת.</p>
            {[
              { key: "totalAssets", label: "סה״כ נכסים" },
              { key: "totalLiabilities", label: "סה״כ התחייבויות" },
              { key: "totalEquity", label: "הון עצמי" },
              { key: "revenue", label: "הכנסות" },
              { key: "grossProfit", label: "רווח גולמי" },
              { key: "netIncome", label: "רווח נקי" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center gap-2">
                <label className="w-28 text-muted-foreground">{label}</label>
                <input
                  type="number"
                  className="flex-1 rounded border bg-background px-2 py-1.5 text-sm"
                  value={manualEditData[key] || ""}
                  onChange={(e) => setManualEditData((d) => ({ ...d, [key]: e.target.value }))}
                />
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button onClick={saveManualEdit}>שמור וסמן כמאומת</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Issue Reports */}
      {issueReports && issueReports.filter((r: any) => !r.resolved).length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-yellow-500" /> דיווחי משתמשים</h3>
          {issueReports.filter((r: any) => !r.resolved).map((r: any) => (
            <Card key={r.id}>
              <CardContent className="py-3 flex items-center justify-between">
                <div>
                  <span className="font-mono font-medium">{r.ticker}</span>
                  <span className="text-muted-foreground mx-2">—</span>
                  <span className="text-sm">{r.message || "ללא הודעה"}</span>
                  <span className="text-xs text-muted-foreground mr-2">{new Date(r.created_at).toLocaleDateString("he-IL")}</span>
                </div>
                <Button size="sm" variant="outline" onClick={() => resolveReport(r.id)}>טופל</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
