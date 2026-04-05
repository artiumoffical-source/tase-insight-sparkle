import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import StockLogo from "@/components/StockLogo";

function timeAgo(dateStr: string, isHe: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return isHe ? `לפני ${mins} דקות` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isHe ? `לפני ${hours} שעות` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isHe ? `לפני ${days} ימים` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(isHe ? "he-IL" : "en-US", {
    year: "numeric", month: "short", day: "numeric",
  });
}

export default function NewsPage() {
  const { lang } = useLanguage();
  const isHe = lang === "he";

  const { data: articles, isLoading } = useQuery({
    queryKey: ["public-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("status", "published")
        .order("published_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // Batch-fetch company logos for all related tickers
  const tickers = [...new Set((articles || []).map((a: any) => a.related_ticker).filter(Boolean))];
  const { data: companies } = useQuery({
    queryKey: ["news-logos", tickers.join(",")],
    queryFn: async () => {
      if (!tickers.length) return [];
      const { data } = await supabase
        .from("tase_symbols")
        .select("ticker, name, name_he, override_name_he, logo_url")
        .in("ticker", tickers);
      return data || [];
    },
    enabled: tickers.length > 0,
  });

  const companyMap = new Map(
    (companies || []).map((c: any) => [c.ticker, c])
  );

  const hero = articles?.[0];
  const rest = articles?.slice(1) || [];

  const sentimentBadge = (sentiment: string | null) => {
    if (sentiment === "positive") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (sentiment === "negative") return "bg-red-500/15 text-red-400 border-red-500/30";
    return "bg-muted text-muted-foreground border-border";
  };

  return (
    <>
      <Helmet>
        <title>{isHe ? "חדשות שוק ההון | AlphaMap" : "Market News | AlphaMap"}</title>
        <meta
          name="description"
          content={
            isHe
              ? "ניתוחים מקצועיים וחדשות שוק ההון הישראלי מאת ארטיום מנדבורה, אנליסט שוק ההון ב-AlphaMap"
              : "Professional analysis and Israeli stock market news by Artium Mandvora, Market Analyst at AlphaMap"
          }
        />
        <link rel="canonical" href="https://alpha-map.com/news" />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "CollectionPage",
            name: isHe ? "חדשות שוק ההון" : "Market News",
            description: isHe
              ? "ניתוחים מקצועיים של שוק ההון הישראלי"
              : "Professional Israeli market analysis",
            url: "https://alpha-map.com/news",
          })}
        </script>
      </Helmet>

      <div className="container max-w-4xl py-8" dir={isHe ? "rtl" : "ltr"}>
        <h1 className="text-3xl font-bold mb-2">
          {isHe ? "חדשות שוק ההון" : "Market News"}
        </h1>
        <p className="text-muted-foreground mb-8">
          {isHe
            ? "ניתוחים מקצועיים מאת ארטיום מנדבורה, אנליסט שוק ההון"
            : "Professional analysis by Artium Mandvora, Market Analyst"}
        </p>

        {isLoading ? (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Card key={i}>
                <CardContent className="py-6 space-y-3">
                  <Skeleton className="h-6 w-3/4" />
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-2/3" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : !articles?.length ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              {isHe ? "אין חדשות כרגע" : "No news at the moment"}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {/* Hero article */}
            {hero && (
              <Link to={`/news/${hero.id}`} className="block">
                <Card className="rounded-2xl border-2 border-border/60 hover:border-primary/40 transition-all hover:shadow-lg">
                  <CardContent className="p-6 sm:p-8">
                    <div className="flex items-center gap-3 mb-4">
                      {hero.related_ticker && (() => {
                        const c = companyMap.get(hero.related_ticker);
                        return (
                          <StockLogo
                            name={c?.override_name_he || c?.name_he || c?.name || hero.related_ticker}
                            logoUrl={c?.logo_url}
                            size="md"
                          />
                        );
                      })()}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`text-xs ${sentimentBadge(hero.sentiment)}`}>
                          {hero.sentiment === "positive" ? (isHe ? "חיובי" : "Positive")
                            : hero.sentiment === "negative" ? (isHe ? "שלילי" : "Negative")
                            : (isHe ? "ניטרלי" : "Neutral")}
                        </Badge>
                        {hero.related_ticker && (
                          <Badge variant="outline" className="text-xs">{hero.related_ticker}.TA</Badge>
                        )}
                        {hero.published_at && (
                          <span className="text-xs text-muted-foreground">
                            {timeAgo(hero.published_at, isHe)}
                          </span>
                        )}
                      </div>
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-bold leading-tight mb-3">
                      {hero.ai_title_he}
                    </h2>
                    {hero.ai_summary_he && (
                      <p className="text-muted-foreground leading-relaxed">
                        {hero.ai_summary_he}
                      </p>
                    )}
                    <p className="text-xs text-muted-foreground mt-4">
                      {hero.author}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            )}

            {/* Article list */}
            <div className="space-y-2">
              {rest.map((article: any) => {
                const c = article.related_ticker ? companyMap.get(article.related_ticker) : null;
                const displayName = c?.override_name_he || c?.name_he || c?.name || article.related_ticker || "";

                return (
                  <Link key={article.id} to={`/news/${article.id}`} className="block">
                    <Card className="hover:bg-secondary/40 transition-colors">
                      <CardContent className="flex items-center gap-3 py-3 px-4">
                        {article.related_ticker && (
                          <StockLogo
                            name={displayName}
                            logoUrl={c?.logo_url}
                            size="sm"
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium leading-snug line-clamp-1">
                            {article.ai_title_he}
                          </p>
                          {article.ai_summary_he && (
                            <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                              {article.ai_summary_he}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <Badge variant="outline" className={`text-[10px] ${sentimentBadge(article.sentiment)}`}>
                            {article.sentiment === "positive" ? "+" : article.sentiment === "negative" ? "−" : "~"}
                          </Badge>
                          {article.published_at && (
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                              {timeAgo(article.published_at, isHe)}
                            </span>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
