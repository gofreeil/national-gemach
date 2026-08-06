// ============================================================
// adStyle.ts — העיצוב שהמפרסם קבע בבילדר, נשמר יחד עם המודעה
// ------------------------------------------------------------
// עד כה רק התמונה הראשית (adImageFit) עברה מהבילדר אל האתר. כל שאר
// ההחלטות העיצוביות - איפה הלוגו יושב, אם הוא עגול, כמה גבוהה הרצועה
// האלכסונית, איפה הכותרת ובאיזה צבע - נשארו ב-localStorage של הדפדפן
// ולא נשלחו לשרת. התוצאה: המפרסם עיצב דבר אחד וקיבל דבר אחר.
//
// כאן מרוכז אותו "גיליון סגנון" קטן. הוא נשמר בתוך ה-JSON של landing
// (כמו mainImageFit) כי לסכמת submitted-ad ב-Strapi אין עמודה ייעודית,
// ומוחל באותם ערכים בדיוק גם בתצוגה החיה בבילדר וגם בטור הימני באתר.
//
// מודעה ותיקה שנשלחה לפני השדה הזה מקבלת null מ-parseAdStyle, ואז
// legacyAdStyle() משחזר את ההתנהגות שהייתה לה - כך שאף מודעה שכבר
// רצה על האתר לא משנה את מראה שלה.
// ============================================================

export type LogoShape = 'square' | 'circle';
export type LogoAnchor = 'right' | 'left' | 'cta';

export interface AdStyle {
    /** ריבוע (פינות מעוגלות) או עיגול מלא */
    logoShape: LogoShape;
    /** עוגן ברירת המחדל של הלוגו, כשאין לו מיקום חופשי */
    logoAnchor: LogoAnchor;
    /** מרכז הלוגו באחוזי המשבצת. null בשני הצירים = יושב על העוגן */
    logoX: number | null;
    logoY: number | null;
    /** גובה הרצועה האלכסונית באחוזים מגובה התמונה */
    bandHeight: number;
    /** הזזה אנכית של הכותרת בפיקסלים */
    titleOffsetY: number;
    /** צבע הכותרת (#rgb / #rrggbb בלבד — הערך נכנס ל-style inline) */
    titleColor: string;
}

/** ברירת המחדל של הבילדר: רצועה בגובה 12% מהתמונה */
export const DEFAULT_BAND_HEIGHT = 12;
/** הפרש בין שתי פינות הרצועה — מה שנותן לה את השיפוע */
export const BAND_SLOPE = 10;
export const BAND_MIN = 5;
export const BAND_MAX = 50;
export const TITLE_OFFSET_MIN = -20;
export const TITLE_OFFSET_MAX = 60;

export const DEFAULT_AD_STYLE: AdStyle = {
    logoShape: 'square',
    logoAnchor: 'right',
    logoX: null,
    logoY: null,
    bandHeight: DEFAULT_BAND_HEIGHT,
    titleOffsetY: 0,
    titleColor: '#ffffff',
};

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const num = (v: unknown): number | null => (typeof v === 'number' && isFinite(v) ? v : null);

/** צבע נכנס ל-style inline ולכן מותר רק hex — לא ביטוי CSS שרירותי */
function parseColor(v: unknown): string {
    return typeof v === 'string' && /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(v.trim())
        ? v.trim()
        : DEFAULT_AD_STYLE.titleColor;
}

/**
 * מנרמל סגנון מקלט לא-בטוח (Strapi / localStorage / דפדפן).
 * מחזיר null כשאין סגנון שמור בכלל - מודעה שנשלחה לפני השדה הזה.
 */
export function parseAdStyle(raw: unknown): AdStyle | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const x = num(o.logoX);
    const y = num(o.logoY);
    // מיקום חופשי תקף רק כששני הצירים קיימים - אחרת נופלים לעוגן
    const free = x !== null && y !== null;
    return {
        logoShape: o.logoShape === 'circle' ? 'circle' : 'square',
        logoAnchor: o.logoAnchor === 'left' ? 'left' : o.logoAnchor === 'cta' ? 'cta' : 'right',
        logoX: free ? clamp(x, 0, 100) : null,
        logoY: free ? clamp(y, 0, 100) : null,
        bandHeight: clamp(num(o.bandHeight) ?? DEFAULT_BAND_HEIGHT, BAND_MIN, BAND_MAX),
        titleOffsetY: clamp(num(o.titleOffsetY) ?? 0, TITLE_OFFSET_MIN, TITLE_OFFSET_MAX),
        titleColor: parseColor(o.titleColor),
    };
}

/**
 * הכלל שלפיו נקבע מיקום הלוגו במודעות שנשלחו לפני שהסגנון נשמר:
 * כותרת ארוכה לא משאירה מקום ללוגו בפינה שלידה, ולכן הוא ירד לפינה
 * שמעל רצועת ה-CTA. משמר את מראה המודעות שכבר רצות על האתר.
 */
export function legacyAdStyle(title: string): AdStyle {
    return {
        ...DEFAULT_AD_STYLE,
        logoAnchor: (title ?? '').trim().length > 20 ? 'cta' : 'right',
    };
}

/** האם הלוגו יושב על מיקום חופשי שהמפרסם גרר בעצמו */
export function isLogoFree(style: AdStyle): boolean {
    return style.logoX !== null && style.logoY !== null;
}

/** גובה הרצועה → שתי פינות ה-clip-path (אחוז מלמעלה; קטן יותר = רצועה גבוהה) */
export function bandCorners(bandHeight: number): { left: number; right: number } {
    const left = clamp(100 - bandHeight, 0, 100);
    return { left, right: Math.max(0, left - BAND_SLOPE) };
}

/** משתני ה-CSS של הרצועה, לשתילה ב-style של כרטיס בודד */
export function adStyleVars(style: AdStyle): string {
    const { left, right } = bandCorners(style.bandHeight);
    return `--diag-top-left:${left}%;--diag-top-right:${right}%;`;
}

/** מחלקת המיקום של הלוגו (ריק כשהמיקום חופשי ומגיע מ-style inline) */
export function logoAnchorClass(style: AdStyle, prefix: 'ad' | 'promo'): string {
    if (isLogoFree(style)) return `${prefix}-logo-free`;
    return `${prefix}-logo-${style.logoAnchor}`;
}

/** מיקום חופשי → style inline. ריק כשהלוגו על העוגן */
export function logoFreeStyle(style: AdStyle): string {
    if (!isLogoFree(style)) return '';
    return `left:${style.logoX}%; top:${style.logoY}%; right:auto; bottom:auto; transform:translate(-50%,-50%);`;
}

/**
 * האם הלוגו יושב בפינה העליונה שליד הכותרת. במקרה כזה הכותרת מקבלת
 * ריפוד באותו צד, אחרת הלוגו מכסה לה את המילה האחרונה - המשבצת
 * רחבה 144px בלבד. הכלל זהה בבילדר ובאתר כדי שהתצוגה תהיה זהה.
 */
export function logoCornerSide(style: AdStyle, hasLogo: boolean): 'right' | 'left' | null {
    if (!hasLogo || isLogoFree(style)) return null;
    return style.logoAnchor === 'left' ? 'left' : style.logoAnchor === 'right' ? 'right' : null;
}
