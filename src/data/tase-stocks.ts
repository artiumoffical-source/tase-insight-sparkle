export interface TaseStock {
  ticker: string;
  name: string;
  nameHe: string;
}

const TASE_STOCKS: TaseStock[] = [
  { ticker: "TEVA", name: "Teva Pharmaceutical", nameHe: "טבע תעשיות פרמצבטיות" },
  { ticker: "LUMI", name: "Bank Leumi", nameHe: "בנק לאומי" },
  { ticker: "DSCT", name: "Bank Discount", nameHe: "בנק דיסקונט" },
  { ticker: "HARL", name: "Harel Insurance", nameHe: "הראל ביטוח" },
  { ticker: "POLI", name: "Bank Hapoalim", nameHe: "בנק הפועלים" },
  { ticker: "ICL", name: "ICL Group", nameHe: "כיל" },
  { ticker: "NICE", name: "NICE Systems", nameHe: "נייס מערכות" },
  { ticker: "BEZQ", name: "Bezeq", nameHe: "בזק" },
  { ticker: "ELCO", name: "Elco Holdings", nameHe: "אלקו החזקות" },
  { ticker: "AZRG", name: "Azrieli Group", nameHe: "קבוצת עזריאלי" },
  { ticker: "ESLT", name: "Elbit Systems", nameHe: "אלביט מערכות" },
  { ticker: "ISOP", name: "Israel Opportunity", nameHe: "הזדמנות ישראלית" },
  { ticker: "MZTF", name: "Mizrahi Tefahot", nameHe: "מזרחי טפחות" },
  { ticker: "FIBI", name: "First International Bank", nameHe: "הבנק הבינלאומי הראשון" },
  { ticker: "CLIS", name: "Clal Insurance", nameHe: "כלל ביטוח" },
  { ticker: "MGDL", name: "Migdal Insurance", nameHe: "מגדל ביטוח" },
  { ticker: "ORA", name: "Bank Otsar HaHayal", nameHe: "בנק אוצר החייל" },
  { ticker: "PHOE", name: "The Phoenix", nameHe: "הפניקס" },
  { ticker: "SPNS", name: "Sapiens International", nameHe: "ספיינס" },
  { ticker: "CEL", name: "Cellcom", nameHe: "סלקום" },
  { ticker: "PTNR", name: "Partner Communications", nameHe: "פרטנר תקשורת" },
  { ticker: "AMOT", name: "Amot Investments", nameHe: "עמות השקעות" },
  { ticker: "GZIT", name: "Gazit Globe", nameHe: "גזית גלוב" },
  { ticker: "SHPG", name: "Shapir Engineering", nameHe: "שפיר הנדסה" },
  { ticker: "DLEKG", name: "Delek Group", nameHe: "קבוצת דלק" },
];

export default TASE_STOCKS;

export const TRENDING_TICKERS = ["LUMI", "POLI", "ESLT", "ICL", "TEVA"];
