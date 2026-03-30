import SearchBar from "@/components/SearchBar";
import NativeTickerTape from "@/components/NativeTickerTape";
import NativeMarketTables from "@/components/NativeMarketTables";
import AdSlot from "@/components/AdSlot";
import HomeSEO from "@/components/HomeSEO";
import { useLanguage } from "@/hooks/useLanguage";
import { Compass, TrendingUp, Shield } from "lucide-react";

export default function Index() {
  const { t } = useLanguage();

  const FEATURES = [
    { icon: TrendingUp, title: t("feature.financials.title"), desc: t("feature.financials.desc") },
    { icon: Compass, title: t("feature.charts.title"), desc: t("feature.charts.desc") },
    { icon: Shield, title: t("feature.watchlist.title"), desc: t("feature.watchlist.desc") },
  ];

  return (
    <div className="flex flex-col items-center">
      <NativeTickerTape />

      <section className="flex flex-col items-center justify-center gap-8 px-4 pt-20 pb-16 text-center">
        <div className="flex items-center gap-2 rounded-full border bg-secondary px-4 py-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-gain animate-pulse" />
          {t("hero.badge")}
        </div>
        <h1 className="font-display text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl max-w-3xl leading-tight">
          {t("hero.title1")}{" "}
          <span className="text-primary">{t("hero.title2")}</span>
        </h1>
        <p className="max-w-lg text-muted-foreground text-lg">
          {t("hero.subtitle")}
        </p>
        <SearchBar />
      </section>

      <section className="pb-12 w-full flex justify-center">
        <NativeMarketTables />
      </section>

      <section className="grid gap-4 px-4 pb-16 sm:grid-cols-3 max-w-4xl w-full">
        {FEATURES.map((f) => (
          <div key={f.title} className="rounded-xl border bg-card p-6 flex flex-col gap-3 animate-fade-in">
            <f.icon className="h-6 w-6 text-primary" />
            <h3 className="font-display font-semibold">{f.title}</h3>
            <p className="text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </section>

      <div className="w-full max-w-4xl px-4 pb-12">
        <AdSlot placement="banner" />
      </div>
    </div>
  );
}
