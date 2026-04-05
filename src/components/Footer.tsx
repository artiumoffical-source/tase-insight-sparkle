import { Link } from "react-router-dom";
import { useLanguage } from "@/hooks/useLanguage";

export default function Footer() {
  const { t, isRtl, lang } = useLanguage();

  return (
    <footer className="border-t bg-card/50 mt-16" dir={isRtl ? "rtl" : "ltr"}>
      <div className="container flex flex-col sm:flex-row items-center justify-between gap-3 py-6 text-xs text-muted-foreground">
        <span>© {new Date().getFullYear()} AlphaMap. {t("footer.rights")}</span>
        <div className="flex items-center gap-4">
          <Link to="/terms" className="hover:text-foreground transition-colors">
            {lang === "he" ? "תנאי שימוש ופרטיות" : "Terms & Privacy"}
          </Link>
        </div>
      </div>
    </footer>
  );
}
