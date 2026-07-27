// ============================================================
// adPlans.ts — מסלולי הפרסום באתר: תקופה + מחיר, בתשלום מראש.
// מקור אמת יחיד: הבילדר (/advertise/builder/landing), דף "פרסמו
// אצלנו", ה-API (/api/ads/submit), מאגר המודעות ומסך האישור
// (/admin/ads) — כולם נגזרים מהרשימה הזו, כדי שלא יהיו שני מחירונים.
// שינוי מחיר/תקופה נעשה כאן בלבד.
// ============================================================

export interface AdPlan {
    /** אורך הפרסום בימים — גם המפתח שנשמר ב-Strapi */
    days: number;
    /** תווית קצרה לכפתור/לרשימה */
    label: string;
    /** הניסוח המלא, כמו בשורת המחירון */
    title: string;
    /** מחיר בשקלים — תשלום מראש לכל התקופה */
    price: number;
}

export const adPlans: AdPlan[] = [
    { days: 7,   label: 'שבוע',    title: 'פרסום לשבוע',    price: 50 },
    { days: 30,  label: '30 יום',  title: 'פרסום ל-30 יום', price: 130 },
    { days: 90,  label: 'רבעון',   title: 'פרסום לרבעון',   price: 350 },
    { days: 180, label: 'חצי שנה', title: 'פרסום לחצי שנה', price: 600 },
    { days: 365, label: 'שנה',     title: 'פרסום לכל השנה', price: 1000 },
];

/** ברירת המחדל — המסלול החודשי */
export const DEFAULT_PLAN_DAYS = 30;

/** כל ערך שמגיע מבחוץ (דפדפן/Strapi/טופס) מצומצם לאחד המסלולים */
export function normalizePlanDays(value: unknown): number {
    const days = Number(value);
    return adPlans.some((p) => p.days === days) ? days : DEFAULT_PLAN_DAYS;
}

export function planFor(value: unknown): AdPlan {
    const days = normalizePlanDays(value);
    return adPlans.find((p) => p.days === days) as AdPlan;
}

/** "חצי שנה" */
export const planLabel = (value: unknown): string => planFor(value).label;

/** "חצי שנה — 600 ₪" */
export const planLabelWithPrice = (value: unknown): string => {
    const p = planFor(value);
    return `${p.label} — ${p.price} ₪`;
};
