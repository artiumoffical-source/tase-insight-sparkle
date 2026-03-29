import { useLanguage } from "@/hooks/useLanguage";

export default function PrivacyPage() {
  const { t, isRtl } = useLanguage();

  return (
    <div className="container max-w-3xl py-12 px-4" dir={isRtl ? "rtl" : "ltr"}>
      <h1 className="font-display text-3xl font-bold mb-8 text-foreground">
        {t("privacy.title")}
      </h1>
      <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        <p>{t("privacy.intro")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("privacy.collectTitle")}</h2>
        <p>{t("privacy.collectBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("privacy.cookiesTitle")}</h2>
        <p>{t("privacy.cookiesBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("privacy.manageCookiesTitle")}</h2>
        <p>{t("privacy.manageCookiesBody")}</p>

        <h2 className="text-xl font-semibold text-foreground">{t("privacy.securityTitle")}</h2>
        <p>{t("privacy.securityBody")}</p>
      </div>
    </div>
  );
}
