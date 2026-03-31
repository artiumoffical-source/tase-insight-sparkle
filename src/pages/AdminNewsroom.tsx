import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { RefreshCw, Check, X, Edit2, Save, ExternalLink, Loader2, ShieldCheck, AlertTriangle } from "lucide-react";
import { Navigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";

/* ─── News Tab (extracted) ─── */
function NewsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSummary, setEditSummary] = useState("");

  const { data: articles, isLoading } = useQuery({
    queryKey: ["admin-news"],
    queryFn: async () => {
      const { data, error } = await supabase.from("news_articles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-news-analysis`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json", apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => { toast.success(`נוצרו ${data.generated} ניתוחים חדשים`); queryClient.invalidateQueries({ queryKey: ["admin-news"] }); },
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("news_articles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["admin-news"] }); setEditingId(null); },
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
  });

  const startEdit = (article: any) => { setEditingId(article.id); setEditTitle(article.ai_title_he); setEditBody(article.ai_body_he); setEditSummary(article.ai_summary_he); };
  const saveEdit = () => { if (!editingId) return; updateMutation.mutate({ id: editingId, updates: { ai_title_he: editTitle, ai_body_he: editBody, ai_summary_he: editSummary, updated_at: new Date().toISOString() } }); };
  const publish = (id: string) => { updateMutation.mutate({ id, updates: { status: "published", published_at: new Date().toISOString() } }); toast.success("המאמר פורסם!"); };
  const reject = (id: string) => { updateMutation.mutate({ id, updates: { status: "rejected" } }); };

  const statusColor = (s: string) => s === "published" ? "bg-green-600" : s === "rejected" ? "bg-red-600" : "bg-yellow-600";
  const statusLabel = (s: string) => s === "published" ? "פורסם" : s === "rejected" ? "נדחה" : "ממתין";

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => generateMutation.mutate()} disabled={generateMutation.isPending} className="flex items-center gap-2">
          {generateMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          אסוף וצור ניתוחים
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : !articles?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">אין מאמרים עדיין.</CardContent></Card>
      ) : (
        articles.map((article: any) => (
          <Card key={article.id} className="overflow-hidden">
            <CardHeader className="pb-2">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge className={statusColor(article.status)}>{statusLabel(article.status)}</Badge>
                    <Badge variant="secondary" className={article.category === "macro" ? "bg-blue-600 text-white" : "bg-muted"}>{article.category === "macro" ? "מאקרו וכלכלה" : "מניות"}</Badge>
                    {article.related_ticker && <Badge variant="outline">{article.related_ticker}</Badge>}
                    <span className="text-xs text-muted-foreground">{new Date(article.created_at).toLocaleDateString("he-IL")}</span>
                  </div>
                  {editingId === article.id ? <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="text-lg font-bold" /> : <CardTitle className="text-lg">{article.ai_title_he}</CardTitle>}
                </div>
                {article.original_url && <a href={article.original_url} target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary"><ExternalLink className="h-4 w-4" /></a>}
              </div>
              <p className="text-xs text-muted-foreground mt-1">מקור: {article.original_source} | {article.original_title}</p>
            </CardHeader>
            <CardContent className="space-y-3">
              {editingId === article.id ? (
                <>
                  <div><label className="text-xs font-medium text-muted-foreground">תקציר</label><Input value={editSummary} onChange={(e) => setEditSummary(e.target.value)} /></div>
                  <div><label className="text-xs font-medium text-muted-foreground">ניתוח מלא</label><Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={8} /></div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={saveEdit} className="gap-1"><Save className="h-3 w-3" /> שמור</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>ביטול</Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">{article.ai_summary_he}</p>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{article.ai_body_he}</p>
                  <p className="text-xs text-muted-foreground mt-2">מאת: {article.author}</p>
                </>
              )}
              {article.status === "pending" && editingId !== article.id && (
                <div className="flex gap-2 pt-2 border-t">
                  <Button size="sm" variant="ghost" onClick={() => startEdit(article)} className="gap-1"><Edit2 className="h-3 w-3" /> עריכה</Button>
                  <Button size="sm" onClick={() => publish(article.id)} className="gap-1"><Check className="h-3 w-3" /> פרסום</Button>
                  <Button size="sm" variant="destructive" onClick={() => reject(article.id)} className="gap-1"><X className="h-3 w-3" /> דחייה</Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}

/* ─── Audit Tab ─── */
function AuditTab() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<"all" | "green" | "yellow" | "red">("all");

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
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
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
                <th className="text-right p-3 font-medium">בדיקה אחרונה</th>
                <th className="text-center p-3 font-medium">מאומת ✓</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r: any) => (
                <tr key={r.ticker} className="border-t hover:bg-muted/30 transition-colors">
                  <td className="p-3 font-mono font-medium">{r.ticker}</td>
                  <td className="p-3"><Badge className={healthBadge(r.health)}>{healthLabel(r.health)}</Badge></td>
                  <td className="p-3 text-muted-foreground">{new Date(r.last_audited).toLocaleDateString("he-IL")}</td>
                  <td className="p-3 text-center">
                    <Checkbox checked={r.verified_by_admin} onCheckedChange={() => toggleVerified(r.ticker, r.verified_by_admin)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

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

/* ─── Main Page ─── */
export default function AdminNewsroom() {
  const { user, loading } = useAuth();

  const { data: isSuperAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user!.id).eq("role", "superadmin").maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  if (loading || roleLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (!isSuperAdmin) return <div className="flex justify-center py-20 text-destructive font-bold">אין לך הרשאה לדף זה</div>;

  return (
    <div className="container max-w-5xl py-8" dir="rtl">
      <h1 className="text-2xl font-bold mb-6">ניוזרום - ניהול</h1>
      <Tabs defaultValue="news">
        <TabsList className="mb-4">
          <TabsTrigger value="news">חדשות</TabsTrigger>
          <TabsTrigger value="audit">ביקורת נתונים</TabsTrigger>
        </TabsList>
        <TabsContent value="news"><NewsTab /></TabsContent>
        <TabsContent value="audit"><AuditTab /></TabsContent>
      </Tabs>
    </div>
  );
}
