import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { CalendarDays, TrendingUp } from "lucide-react";

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
            url: "https://tase-insight-sparkle.lovable.app/news",
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
            {articles.map((article: any) => (
              <article key={article.id}>
                <Link to={`/news/${article.id}`} className="block">
                  <Card className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="secondary" className={article.category === "macro" ? "bg-blue-600 text-white" : "bg-muted"}>
                          {article.category === "macro" ? "מאקרו וכלכלה" : "מניות"}
                        </Badge>
                        {article.related_ticker && (
                          <Badge variant="outline">
                            <TrendingUp className="h-3 w-3 mr-1" />
                            {article.related_ticker}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <CalendarDays className="h-3 w-3" />
                          {article.published_at
                            ? new Date(article.published_at).toLocaleDateString(
                                isHe ? "he-IL" : "en-US",
                                { year: "numeric", month: "long", day: "numeric" }
                              )
                            : ""}
                        </span>
                      </div>
                      <CardTitle className="text-xl leading-tight">
                        {article.ai_title_he}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">
                        {article.ai_summary_he}
                      </p>
                      <p className="text-xs text-muted-foreground mt-3 pt-3 border-t">
                        מאת: {article.author}
                      </p>
                    </CardContent>
                  </Card>
                </Link>
              </article>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
