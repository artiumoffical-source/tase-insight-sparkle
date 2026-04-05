import { useLanguage } from "@/hooks/useLanguage";

export default function TermsPage() {
  const { isRtl } = useLanguage();

  return (
    <div className="container max-w-3xl py-12 px-4" dir="rtl">
      <h1 className="font-display text-3xl font-bold mb-2 text-foreground">
        AlphaMap – תנאי שימוש ופרטיות
      </h1>
      <p className="text-muted-foreground mb-8">ברוכים הבאים ל-AlphaMap, הפורטל הפיננסי החכם של ישראל.</p>

      <div className="prose prose-lg dark:prose-invert max-w-none space-y-6 text-muted-foreground leading-relaxed">
        {/* 1. כללי */}
        <h2 className="text-xl font-semibold text-foreground">1. כללי</h2>

        <h3 className="text-lg font-medium text-foreground">1.1 אודות תנאי השימוש</h3>
        <p>תנאי שימוש אלה ("התנאים") מהווים הסכם משפטי מחייב בינך ("המשתמש", "אתה", "שלך") לבין AlphaMap ("האתר", "השירות", "אנו", "שלנו"). השימוש באתר ובשירותים המוצעים בו כפוף לתנאים אלה.</p>

        <h3 className="text-lg font-medium text-foreground">1.2 הסכמה לתנאים</h3>
        <p>על ידי גישה לאתר, יצירת חשבון משתמש, או שימוש בשירותים, אתה מצהיר ומאשר כי קראת, הבנת והסכמת להיות מחויב לתנאים אלה. אם אינך מסכים לתנאים אלה, אנא הימנע משימוש באתר.</p>

        <h3 className="text-lg font-medium text-foreground">1.3 הפעלת האתר</h3>
        <p>האתר מופעל על ידי AlphaMap, פורטל פיננסי מתקדם מבוסס טכנולוגיה ובינה מלאכותית (AI). האתר מספק מידע פיננסי, נתוני בורסה, חדשות שוק ההון, ניתוחים וכלים למשקיעים.</p>

        <h3 className="text-lg font-medium text-foreground">1.4 שינויים בשירותים ובתנאים</h3>
        <p><strong>שינויים בשירותים:</strong> אנו שומרים לעצמנו את הזכות לשנות, להשעות או להפסיק את השירותים (או כל חלק מהם) בכל עת; להוסיף או להסיר תכונות; ולשנות את מבנה או תצורת האתר ללא הודעה מוקדמת.</p>
        <p><strong>שינויים בתנאי השימוש:</strong> אנו רשאים לעדכן תנאים אלה מעת לעת. המשך השימוש באתר לאחר פרסום השינויים מהווה הסכמה לתנאים המעודכנים.</p>

        {/* 2. הגדרות */}
        <h2 className="text-xl font-semibold text-foreground">2. הגדרות</h2>
        <ul className="list-disc pr-6 space-y-2">
          <li><strong>"משתמש"</strong> – כל אדם הניגש לאתר, בין אם רשום ובין אם אורח.</li>
          <li><strong>"משתמש רשום"</strong> – משתמש שיצר חשבון באתר (באמצעות דוא"ל או חשבון Google).</li>
          <li><strong>"שירותים"</strong> – כלל התכנים, הנתונים הפיננסיים, הכתבות, כלי המחקר ומערכות ה-AI המוצעים באתר.</li>
          <li><strong>"מידע אישי"</strong> – מידע המזהה אדם כהגדרתו בחוק הגנת הפרטיות, התשמ"א-1981.</li>
          <li><strong>"מידע פיננסי"</strong> – נתונים, דוחות, חדשות ומידע הנוגעים לשוק ההון.</li>
        </ul>

        {/* 3. הרשמה */}
        <h2 className="text-xl font-semibold text-foreground">3. הרשמה, אבטחה וסיום שימוש</h2>

        <h3 className="text-lg font-medium text-foreground">3.1 יצירת חשבון ואבטחה</h3>
        <p>כדי לגשת לחלק מהשירותים, עליך ליצור חשבון משתמש. אתה מתחייב לספק מידע מדויק. אתה האחראי הבלעדי לכל פעילות המתרחשת תחת חשבונך ולשמירת סודיות פרטי הגישה שלך.</p>

        <h3 className="text-lg font-medium text-foreground">3.2 סיום שימוש וחסימה</h3>
        <p>אנו שומרים לעצמנו את הזכות להשעות או לסגור את חשבונך, או להגביל את גישתך, בכל עת וללא הודעה מוקדמת במקרים של הפרת תנאים אלו, שימוש בבוטים, פעילות חשודה או דרישת חוק.</p>

        {/* 4. פרטיות */}
        <h2 className="text-xl font-semibold text-foreground">4. פרטיות ואבטחת מידע</h2>

        <h3 className="text-lg font-medium text-foreground">4.1 מחויבות לפרטיות</h3>
        <p>אנו מחויבים להגנה על פרטיותך בהתאם לחוק הגנת הפרטיות (כולל תיקון 13, התשפ"ד-2024) ותקנות אבטחת מידע. איננו אוספים באופן אקטיבי "מידע רגיש" (כגון דעות פוליטיות או מידע רפואי).</p>

        <h3 className="text-lg font-medium text-foreground">4.2 המידע שאנו אוספים ושימוש בו</h3>
        <p><strong>מידע נמסר:</strong> דוא"ל, שם תצוגה, ופרטי הרשמה (כולל מ-Google OAuth).</p>
        <p><strong>מידע טכני:</strong> כתובות IP, סוג דפדפן, זמני גישה, נתוני צפייה במניות ופעולות באתר.</p>
        <p>המידע משמש לאספקת השירותים, התאמה אישית, אבטחת מידע ושיפור חווית המשתמש.</p>

        <h3 className="text-lg font-medium text-foreground">4.3 שיתוף מידע וזכויותיך</h3>
        <p>לא נמכור את המידע האישי שלך לצדדים שלישיים. מידע ישותף רק עם ספקי שירות טכניים המאובטחים בתקנים מחמירים. עומדות לך זכויות העיון, התיקון והמחיקה של המידע שלך, בפנייה לשירות הלקוחות שלנו.</p>

        {/* 5. מידע פיננסי */}
        <h2 className="text-xl font-semibold text-foreground">5. שימוש במידע פיננסי ותוכן AI (חשוב)</h2>
        <div className="bg-destructive/10 border border-destructive/30 rounded-lg p-4">
          <p className="font-semibold text-foreground">הבהרה משפטית:</p>
          <p>המידע באתר אינו מהווה ייעוץ השקעות, ייעוץ פיננסי, משפטי או מס, ואינו מהווה המלצה לקנות או למכור ניירות ערך. ההשקעה בשוק ההון כרוכה בסיכון משמעותי.</p>
        </div>

        <h3 className="text-lg font-medium text-foreground">5.1 מקורות המידע</h3>
        <p>המידע באתר נאסף מספקי נתונים חיצוניים, דוחות כספיים ומקורות פתוחים.</p>

        <h3 className="text-lg font-medium text-foreground">5.2 תוכן המיוצר על ידי בינה מלאכותית (AI)</h3>
        <p>חלק מהתכנים באתר, לרבות כתבות, תקצירים וניתוחי מגמות, מעובדים ומיוצרים באמצעות טכנולוגיות בינה מלאכותית (AI) על בסיס נתונים גולמיים. למרות שאנו מפעילים מנגנוני בקרה, ייתכנו "הזיות" אלגוריתמיות, חוסר דיוקים או שגיאות בהקשר.</p>

        <h3 className="text-lg font-medium text-foreground">5.3 אי-אחריות לדיוק</h3>
        <p>השימוש בנתונים הוא על אחריותך הבלעדית. אנו ממליצים תמיד להצליב נתונים עם הדוחות הרשמיים של החברות (PDF) המפורסמים ברשות ניירות ערך.</p>

        {/* 6. קניין רוחני */}
        <h2 className="text-xl font-semibold text-foreground">6. קניין רוחני ושימוש מותר</h2>

        <h3 className="text-lg font-medium text-foreground">6.1 בעלות וזכויות יוצרים</h3>
        <p>כל התוכן, העיצוב, קוד התוכנה, האלגוריתמים והמאמרים הם בבעלות AlphaMap ומוגנים בזכויות יוצרים.</p>

        <h3 className="text-lg font-medium text-foreground">6.2 חובת ייחוס (Attribution) ואיסור שימוש מסחרי</h3>
        <p>השירות נועד לשימוש אישי. אם הנך משתף נתונים או צילומי מסך (למשל ברשתות החברתיות), חובה להשאיר את לוגו האתר או לציין במפורש: "מקור הנתונים: AlphaMap". אין לעשות שימוש מסחרי בנתונים (כגון בניית אתר מתחרה או מכירת דוחות) ללא אישור בכתב.</p>

        <h3 className="text-lg font-medium text-foreground">6.3 איסור הנדסה הפוכה וגרידת נתונים</h3>
        <p>חל איסור מוחלט לבצע Scraping (גרידת נתונים), להשתמש בבוטים שואבי-מידע, או לבצע הנדסה הפוכה למערכות האתר. משתמש שיזוהה כמבצע פעולות אלו ייחסם לצמיתות וחשוף לתביעה משפטית.</p>

        {/* 7. אחריות */}
        <h2 className="text-xl font-semibold text-foreground">7. אחריות והגבלת אחריות</h2>
        <p>השירותים מסופקים "כפי שהם" (AS IS). אנו לא מתחייבים לזמינות רצופה או לחסינות מתקלות. ככל שהחוק מתיר, AlphaMap לא תישא באחריות לכל נזק ישיר, עקיף, הפסד כספי או אובדן רווחים שייגרמו כתוצאה מהסתמכות על המידע המופיע באתר, מתקלות טכניות, או משימוש בשירותים.</p>

        {/* 8. הוראות כלליות */}
        <h2 className="text-xl font-semibold text-foreground">8. הוראות כלליות ויצירת קשר</h2>
        <p><strong>דין חל:</strong> תנאים אלה כפופים לחוקי מדינת ישראל. סמכות השיפוט הבלעדית נתונה לבתי המשפט המוסמכים בישראל.</p>
        <p><strong>עדכונים:</strong> תנאים אלו עשויים להתעדכן. הגרסה העברית היא הקובעת בכל מקרה של מחלוקת.</p>

        <div className="bg-muted rounded-lg p-4 space-y-2">
          <p className="font-semibold text-foreground">יצירת קשר:</p>
          <p>לשאלות, תמיכה או פניות בנושא פרטיות, ניתן לפנות אלינו:</p>
          <p>📧 דוא"ל: <a href="mailto:support@alpha-map.com" className="text-primary hover:underline">support@alpha-map.com</a></p>
          <p>🌐 אתר: <a href="https://alpha-map.com" className="text-primary hover:underline">https://alpha-map.com</a></p>
        </div>

        <p className="text-sm border-t pt-4 text-muted-foreground">על ידי שימוש באתר AlphaMap, אתה מאשר כי קראת, הבנת והסכמת לתנאי שימוש אלה במלואם.</p>
      </div>
    </div>
  );
}
