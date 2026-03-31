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
    "nav.brand": "AlphaMap",

    // Homepage hero
    "hero.badge": "נתוני בורסה בזמן אמת",
    "hero.title1": "נווט בשווקים עם",
    "hero.title2": "AlphaMap",
    "hero.subtitle": "נתונים מקצועיים, תובנות בזמן אמת ומודיעין פיננסי גלובלי.",
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
    "trending.gainers": "המרוויחות",
    "trending.losers": "המפסידות",
    "trending.priceUnavailable": "אין נתונים זמינים כרגע",
    "trending.marketOpen": "הבורסה פתוחה",
    "trending.marketClosed": "הבורסה סגורה",
    "trending.lastTradingDay": "נתונים מיום המסחר האחרון",

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
    "fin.annual": "שנתי",
    "fin.quarterly": "רבעוני",
    "fin.metric": "מדד",
    "fin.incomeStatement": "רווח והפסד",
    "fin.balanceSheet": "מאזן",
    "fin.cashFlow": "תזרים מזומנים",
    "fin.costOfRevenue": "עלות הכנסות",
    "fin.ebitda": "EBITDA",
    "fin.eps": "רווח למניה (EPS)",
    "fin.totalAssets": "סך נכסים",
    "fin.totalLiabilities": "סך התחייבויות",
    "fin.totalEquity": "הון עצמי",
    "fin.cashBs": "מזומנים",
    "fin.totalDebt": "סך חוב",
    "fin.inventory": "מלאי",
    "fin.depreciation": "פחת והפחתות",
    "fin.capex": "הוצאות הון (CapEx)",
    "fin.freeCashFlow": "תזרים מזומנים חופשי",
    "fin.cashFromOps": "תזרים מפעילות שוטפת",
    "fin.interestIncome": "הכנסות ריבית",
    "fin.nonInterestIncome": "הכנסות שאינן ריבית",
    "fin.netPremiumsEarned": "פרמיות נטו שהורווחו",
    "fin.totalDeposits": "סך פיקדונות",
    "fin.totalInvestments": "סך השקעות",
    "fin.researchDev": "מחקר ופיתוח (R&D)",
    "fin.yoyGrowth": "שינוי שנתי",
    "fin.exportExcel": "ייצוא לאקסל",
    "fin.solvencyRatios": "יחסי נזילות ואשראי",
    "fin.currentRatio": "יחס שוטף",
    "fin.quickRatio": "יחס מהיר",

    // Deep Dive Financials
    "deepdive.title": "ניתוח מאזן מעמיק",
    "deepdive.commonSize": "% מהסך",
    "deepdive.verified": "✓ סכום הרכיבים תואם לסך",
    "deepdive.checksumMismatch": "⚠ פער בין סך הרכיבים לסך הכולל",
    "deepdive.unavailable": "פירוט מפורט לא זמין",
    "deepdive.totalAssets": "סך נכסים",
    "deepdive.totalCurrentAssets": "נכסים שוטפים",
    "deepdive.cash": "מזומנים ושווי מזומנים",
    "deepdive.shortTermInvestments": "השקעות לטווח קצר",
    "deepdive.netReceivables": "חייבים נטו",
    "deepdive.inventory": "מלאי",
    "deepdive.otherCurrentAssets": "נכסים שוטפים אחרים",
    "deepdive.nonCurrentAssets": "נכסים לא שוטפים",
    "deepdive.ppe": "רכוש קבוע נטו",
    "deepdive.longTermInvestments": "השקעות לטווח ארוך",
    "deepdive.goodwill": "מוניטין",
    "deepdive.intangibleAssets": "נכסים בלתי מוחשיים",
    "deepdive.otherNonCurrentAssets": "נכסים לא שוטפים אחרים",
    "deepdive.totalLiabilities": "סך התחייבויות",
    "deepdive.totalCurrentLiabilities": "התחייבויות שוטפות",
    "deepdive.accountsPayable": "זכאים וספקים",
    "deepdive.shortTermDebt": "חוב לטווח קצר",
    "deepdive.otherCurrentLiabilities": "התחייבויות שוטפות אחרות",
    "deepdive.nonCurrentLiabilities": "התחייבויות לא שוטפות",
    "deepdive.longTermDebt": "חוב לטווח ארוך",
    "deepdive.otherNonCurrentLiabilities": "התחייבויות לא שוטפות אחרות",
    "deepdive.totalEquity": "הון עצמי",
    "deepdive.commonStock": "הון מניות",
    "deepdive.retainedEarnings": "עודפים",
    "deepdive.otherEquity": "הון אחר",
    "deepdive.minorityInterest": "זכויות מיעוט",

    "upgrade.title": "הצטרף ל-AlphaMap Premium",
    "upgrade.subtitle": "פתח גישה לנתונים רבעוניים, הסר פרסומות וקבל תובנות מתקדמות.",
    "upgrade.feat1": "דוחות כספיים רבעוניים",
    "upgrade.feat2": "חוויה ללא פרסומות",
    "upgrade.feat3": "תובנות וניתוחים מתקדמים",
    "upgrade.signUpLogin": "הרשמה / התחברות",
    "upgrade.stripeSoon": "שלם עם Stripe (בקרוב)",
    "upgrade.comingSoon": "בקרוב!",
    "upgrade.cancel": "ניתן לבטל בכל עת",

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

    // Key Metrics
    "metrics.title": "מדדים מרכזיים",
    "metrics.upgrade": "שדרג כדי לראות מדדים מרכזיים",
    "metrics.pe": "מכפיל רווח (P/E)",
    "metrics.ps": "מכפיל מכירות (P/S)",
    "metrics.pb": "מכפיל הון (P/B)",
    "metrics.roe": "תשואה על ההון (ROE)",
    "metrics.roa": "תשואה על הנכסים (ROA)",
    "metrics.revGrowth5Y": "צמיחת הכנסות 5 שנים",
    "metrics.revGrowth10Y": "צמיחת הכנסות 10 שנים",
    "metrics.niMargin5Y": "מרווח רווח נקי 5 שנים",
    "metrics.niMargin10Y": "מרווח רווח נקי 10 שנים",

    // Ad
    "ad.space": "מקום לפרסום",
    "ad.upgrade": "שדרג לפרימיום להסרת פרסומות",

    // Calendar
    "cal.title": "יומן כלכלי — ישראל",
    "cal.today": "היום",
    "cal.tomorrow": "מחר",
    "cal.thisWeek": "השבוע",
    "cal.macroTitle": "אירועים מאקרו-כלכליים",
    "cal.earningsTitle": "יומן דוחות חברות",
    "cal.noMacro": "אין אירועים מאקרו לתאריך זה.",
    "cal.noEarnings": "אין דוחות חברות לתאריך זה.",
    "cal.time": "שעה",
    "cal.event": "אירוע",
    "cal.importance": "חשיבות",
    "cal.actual": "בפועל",
    "cal.forecast": "תחזית",
    "cal.previous": "קודם",
    "nav.calendar": "יומן כלכלי",

    // News
    "news.marketPulse": "דופק השוק",
    "news.liveNews": "חדשות בזמן אמת",
    "news.sentiment": "סנטימנט",
    "news.bullish": "חיובי",
    "news.veryBullish": "חיובי מאוד",
    "news.bearish": "שלילי",
    "news.veryBearish": "שלילי מאוד",
    "news.neutral": "ניטרלי",
    "news.noNews": "אין חדשות זמינות.",
    "news.unlockFull": "שחרר 15+ חדשות וסנטימנט",
    "news.upgradeSentiment": "שדרג לפרימיום לניתוח סנטימנט",
    "news.noContent": "אין תוכן זמין.",
    "news.readOriginal": "קרא את המקור",
    "news.upgradeReader": "שדרג לפרימיום לתרגומים אוטומטיים וקריאה מלאה",
    "news.upgradeCta": "שדרג לפרימיום",

    // 404
    "notFound.title": "404",
    "notFound.message": "אופס! הדף לא נמצא",
    "notFound.back": "חזרה לדף הבית",

    // Footer
    "footer.rights": "כל הזכויות שמורות.",
    "footer.privacy": "מדיניות פרטיות",
    "footer.terms": "תנאי שימוש",

    // Privacy
    "privacy.title": "מדיניות פרטיות - AlphaMap",
    "privacy.intro": "ברוכים הבאים ל-AlphaMap. הפרטיות שלך חשובה לנו.",
    "privacy.collectTitle": "איסוף מידע",
    "privacy.collectBody": "אנו אוספים מידע טכני כגון כתובת IP וסוג דפדפן בעת הגלישה. במידה ונרשמת לאתר, אנו שומרים את כתובת האימייל שלך.",
    "privacy.cookiesTitle": "עוגיות (Cookies) ופרסום",
    "privacy.cookiesBody": "האתר משתמש בעוגיות של צד שלישי, כולל Google AdSense, לצורך הצגת פרסומות מותאמות אישית וניתוח תנועת גולשים (Google Analytics). גוגל עשויה להשתמש בעוגיות כדי להציג מודעות המבוססות על ביקוריך הקודמים באתר זה או באתרים אחרים.",
    "privacy.manageCookiesTitle": "ניהול עוגיות",
    "privacy.manageCookiesBody": "באפשרותך לבטל את השימוש במודעות מותאמות אישית על ידי ביקור בהגדרות המודעות של גוגל.",
    "privacy.securityTitle": "אבטחה",
    "privacy.securityBody": "אנו נוקטים באמצעים מקובלים לאבטחת המידע שלך, אך איננו יכולים להבטיח חסינות מוחלטת מפני פריצות.",

    // Terms
    "terms.title": "תנאי שימוש ודיסקליימר משפטי",
    "terms.intro": "השימוש באתר AlphaMap כפוף לתנאים הבאים:",
    "terms.hostingTitle": "אירוח ומידע",
    "terms.hostingBody": "AlphaMap מספקת נתונים פיננסיים, דוחות וחדשות למטרות אינפורמטיביות בלבד.",
    "terms.noAdviceTitle": "אי ייעוץ פיננסי",
    "terms.noAdviceBody": "אין לראות במידע המופיע באתר AlphaMap משום ייעוץ השקעות, המלצה לביצוע פעולות בניירות ערך, או תחליף לייעוץ מקצועי המותאם לצרכיך האישיים. כל החלטת השקעה היא באחריות המשתמש בלבד.",
    "terms.accuracyTitle": "דיוק הנתונים",
    "terms.accuracyBody": "אנו שואבים נתונים מספקים חיצוניים (EODHD). למרות מאמצינו, ייתכנו טעויות או עיכובים בנתונים. AlphaMap אינה אחראית לכל נזק כספי שייגרם כתוצאה מהסתמכות על המידע באתר.",
    "terms.ipTitle": "קניין רוחני",
    "terms.ipBody": "המותג AlphaMap והקוד של האתר הם רכושנו הפרטי. אין להעתיק או לשכפל תוכן ללא אישור בכתב.",
  },
  en: {
    "nav.home": "Home",
    "nav.watchlist": "Watchlist",
    "nav.signOut": "Sign Out",
    "nav.signIn": "Sign In",
    "nav.brand": "AlphaMap",

    "hero.badge": "Live Market Data",
    "hero.title1": "Navigate the Markets with",
    "hero.title2": "AlphaMap",
    "hero.subtitle": "Professional data, real-time insights, and global financial intelligence.",
    "search.placeholder": "Search by company name or ticker...",

    "feature.financials.title": "5-Year Financials",
    "feature.financials.desc": "Revenue, profit, and balance sheet data at a glance",
    "feature.charts.title": "Interactive Charts",
    "feature.charts.desc": "TradingView-powered charts for every TASE stock",
    "feature.watchlist.title": "Personal Watchlist",
    "feature.watchlist.desc": "Track your favourite stocks in one place",

    "trending.title": "📈 Trending TASE Stocks",
    "trending.gainers": "Top Gainers",
    "trending.losers": "Top Losers",
    "trending.priceUnavailable": "No data available",
    "trending.marketOpen": "Market Open",
    "trending.marketClosed": "Market Closed",
    "trending.lastTradingDay": "Data from last trading day",

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
    "fin.annual": "Annual",
    "fin.quarterly": "Quarterly",
    "fin.metric": "Metric",
    "fin.incomeStatement": "Income Statement",
    "fin.balanceSheet": "Balance Sheet",
    "fin.cashFlow": "Cash Flow",
    "fin.costOfRevenue": "Cost of Revenue",
    "fin.ebitda": "EBITDA",
    "fin.eps": "EPS",
    "fin.totalAssets": "Total Assets",
    "fin.totalLiabilities": "Total Liabilities",
    "fin.totalEquity": "Total Equity",
    "fin.cashBs": "Cash",
    "fin.totalDebt": "Total Debt",
    "fin.inventory": "Inventory",
    "fin.depreciation": "Depreciation",
    "fin.capex": "CapEx",
    "fin.freeCashFlow": "Free Cash Flow",
    "fin.cashFromOps": "Cash from Operations",
    "fin.interestIncome": "Interest Income",
    "fin.nonInterestIncome": "Non-Interest Income",
    "fin.netPremiumsEarned": "Net Premiums Earned",
    "fin.totalDeposits": "Total Deposits",
    "fin.totalInvestments": "Total Investments",
    "fin.researchDev": "R&D Expenses",
    "fin.yoyGrowth": "YoY Growth",
    "fin.exportExcel": "Export to Excel",
    "fin.solvencyRatios": "Solvency & Liquidity Ratios",
    "fin.currentRatio": "Current Ratio",
    "fin.quickRatio": "Quick Ratio",

    // Deep Dive Financials
    "deepdive.title": "Deep Dive Balance Sheet",
    "deepdive.commonSize": "% of Total",
    "deepdive.verified": "✓ Sub-components match parent total",
    "deepdive.checksumMismatch": "⚠ Gap between sub-components and parent total",
    "deepdive.unavailable": "Detailed breakdown unavailable",
    "deepdive.totalAssets": "Total Assets",
    "deepdive.totalCurrentAssets": "Current Assets",
    "deepdive.cash": "Cash & Equivalents",
    "deepdive.shortTermInvestments": "Short-Term Investments",
    "deepdive.netReceivables": "Net Receivables",
    "deepdive.inventory": "Inventory",
    "deepdive.otherCurrentAssets": "Other Current Assets",
    "deepdive.nonCurrentAssets": "Non-Current Assets",
    "deepdive.ppe": "Property, Plant & Equipment",
    "deepdive.longTermInvestments": "Long-Term Investments",
    "deepdive.goodwill": "Goodwill",
    "deepdive.intangibleAssets": "Intangible Assets",
    "deepdive.otherNonCurrentAssets": "Other Non-Current Assets",
    "deepdive.totalLiabilities": "Total Liabilities",
    "deepdive.totalCurrentLiabilities": "Current Liabilities",
    "deepdive.accountsPayable": "Accounts Payable",
    "deepdive.shortTermDebt": "Short-Term Debt",
    "deepdive.otherCurrentLiabilities": "Other Current Liabilities",
    "deepdive.nonCurrentLiabilities": "Non-Current Liabilities",
    "deepdive.longTermDebt": "Long-Term Debt",
    "deepdive.otherNonCurrentLiabilities": "Other Non-Current Liabilities",
    "deepdive.totalEquity": "Total Equity",
    "deepdive.commonStock": "Common Stock",
    "deepdive.retainedEarnings": "Retained Earnings",
    "deepdive.otherEquity": "Other Equity",
    "deepdive.minorityInterest": "Minority Interest",

    "upgrade.subtitle": "Unlock quarterly financials, remove ads, and get advanced market insights.",
    "upgrade.feat1": "Quarterly financial reports",
    "upgrade.feat2": "Ad-free experience",
    "upgrade.feat3": "Advanced insights & analytics",
    "upgrade.signUpLogin": "Sign Up / Log In",
    "upgrade.stripeSoon": "Pay with Stripe (Coming Soon)",
    "upgrade.comingSoon": "Coming Soon!",
    "upgrade.cancel": "Cancel anytime",

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

    // Key Metrics
    "metrics.title": "Key Metrics",
    "metrics.upgrade": "Upgrade to see Key Metrics",
    "metrics.pe": "P/E Ratio",
    "metrics.ps": "P/S Ratio",
    "metrics.pb": "P/B Ratio",
    "metrics.roe": "ROE",
    "metrics.roa": "ROA",
    "metrics.revGrowth5Y": "5Y Avg Revenue Growth",
    "metrics.revGrowth10Y": "10Y Avg Revenue Growth",
    "metrics.niMargin5Y": "5Y Avg Net Income Margin",
    "metrics.niMargin10Y": "10Y Avg Net Income Margin",

    "ad.space": "Advertisement",
    "ad.upgrade": "Upgrade to Premium to remove ads",

    // Calendar
    "cal.title": "Israel Economic Calendar",
    "cal.today": "Today",
    "cal.tomorrow": "Tomorrow",
    "cal.thisWeek": "This Week",
    "cal.macroTitle": "Macro Economic Events",
    "cal.earningsTitle": "Earnings Calendar",
    "cal.noMacro": "No macro events for this date.",
    "cal.noEarnings": "No earnings reports for this date.",
    "cal.time": "Time",
    "cal.event": "Event",
    "cal.importance": "Importance",
    "cal.actual": "Actual",
    "cal.forecast": "Forecast",
    "cal.previous": "Previous",
    "nav.calendar": "Calendar",

    // News
    "news.marketPulse": "Market Pulse",
    "news.liveNews": "Live News",
    "news.sentiment": "Sentiment",
    "news.bullish": "Bullish",
    "news.veryBullish": "Very Bullish",
    "news.bearish": "Bearish",
    "news.veryBearish": "Very Bearish",
    "news.neutral": "Neutral",
    "news.noNews": "No news available.",
    "news.unlockFull": "Unlock 15+ News & Sentiment",
    "news.upgradeSentiment": "Upgrade to Premium for sentiment analysis",
    "news.noContent": "No content available.",
    "news.readOriginal": "Read original source",
    "news.upgradeReader": "Upgrade to Premium for AI-powered translations and full reader",
    "news.upgradeCta": "Upgrade to Premium",

    "notFound.title": "404",
    "notFound.message": "Oops! Page not found",
    "notFound.back": "Return to Home",

    // Footer
    "footer.rights": "All rights reserved.",
    "footer.privacy": "Privacy Policy",
    "footer.terms": "Terms of Service",

    // Privacy
    "privacy.title": "Privacy Policy - AlphaMap",
    "privacy.intro": "Welcome to AlphaMap. Your privacy is important to us.",
    "privacy.collectTitle": "Information Collection",
    "privacy.collectBody": "We collect technical information such as IP address and browser type during browsing. If you register, we store your email address.",
    "privacy.cookiesTitle": "Cookies & Advertising",
    "privacy.cookiesBody": "The site uses third-party cookies, including Google AdSense, for personalized advertising and traffic analysis (Google Analytics). Google may use cookies to display ads based on your previous visits to this or other websites.",
    "privacy.manageCookiesTitle": "Cookie Management",
    "privacy.manageCookiesBody": "You can opt out of personalized ads by visiting Google's ad settings.",
    "privacy.securityTitle": "Security",
    "privacy.securityBody": "We take standard measures to secure your information, but cannot guarantee absolute immunity from breaches.",

    // Terms
    "terms.title": "Terms of Service & Legal Disclaimer",
    "terms.intro": "Use of the AlphaMap website is subject to the following terms:",
    "terms.hostingTitle": "Hosting & Information",
    "terms.hostingBody": "AlphaMap provides financial data, reports, and news for informational purposes only.",
    "terms.noAdviceTitle": "No Financial Advice",
    "terms.noAdviceBody": "The information on AlphaMap does not constitute investment advice, a recommendation to trade securities, or a substitute for professional advice tailored to your needs. All investment decisions are the sole responsibility of the user.",
    "terms.accuracyTitle": "Data Accuracy",
    "terms.accuracyBody": "We source data from external providers (EODHD). Despite our efforts, errors or delays may occur. AlphaMap is not responsible for any financial damage resulting from reliance on information on this site.",
    "terms.ipTitle": "Intellectual Property",
    "terms.ipBody": "The AlphaMap brand and website code are our private property. Do not copy or reproduce content without written permission.",
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
