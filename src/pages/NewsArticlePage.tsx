import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/hooks/useLanguage";
import { Helmet } from "react-helmet-async";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CalendarDays, ArrowRight, Share2, Copy, Check } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import StockLogo from "@/components/StockLogo";
import { useState } from "react";

function timeAgo(dateStr: string, isHe: boolean): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return isHe ? `לפני ${mins} דקות` : `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return isHe ? `לפני ${hours} שעות` : `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return isHe ? `לפני ${days} ימים` : `${days}d ago`;
  return new Date(dateStr).toLocaleDateString(isHe ? "he-IL" : "en-US", {
    year: "numeric", month: "long", day: "numeric",
  });
}

export default function NewsArticlePage() {
  const { id } = useParams<{ id: string }>();
  const { lang } = useLanguage();
  const isHe = lang === "he";
  const [copied, setCopied] = useState(false);

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

  const { data: company } = useQuery({
    queryKey: ["news-company", article?.related_ticker],
    queryFn: async () => {
      const { data } = await supabase
        .from("tase_symbols")
        .select("ticker, name, name_he, override_name_he, logo_url")
        .eq("ticker", article!.related_ticker!)
        .maybeSingle();
      return data;
    },
    enabled: !!article?.related_ticker,
  });

  const { data: relatedArticles } = useQuery({
    queryKey: ["related-articles", article?.related_ticker, id],
    queryFn: async () => {
      const { data } = await supabase
        .from("news_articles")
        .select("id, ai_title_he, published_at, image_url, related_ticker")
        .eq("status", "published")
        .eq("related_ticker", article!.related_ticker!)
        .neq("id", id!)
        .order("published_at", { ascending: false })
        .limit(3);
      return data || [];
    },
    enabled: !!article?.related_ticker && !!id,
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
  const bodyParagraphs = body.split("\n").filter((p: string) => p.trim());
  const publishedDate = article.published_at
    ? new Date(article.published_at).toLocaleDateString(isHe ? "he-IL" : "en-US", {
        year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
      })
    : "";

  const sentimentColor = article.sentiment === "positive"
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : article.sentiment === "negative"
    ? "bg-red-500/15 text-red-400 border-red-500/30"
    : "bg-muted text-muted-foreground border-border";

  const sentimentLabel = article.sentiment === "positive"
    ? (isHe ? "חיובי" : "Positive")
    : article.sentiment === "negative"
    ? (isHe ? "שלילי" : "Negative")
    : (isHe ? "ניטרלי" : "Neutral");

  const articleUrl = `https://alpha-map.com/news/${article.id}`;
  const ogImageUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-og-image?id=${article.id}`;
  const companyDisplayName = company?.override_name_he || company?.name_he || company?.name || article.related_ticker || "";

  const handleCopy = () => {
    navigator.clipboard.writeText(articleUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const shareWhatsApp = `https://wa.me/?text=${encodeURIComponent(`${title}\n${articleUrl}`)}`;
  const shareLinkedIn = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(articleUrl)}`;
  const shareX = `https://twitter.com/intent/tweet?text=${encodeURIComponent(title)}&url=${encodeURIComponent(articleUrl)}`;

  return (
    <>
      <Helmet>
        <title>{title} | AlphaMap</title>
        <meta name="description" content={summary || title} />
        <link rel="canonical" href={articleUrl} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={summary || title} />
        <meta property="og:type" content="article" />
        <meta property="og:url" content={articleUrl} />
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
            url: articleUrl,
          })}
        </script>
      </Helmet>

      {/* Sticky breadcrumb bar */}
      <div className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-md">
        <div className="container max-w-3xl flex items-center justify-between py-3">
          <Link
            to="/news"
            className="text-sm text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
          >
            <ArrowRight className="h-3.5 w-3.5" />
            {isHe ? "חדשות שוק ההון" : "Market News"}
          </Link>
          <Button variant="ghost" size="sm" onClick={handleCopy} className="gap-1.5">
            {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
            {copied ? (isHe ? "הועתק" : "Copied") : (isHe ? "שתף" : "Share")}
          </Button>
        </div>
      </div>

      <div className="container max-w-3xl py-8 animate-fade-in" dir={isHe ? "rtl" : "ltr"}>
        <article>
          {/* Sentiment badge */}
          <div className="mb-4">
            <Badge variant="outline" className={`text-xs ${sentimentColor}`}>
              {sentimentLabel}
            </Badge>
          </div>

          {/* Title */}
          <h1 className="font-display text-3xl sm:text-4xl font-bold leading-tight mb-6">
            {title}
          </h1>

          {/* Summary lead */}
          {summary && (
            <div className="border-r-4 border-primary pr-4 mb-6">
              <p className="text-base text-muted-foreground leading-relaxed">{summary}</p>
            </div>
          )}

          {/* Author bar */}
          <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary/20 text-primary text-sm font-bold">א</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <p className="text-sm font-medium">{article.author}</p>
              <p className="text-xs text-muted-foreground">
                {isHe ? "אנליסט שוק ההון, AlphaMap" : "Market Analyst, AlphaMap"}
              </p>
            </div>
            {publishedDate && (
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3.5 w-3.5" />
                {publishedDate}
              </span>
            )}
          </div>

          {/* Company hero card */}
          {article.related_ticker && (
            <Card className="mb-8 bg-secondary/30 border-border/50">
              <CardContent className="flex items-center gap-4 py-4">
                <StockLogo
                  name={companyDisplayName}
                  logoUrl={company?.logo_url}
                  size="lg"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-lg truncate">{companyDisplayName}</p>
                  <p className="text-sm text-muted-foreground">{article.related_ticker}.TA</p>
                </div>
                <Link to={`/stock/${article.related_ticker}`}>
                  <Button variant="outline" size="sm" className="gap-1.5 whitespace-nowrap">
                    {isHe ? "לדף המניה" : "Stock Page"}
                    <ArrowRight className="h-3.5 w-3.5 rotate-180" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}

          {/* Body */}
          <div className="space-y-4 mb-10">
            {bodyParagraphs.map((p: string, i: number) => (
              <p key={i} className="text-sm leading-relaxed text-foreground/90">
                {p}
              </p>
            ))}
          </div>

          {/* Share buttons */}
          <div className="flex items-center gap-2 py-6 border-t border-b border-border mb-10">
            <span className="text-xs text-muted-foreground ml-2">
              {isHe ? "שתף:" : "Share:"}
            </span>
            <a href={shareWhatsApp} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">WhatsApp</Button>
            </a>
            <a href={shareLinkedIn} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">LinkedIn</Button>
            </a>
            <a href={shareX} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm" className="text-xs gap-1.5">X</Button>
            </a>
            <Button variant="outline" size="sm" className="text-xs gap-1.5" onClick={handleCopy}>
              {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
              {isHe ? "העתק קישור" : "Copy link"}
            </Button>
          </div>

          {/* Related articles */}
          {relatedArticles && relatedArticles.length > 0 && (
            <section>
              <h2 className="text-lg font-bold mb-4">
                {isHe ? "כתבות נוספות" : "Related Articles"}
              </h2>
              <div className="space-y-3">
                {relatedArticles.map((ra: any) => (
                  <Link key={ra.id} to={`/news/${ra.id}`}>
                    <Card className="hover:bg-secondary/40 transition-colors">
                      <CardContent className="flex items-center gap-3 py-3">
                        {ra.image_url && (
                          <img
                            src={ra.image_url}
                            alt=""
                            className="h-8 w-8 rounded-full object-contain bg-muted p-1 shrink-0"
                            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                          />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{ra.ai_title_he}</p>
                          {ra.published_at && (
                            <p className="text-xs text-muted-foreground">
                              {timeAgo(ra.published_at, isHe)}
                            </p>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </article>
      </div>
    </>
  );
}
