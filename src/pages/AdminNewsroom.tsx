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
import { RefreshCw, Check, X, Edit2, Save, ExternalLink, Loader2 } from "lucide-react";
import { Navigate } from "react-router-dom";

export default function AdminNewsroom() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editBody, setEditBody] = useState("");
  const [editSummary, setEditSummary] = useState("");

  const { data: isSuperAdmin, isLoading: roleLoading } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "superadmin")
        .maybeSingle();
      return !!data;
    },
    enabled: !!user,
  });

  const { data: articles, isLoading } = useQuery({
    queryKey: ["admin-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && isSuperAdmin === true,
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-news-analysis`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
        }
      );
      if (!res.ok) throw new Error(`Error ${res.status}`);
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(`נוצרו ${data.generated} ניתוחים חדשים`);
      queryClient.invalidateQueries({ queryKey: ["admin-news"] });
    },
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("news_articles").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-news"] });
      setEditingId(null);
    },
    onError: (err) => toast.error(`שגיאה: ${err.message}`),
  });

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin h-8 w-8" /></div>;
  if (!user) return <Navigate to="/auth" replace />;

  const startEdit = (article: any) => {
    setEditingId(article.id);
    setEditTitle(article.ai_title_he);
    setEditBody(article.ai_body_he);
    setEditSummary(article.ai_summary_he);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateMutation.mutate({
      id: editingId,
      updates: {
        ai_title_he: editTitle,
        ai_body_he: editBody,
        ai_summary_he: editSummary,
        updated_at: new Date().toISOString(),
      },
    });
  };

  const publish = (id: string) => {
    updateMutation.mutate({
      id,
      updates: { status: "published", published_at: new Date().toISOString() },
    });
    toast.success("המאמר פורסם!");
  };

  const reject = (id: string) => {
    updateMutation.mutate({ id, updates: { status: "rejected" } });
  };

  const statusColor = (s: string) =>
    s === "published" ? "bg-green-600" : s === "rejected" ? "bg-red-600" : "bg-yellow-600";
  const statusLabel = (s: string) =>
    s === "published" ? "פורסם" : s === "rejected" ? "נדחה" : "ממתין";

  return (
    <div className="container max-w-5xl py-8" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">ניוזרום - ניהול מאמרים</h1>
        <Button
          onClick={() => generateMutation.mutate()}
          disabled={generateMutation.isPending}
          className="flex items-center gap-2"
        >
          {generateMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4" />
          )}
          אסוף וצור ניתוחים
        </Button>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12"><Loader2 className="animate-spin h-8 w-8" /></div>
      ) : !articles?.length ? (
        <Card><CardContent className="py-12 text-center text-muted-foreground">
          אין מאמרים עדיין. לחץ על "אסוף וצור ניתוחים" כדי להתחיל.
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {articles.map((article: any) => (
            <Card key={article.id} className="overflow-hidden">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <Badge className={statusColor(article.status)}>
                        {statusLabel(article.status)}
                      </Badge>
                      {article.related_ticker && (
                        <Badge variant="outline">{article.related_ticker}</Badge>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {new Date(article.created_at).toLocaleDateString("he-IL")}
                      </span>
                    </div>
                    {editingId === article.id ? (
                      <Input
                        value={editTitle}
                        onChange={(e) => setEditTitle(e.target.value)}
                        className="text-lg font-bold"
                      />
                    ) : (
                      <CardTitle className="text-lg">{article.ai_title_he}</CardTitle>
                    )}
                  </div>
                  {article.original_url && (
                    <a
                      href={article.original_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-muted-foreground hover:text-primary"
                    >
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  מקור: {article.original_source} | {article.original_title}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {editingId === article.id ? (
                  <>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">תקציר</label>
                      <Input
                        value={editSummary}
                        onChange={(e) => setEditSummary(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-muted-foreground">ניתוח מלא</label>
                      <Textarea
                        value={editBody}
                        onChange={(e) => setEditBody(e.target.value)}
                        rows={8}
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={saveEdit} className="gap-1">
                        <Save className="h-3 w-3" /> שמור
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                        ביטול
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-muted-foreground">{article.ai_summary_he}</p>
                    <p className="text-sm whitespace-pre-line leading-relaxed">
                      {article.ai_body_he}
                    </p>
                    <p className="text-xs text-muted-foreground mt-2">
                      מאת: {article.author}
                    </p>
                  </>
                )}

                {article.status === "pending" && editingId !== article.id && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" variant="ghost" onClick={() => startEdit(article)} className="gap-1">
                      <Edit2 className="h-3 w-3" /> עריכה
                    </Button>
                    <Button size="sm" onClick={() => publish(article.id)} className="gap-1">
                      <Check className="h-3 w-3" /> פרסום
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => reject(article.id)} className="gap-1">
                      <X className="h-3 w-3" /> דחייה
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
