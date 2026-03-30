import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/hooks/useLanguage";
import { signOut } from "@/lib/supabase-helpers";
import { Button } from "@/components/ui/button";
import { Compass, Star, LogOut, User, Globe, CalendarDays, Newspaper } from "lucide-react";

export default function Navbar() {
  const { user, loading } = useAuth();
  const { lang, setLang, t } = useLanguage();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const toggleLang = () => setLang(lang === "he" ? "en" : "he");

  return (
    <nav className="sticky top-0 z-50 border-b bg-card/80 backdrop-blur-md">
      <div className="container flex h-14 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
          <Compass className="h-5 w-5 text-primary" />
          <span className="bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">AlphaMap</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={toggleLang} className="flex items-center gap-1.5 text-xs">
            <Globe className="h-3.5 w-3.5" />
            {lang === "he" ? "ENG" : "עבר"}
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <Link to="/">{t("nav.home")}</Link>
          </Button>

          <Button variant="ghost" size="sm" asChild>
            <Link to="/calendar" className="flex items-center gap-1.5">
              <CalendarDays className="h-3.5 w-3.5" />
              {t("nav.calendar")}
            </Link>
          </Button>

          {user && (
            <Button variant="ghost" size="sm" asChild>
              <Link to="/watchlist" className="flex items-center gap-1.5">
                <Star className="h-3.5 w-3.5" />
                {t("nav.watchlist")}
              </Link>
            </Button>
          )}

          {loading ? null : user ? (
            <Button variant="ghost" size="sm" onClick={handleSignOut} className="flex items-center gap-1.5">
              <LogOut className="h-3.5 w-3.5" />
              {t("nav.signOut")}
            </Button>
          ) : (
            <Button size="sm" asChild>
              <Link to="/auth" className="flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" />
                {t("nav.signIn")}
              </Link>
            </Button>
          )}
        </div>
      </div>
    </nav>
  );
}
