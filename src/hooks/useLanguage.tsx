import { createContext, useContext, useState, useEffect, ReactNode } from "react";

type Language = "he" | "en";

interface LanguageContextType {
  lang: Language;
  setLang: (lang: Language) => void;
  t: (key: string) => string;
  isRtl: boolean;
}

const translations: Record<Language, Record<string, string>> = {
  he: {
    // Navbar
    "nav.home": "דף הבית",
    "nav.watchlist": "רשימת מעקב",
    "nav.signOut": "התנתק",
    "nav.signIn": "התחבר",
    "nav.brand": "TASE Insight",

    // Homepage hero
    "hero.badge": "נתוני TASE בזמן אמת",
    "hero.title1": "מודיעין שוק ישראלי,",
    "hero.title2": "בפשטות",
    "hero.subtitle": "נתונים פיננסיים, גרפים אינטראקטיביים ורשימות מעקב לכל מניה בבורסת תל אביב.",
    "search.placeholder": "חפש לפי שם חברה או טיקר...",

    // Features
    "feature.financials.title": "דוחות כספיים 5 שנים",
    "feature.financials.desc": "הכנסות, רווח ומאזן במבט אחד",
    "feature.charts.title": "גרפים אינטראקטיביים",
    "feature.charts.desc": "גרפי TradingView לכל מניה בבורסה",
    "feature.watchlist.title": "רשימת מעקב אישית",
    "feature.watchlist.desc": "עקוב אחרי המניות האהובות עליך במקום אחד",

    // Trending
    "trending.title": "📈 מניות מובילות בבורסה",
    "trending.priceUnavailable": "מחיר לא זמין",

    // Stock page
    "stock.historicalData": "דוחות כספיים היסטוריים (5 שנים)",
    "stock.mockData": "נתוני דמו",
    "stock.marketCap": "שווי שוק",
    "stock.signInWatchlist": "התחבר כדי להשתמש ברשימת מעקב",
    "stock.addedWatchlist": "נוסף לרשימת מעקב",
    "stock.removedWatchlist": "הוסר מרשימת מעקב",
    "stock.loading": "טוען…",
    "stock.failedLoad": "טעינת נתונים פיננסיים נכשלה",
    "stock.noData": "אין נתונים פיננסיים זמינים.",

    // Financials table
    "fin.year": "שנה",
    "fin.revenue": "הכנסות",
    "fin.grossProfit": "רווח גולמי",
    "fin.operatingIncome": "רווח תפעולי",
    "fin.netIncome": "רווח נקי",
    "fin.deRatio": "יחס חוב/הון",
    "fin.cash": "מזומנים ושווי מזומנים",

    // Watchlist page
    "watchlist.title": "רשימת המעקב שלי",
    "watchlist.empty": "רשימת המעקב שלך ריקה.",
    "watchlist.discover": "גלה מניות",
    "watchlist.ticker": "טיקר",
    "watchlist.name": "שם",
    "watchlist.actions": "פעולות",
    "watchlist.removed": "הוסר מרשימת מעקב",

    // Auth page
    "auth.createAccount": "יצירת חשבון",
    "auth.welcomeBack": "ברוך שובך",
    "auth.signUpDesc": "הרשם כדי להתחיל לעקוב אחרי מניות",
    "auth.signInDesc": "התחבר לחשבון שלך",
    "auth.continueGoogle": "המשך עם Google",
    "auth.or": "או",
    "auth.email": "אימייל",
    "auth.password": "סיסמה",
    "auth.signUp": "הרשמה",
    "auth.signIn": "התחברות",
    "auth.loading": "טוען...",
    "auth.hasAccount": "כבר יש לך חשבון?",
    "auth.noAccount": "אין לך חשבון?",
    "auth.checkEmail": "בדוק את האימייל שלך לאישור החשבון",

    // Ad
    "ad.space": "מקום לפרסום",

    // 404
    "notFound.title": "404",
    "notFound.message": "אופס! הדף לא נמצא",
    "notFound.back": "חזרה לדף הבית",
  },
  en: {
    "nav.home": "Home",
    "nav.watchlist": "Watchlist",
    "nav.signOut": "Sign Out",
    "nav.signIn": "Sign In",
    "nav.brand": "TASE Insight",

    "hero.badge": "Live TASE Data",
    "hero.title1": "Israeli Market Intelligence,",
    "hero.title2": "Simplified",
    "hero.subtitle": "Financial data, interactive charts, and watchlists for every stock on the Tel Aviv Stock Exchange.",
    "search.placeholder": "Search by company name or ticker...",

    "feature.financials.title": "5-Year Financials",
    "feature.financials.desc": "Revenue, profit, and balance sheet data at a glance",
    "feature.charts.title": "Interactive Charts",
    "feature.charts.desc": "TradingView-powered charts for every TASE stock",
    "feature.watchlist.title": "Personal Watchlist",
    "feature.watchlist.desc": "Track your favourite stocks in one place",

    "trending.title": "📈 Trending TASE Stocks",
    "trending.priceUnavailable": "Price unavailable",

    "stock.historicalData": "Historical Financials (5Y)",
    "stock.mockData": "Mock Data",
    "stock.marketCap": "Market Cap",
    "stock.signInWatchlist": "Sign in to use watchlists",
    "stock.addedWatchlist": "Added to watchlist",
    "stock.removedWatchlist": "Removed from watchlist",
    "stock.loading": "Loading…",
    "stock.failedLoad": "Failed to load financial data",
    "stock.noData": "No financial data available.",

    "fin.year": "Year",
    "fin.revenue": "Revenue",
    "fin.grossProfit": "Gross Profit",
    "fin.operatingIncome": "Operating Inc.",
    "fin.netIncome": "Net Income",
    "fin.deRatio": "D/E Ratio",
    "fin.cash": "Cash & Equiv.",

    "watchlist.title": "My Watchlist",
    "watchlist.empty": "Your watchlist is empty.",
    "watchlist.discover": "Discover Stocks",
    "watchlist.ticker": "Ticker",
    "watchlist.name": "Name",
    "watchlist.actions": "Actions",
    "watchlist.removed": "Removed from watchlist",

    "auth.createAccount": "Create Account",
    "auth.welcomeBack": "Welcome Back",
    "auth.signUpDesc": "Sign up to start tracking stocks",
    "auth.signInDesc": "Sign in to your account",
    "auth.continueGoogle": "Continue with Google",
    "auth.or": "or",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signUp": "Sign Up",
    "auth.signIn": "Sign In",
    "auth.loading": "Loading...",
    "auth.hasAccount": "Already have an account?",
    "auth.noAccount": "Don't have an account?",
    "auth.checkEmail": "Check your email to confirm your account",

    "ad.space": "Ad Space",

    "notFound.title": "404",
    "notFound.message": "Oops! Page not found",
    "notFound.back": "Return to Home",
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const saved = localStorage.getItem("lang");
    return (saved === "en" || saved === "he") ? saved : "he";
  });

  const setLang = (l: Language) => {
    setLangState(l);
    localStorage.setItem("lang", l);
  };

  const t = (key: string) => translations[lang][key] ?? key;
  const isRtl = lang === "he";

  useEffect(() => {
    document.documentElement.dir = isRtl ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang, isRtl]);

  return (
    <LanguageContext.Provider value={{ lang, setLang, t, isRtl }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
}
