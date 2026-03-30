import { Helmet } from "react-helmet-async";

interface StockPageSEOProps {
  ticker: string;
  nameHe: string;
  nameEn: string;
  price?: number | null;
  change?: number | null;
  currency?: string;
}

export default function StockPageSEO({ ticker, nameHe, nameEn, price, change, currency = "ILS" }: StockPageSEOProps) {
  const title = `מניית ${nameHe} (${ticker}) | ניתוח דוחות, גרף ונתוני עומק בזמן אמת - AlphaMap`;
  const description = `עקבו אחרי מניית ${nameHe} בזמן אמת. ניתוח דוחות כספיים מעמיק (Deep Dive), מכפילים, יחסי נזילות ונתוני בורסת תל אביב. הכלי המתקדם ביותר לאנליסטים.`;
  const url = `https://tase-insight-sparkle.lovable.app/stock/${ticker}.TA`;
  const ogImage = "https://tase-insight-sparkle.lovable.app/og-alphamap.png";

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FinancialProduct",
    name: nameHe,
    alternateName: nameEn,
    tickerSymbol: ticker,
    exchange: "TASE",
    url,
    ...(price != null && {
      offers: {
        "@type": "Offer",
        price: price.toString(),
        priceCurrency: currency,
      },
    }),
  };

  return (
    <Helmet>
      <html lang="he" dir="rtl" />
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={url} />

      {/* Open Graph */}
      <meta property="og:type" content="website" />
      <meta property="og:title" content={`ניתוח מניית ${nameHe} ב-AlphaMap`} />
      <meta property="og:description" content={`צפו בנתוני העומק והדוחות הכספיים של ${nameHe}.`} />
      <meta property="og:url" content={url} />
      <meta property="og:image" content={ogImage} />
      <meta property="og:locale" content="he_IL" />
      <meta property="og:site_name" content="AlphaMap" />

      {/* Twitter / X */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={`ניתוח מניית ${nameHe} ב-AlphaMap`} />
      <meta name="twitter:description" content={`צפו בנתוני העומק והדוחות הכספיים של ${nameHe}.`} />
      <meta name="twitter:image" content={ogImage} />

      {/* JSON-LD */}
      <script type="application/ld+json">{JSON.stringify(jsonLd)}</script>
    </Helmet>
  );
}
