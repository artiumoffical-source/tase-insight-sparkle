import { useLanguage } from "@/hooks/useLanguage";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Lock, ExternalLink, Globe, Languages } from "lucide-react";
import { useState } from "react";
import AdSlot from "@/components/AdSlot";

export interface NewsArticle {
  title: string;
  titleHe: string;
  content: string;
  contentHe: string;
  url: string;
  source: string;
  date: string;
  image: string | null;
  sentiment: number;
}

interface NewsReaderModalProps {
  article: NewsArticle | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isPremium: boolean;
  onUpgrade: () => void;
}

export default function NewsReaderModal({ article, open, onOpenChange, isPremium, onUpgrade }: NewsReaderModalProps) {
  const { t, isRtl } = useLanguage();
  const [showHebrew, setShowHebrew] = useState(true);

  if (!article) return null;

  const displayTitle = showHebrew && article.titleHe ? article.titleHe : article.title;
  const displayContent = showHebrew && article.contentHe ? article.contentHe : article.content;
  const hasTranslation = !!article.titleHe;

  const formattedDate = (() => {
    try {
      return new Date(article.date).toLocaleDateString(isRtl ? "he-IL" : "en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return article.date;
    }
  })();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side={isRtl ? "left" : "right"}
        className="w-full sm:max-w-2xl overflow-y-auto p-0"
      >
        {/* Featured Image */}
        {article.image && (
          <div className="w-full h-48 sm:h-64 overflow-hidden bg-muted">
            <img
              src={article.image}
              alt=""
              className="w-full h-full object-cover"
              onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
            />
          </div>
        )}

        <div className="px-6 pt-6 pb-8" dir={showHebrew ? "rtl" : "ltr"}>
          <SheetHeader className="mb-6">
            {/* Translation Toggle & Source */}
            <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
              {hasTranslation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowHebrew(!showHebrew)}
                  className="text-xs gap-1.5"
                >
                  <Languages className="h-3.5 w-3.5" />
                  {showHebrew ? "הצג מקור (אנגלית)" : "הצג תרגום (עברית)"}
                </Button>
              )}
            </div>

            {/* Title */}
            <SheetTitle className="font-display text-xl sm:text-2xl leading-tight font-bold tracking-tight">
              {displayTitle}
            </SheetTitle>

            {/* Meta */}
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-3 flex-wrap">
              <span className="flex items-center gap-1">
                <Globe className="h-3 w-3" />
                {article.source}
              </span>
              <span>·</span>
              <span>{formattedDate}</span>
            </div>
          </SheetHeader>

          {/* Sponsored Ad */}
          <div className="mb-6">
            <AdSlot placement="banner" className="!h-[60px]" />
          </div>

          {/* Content */}
          <div className="relative">
            {isPremium ? (
              <article className="prose prose-sm prose-invert max-w-none">
                <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-serif">
                  {displayContent || t("news.noContent")}
                </p>
              </article>
            ) : (
              <>
                {/* Free users see blurred content */}
                <div className="relative">
                  <article className="prose prose-sm prose-invert max-w-none blur-md select-none pointer-events-none">
                    <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-line font-serif">
                      {displayContent || t("news.noContent")}
                    </p>
                  </article>
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-card/40 backdrop-blur-[1px] rounded-lg">
                    <Lock className="h-6 w-6 text-primary" />
                    <p className="text-sm font-medium text-center max-w-xs">
                      {t("news.upgradeReader")}
                    </p>
                    <Button size="sm" onClick={onUpgrade} className="gap-1.5">
                      <Lock className="h-3 w-3" />
                      {t("news.upgradeCta")}
                    </Button>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* External link */}
          <div className="mt-6 pt-4 border-t">
            <a
              href={article.url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-muted-foreground hover:text-primary transition-colors flex items-center gap-1.5"
            >
              <ExternalLink className="h-3 w-3" />
              {t("news.readOriginal")}
            </a>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
