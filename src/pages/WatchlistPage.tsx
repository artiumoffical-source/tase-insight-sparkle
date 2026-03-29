import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { supabase } from "@/integrations/supabase/client";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Star } from "lucide-react";
import { toast } from "sonner";

interface WatchlistItem {
  id: string;
  ticker: string;
  name: string;
}

export default function WatchlistPage() {
  const { user, loading: authLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [items, setItems] = useState<WatchlistItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    fetchWatchlist();
  }, [user, authLoading, navigate]);

  const fetchWatchlist = async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("watchlist")
      .select("id, ticker, name")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setItems((data as WatchlistItem[]) ?? []);
    setLoading(false);
  };

  const removeItem = async (id: string) => {
    await supabase.from("watchlist").delete().eq("id", id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success(t("watchlist.removed"));
  };

  if (authLoading || loading) {
    return (
      <div className="container max-w-3xl py-16">
        <div className="animate-pulse space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8 animate-fade-in">
      <div className="flex items-center gap-3 mb-6">
        <Star className="h-6 w-6 text-primary fill-primary" />
        <h1 className="font-display text-2xl font-bold">{t("watchlist.title")}</h1>
      </div>

      {items.length === 0 ? (
        <div className="rounded-xl border bg-card p-12 text-center">
          <p className="text-muted-foreground mb-4">{t("watchlist.empty")}</p>
          <Button asChild>
            <Link to="/">{t("watchlist.discover")}</Link>
          </Button>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="border-b-border hover:bg-transparent">
                <TableHead className="font-display">{t("watchlist.ticker")}</TableHead>
                <TableHead className="font-display">{t("watchlist.name")}</TableHead>
                <TableHead className="font-display text-end">{t("watchlist.actions")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id} className="border-b-border">
                  <TableCell>
                    <Link to={`/stock/${item.ticker}`} className="font-display font-semibold text-primary hover:underline">
                      {item.ticker}
                    </Link>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{item.name}</TableCell>
                  <TableCell className="text-end">
                    <Button variant="ghost" size="icon" onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-loss">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
