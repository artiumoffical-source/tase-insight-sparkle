import { useState, useEffect, useCallback } from "react";
import { useLanguage } from "@/hooks/useLanguage";
import { Newspaper, Lock, BookOpen, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import NewsReaderModal, { type NewsArticle } from "@/components/NewsReaderModal";
import { getCached, setCache } from "@/lib/stock-cache";
import { supabase } from "@/integrations/supabase/client";

interface StockNewsSidebarProps {
  ticker: string;
  isPremium: boolean;
  onUpgrade: () => void;
}

function timeAgo(dateStr: string, lang: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return lang === "he" ? "עכשיו" : "Just now";
  if (mins < 60) return lang === "he" ? `לפני ${mins} דק׳` : `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return lang === "he" ? `לפני ${hrs} שע׳` : `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return lang === "he" ? `לפני ${days} ימים` : `${days}d ago`;
}

interface EnrichedNewsArticle extends NewsArticle {
  isLocal?: boolean;
}

export default function StockNewsSidebar({ ticker, isPremium, onUpgrade }: StockNewsSidebarProps) {
  const { t, lang } = useLanguage();
  const [items, setItems] = useState<EnrichedNewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedArticle, setSelectedArticle] = useState<NewsArticle | null>(null);
  const [readerOpen, setReaderOpen] = useState(false);

  const fetchNews = useCallback(async (skipCache = false) => {
    if (!skipCache) {
      const cached = getCached<{ items: EnrichedNewsArticle[] }>("news", ticker);
      if (cached) {
        setItems(cached.items ?? []);
        setLoading(false);
        return;
      }
    }

    try {
      // 1. Fetch local published articles from news_articles table
      const { data: localArticles } = await supabase
        .from("news_articles")
        .select("*")
        .eq("related_ticker", ticker)
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(10);

      const localItems: EnrichedNewsArticle[] = (localArticles ?? []).map((a) => ({
        title: a.original_title || a.ai_title_he,
        titleHe: a.ai_title_he,
        content: a.content || a.ai_body_he,
        contentHe: a.ai_body_he,
        url: a.original_url || "",
        source: a.author || "AlphaMap",
        date: a.published_at || a.created_at,
        image: null,
        sentiment: a.sentiment === "positive" ? 0.5 : a.sentiment === "negative" ? -0.5 : 0,
        isLocal: true,
      }));

      // 2. Fetch external EODHD news
      let externalItems: EnrichedNewsArticle[] = [];
      try {
        const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `https://${projectId}.supabase.co/functions/v1/fetch-news?ticker=${ticker}`,
          { headers: { apikey: anonKey, "Content-Type": "application/json" } }
        );
        if (res.ok) {
          const data = await res.json();
          externalItems = ((data.items ?? []) as NewsArticle[]).map((item) => ({
            ...item,
            isLocal: false,
          }));
        }
      } catch (err) {
        console.error("External news fetch error:", err);
      }

      // 3. Merge: local first, then external
      const merged = [...localItems, ...externalItems];
      setItems(merged);
      setCache("news", ticker, { items: merged });
    } catch (err) {
      console.error("News fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [ticker]);

  useEffect(() => {
    fetchNews();
    const interval = setInterval(fetchNews, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchNews]);

  const handleArticleClick = (article: EnrichedNewsArticle) => {
    setSelectedArticle(article);
    setReaderOpen(true);
  };

  const visibleItems = isPremium ? items : items.slice(0, 3);
  const isHe = lang === "he";

  return (
    <div className="space-y-4">
      <div className="rounded-xl border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Newspaper className="h-4 w-4 text-primary" />
            <h3 className="font-display text-sm font-semibold">{t("news.liveNews")}</h3>
          </div>
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" />
          </span>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="animate-pulse space-y-2">
                <div className="h-3 bg-muted rounded w-full" />
                <div className="h-2 bg-muted rounded w-2/3" />
              </div>
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("news.noNews")}</p>
        ) : (
          <div className="space-y-3">
            {visibleItems.map((item, i) => (
              <button
                key={i}
                onClick={() => handleArticleClick(item)}
                className="group block w-full text-start rounded-lg p-2.5 -mx-1 hover:bg-secondary/50 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  {item.image ? (
                    <img
                      src={item.image}
                      alt=""
                      className="h-8 w-8 rounded-md object-cover shrink-0 mt-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : item.source && !item.isLocal ? (
                    <img
                      src={`https://logo.clearbit.com/${item.source.toLowerCase().replace(/\s/g, '')}.com`}
                      alt=""
                      className="h-6 w-6 rounded-full object-cover shrink-0 mt-0.5"
                      onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {item.isLocal && (
                        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 gap-0.5 shrink-0">
                          <Sparkles className="h-2.5 w-2.5" />
                          {isHe ? "ניתוח מקומי" : "Local Analysis"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs font-medium leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                      {isHe && item.titleHe ? item.titleHe : item.title}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                      {!item.isLocal && <span>{item.source}</span>}
                      {!item.isLocal && <span>·</span>}
                      <span>{timeAgo(item.date, lang)}</span>
                      <BookOpen className="h-2.5 w-2.5 opacity-0 group-hover:opacity-100 transition-opacity ms-auto" />
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {!isPremium && items.length > 3 && (
              <div className="relative mt-2">
                <div className="space-y-3 blur-sm pointer-events-none select-none">
                  {items.slice(3, 5).map((item, i) => (
                    <div key={i} className="rounded-lg p-2.5">
                      <p className="text-xs font-medium leading-snug line-clamp-2">{isHe && item.titleHe ? item.titleHe : item.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                        <span>{item.source}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-card/60 backdrop-blur-[2px] rounded-lg">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onUpgrade}
                    className="text-xs gap-1.5"
                  >
                    <Lock className="h-3 w-3" />
                    {t("news.unlockFull")}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <NewsReaderModal
        article={selectedArticle}
        open={readerOpen}
        onOpenChange={setReaderOpen}
        isPremium={isPremium}
        onUpgrade={onUpgrade}
      />
    </div>
  );
}
