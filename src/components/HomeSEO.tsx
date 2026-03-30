import { Helmet } from "react-helmet-async";

export default function HomeSEO() {
  const title = "AlphaMap | ניתוח פיננסי מקצועי לבורסת תל אביב";
  const description = "נתונים מקצועיים, תובנות בזמן אמת ומודיעין פיננסי מעמיק לשוק ההון הישראלי. דוחות כספיים, מכפילים ויחסי נזילות למניות ת\"א 125.";
  const url = "https://tase-insight-sparkle.lovable.app/";
  const ogImage = "https://tase-insight-sparkle.lovable.app/og-alphamap.png";

  return (
    <Helmet>
      <html lang="he" dir="rtl" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      <meta property="og:type" content="website" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="he_IL" />
      <meta property="og:site_name" content="AlphaMap" />

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={title} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={ogImage} />

      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebSite",
          name: "AlphaMap",
          url,
          description,
          inLanguage: "he",
        })}
      </script>
    </Helmet>
  );
}
