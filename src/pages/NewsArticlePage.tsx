import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Helmet } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

export default function NewsArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const isHe = lang === "he";

  const { data: article, isLoading } = useQuery({
    queryKey: ["news-article", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("news_articles")
        .select("*")
        .eq("id", id!)
        .eq("status", "published")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="container max-w-3xl py-12 space-y-4">
        <Skeleton className="h-8 w-3/4" />
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!article) {
    return (
      <div className="container max-w-3xl py-12 text-center">
        <h1 className="text-2xl font-bold mb-4">{isHe ? "כתבה לא נמצאה" : "Article not found"}</h1>
        <Link to="/news" className="text-primary hover:underline">
          {isHe ? "חזרה לחדשות" : "Back to news"}
        </Link>
      </div>
    );
  }

  const title = article.ai_title_he || article.original_title;
  const summary = article.ai_summary_he;
  const body = article.ai_body_he || article.content || "";
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString(isHe ? "he-IL" : "en-US", {
        year: "numeric", month: "long", day: "numeric",
      })
    : "";

  const sentimentColor = article.sentiment === "positive"
    ? "text-green-500"
    : article.sentiment === "negative"
    ? "text-red-500"
    : "text-muted-foreground";

  const sentimentLabel = article.sentiment === "positive"
    ? (isHe ? "חיובי" : "Positive")
    : article.sentiment === "negative"
    ? (isHe ? "שלילי" : "Negative")
    : (isHe ? "ניטרלי" : "Neutral");

  const articleImageUrl = (article as any).image_url as string | null;
  const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${article.id}`;

  return (
    <>
      <Helmet>
        <title>{title} | AlphaMap</title>
        <meta name="description" content={summary || title} />
        <link rel="canonical" href={`https://alpha-map.com/news/${article.id}`} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={summary || title} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={`https://alpha-map.com/news/${article.id}`} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={summary || title} />
        <meta name="twitter:image" content={ogImageUrl} />
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "NewsArticle",
            headline: title,
            description: summary,
            author: { "@type": "Person", name: article.author },
            datePublished: article.published_at,
            publisher: { "@type": "Organization", name: "AlphaMap" },
            url: `https://alpha-map.com/news/${article.id}`,
          })}
        </script>
      </Helmet>

      <div className="container max-w-3xl py-8 animate-fade-in" dir={isHe ? "rtl" : "ltr"}>
        <Link to="/news" className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1 mb-6">
          <ArrowRight className="h-3.5 w-3.5" />
          {isHe ? "חזרה לחדשות" : "Back to news"}
        </Link>

        <article>
          <h1 className="font-display text-2xl sm:text-3xl font-bold leading-tight mb-4">
            {title}
          </h1>

          <div className="flex items-center gap-3 text-sm text-muted-foreground mb-6 flex-wrap">
            {publishedDate && (
              <span className="flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {publishedDate}
              </span>
            )}
            <span>·</span>
            <span>{article.author}</span>
            {article.related_ticker && (
              <>
                <span>·</span>
                <Link to={`/stock/${article.related_ticker}`} className="hover:text-primary transition-colors">
                  {article.related_ticker}.TA
                </Link>
              </>
            )}
            <Badge variant="outline" className={`text-xs ${sentimentColor}`}>
              {sentimentLabel}
            </Badge>
          </div>

          {summary && (
            <div className="rounded-lg border bg-secondary/30 p-4 mb-6">
              <p className="text-sm leading-relaxed whitespace-pre-line">{summary}</p>
            </div>
          )}

          <div className="prose prose-sm max-w-none">
            <p className="text-sm leading-relaxed whitespace-pre-line font-serif text-foreground/90">
              {body}
            </p>
          </div>
        </article>
      </div>
    </>
  );
}
