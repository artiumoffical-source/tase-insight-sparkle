import { useLanguage } from "@/hooks/useLanguage";

export default function TermsPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="container max-w-3xl py-12 px-4" dir={isRtl ? "rtl" : "ltr"}>
      <h1 className="font-display text-3xl font-bold mb-8 text-foreground">
        {t("terms.title")}
      </h1>
      <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <p>{t("terms.intro")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("terms.hostingTitle")}</h2>
        <p>{t("terms.hostingBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("terms.noAdviceTitle")}</h2>
        <p>{t("terms.noAdviceBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("terms.accuracyTitle")}</h2>
        <p>{t("terms.accuracyBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("terms.ipTitle")}</h2>
        <p>{t("terms.ipBody")}</p>
      </div>
    </div>
  );
}
