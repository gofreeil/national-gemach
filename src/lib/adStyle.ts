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
/** יישור תת-הכותרת: ימין / מרכז / שמאל / מילוי רוחב */
export type SubAlign = 'right' | 'center' | 'left' | 'justify';

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
    /** גודל תת-הכותרת ב-rem */
    subFontSize: number;
    /** רווח בין שורות תת-הכותרת (יחס, לא יחידה) */
    subLineHeight: number;
    /** יישור תת-הכותרת */
    subAlign: SubAlign;
}

/** ברירת המחדל של הבילדר: רצועה בגובה 12% מהתמונה */
export const DEFAULT_BAND_HEIGHT = 12;
/** הפרש בין שתי פינות הרצועה — מה שנותן לה את השיפוע */
export const BAND_SLOPE = 10;
export const BAND_MIN = 5;
export const BAND_MAX = 50;
export const TITLE_OFFSET_MIN = -20;
export const TITLE_OFFSET_MAX = 60;

/** תת-הכותרת: הערכים שהיו קבועים ב-CSS לפני שהמפרסם קיבל שליטה עליהם */
export const DEFAULT_SUB_FONT_SIZE = 0.7;
export const SUB_FONT_SIZE_MIN = 0.5;
export const SUB_FONT_SIZE_MAX = 1.3;
export const DEFAULT_SUB_LINE_HEIGHT = 1.3;
export const SUB_LINE_HEIGHT_MIN = 0.9;
export const SUB_LINE_HEIGHT_MAX = 2.2;

export const DEFAULT_AD_STYLE: AdStyle = {
    logoShape: 'square',
    logoAnchor: 'right',
    logoX: null,
    logoY: null,
    bandHeight: DEFAULT_BAND_HEIGHT,
    titleOffsetY: 0,
    titleColor: '#ffffff',
    subFontSize: DEFAULT_SUB_FONT_SIZE,
    subLineHeight: DEFAULT_SUB_LINE_HEIGHT,
    subAlign: 'right',
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
        subFontSize: clamp(num(o.subFontSize) ?? DEFAULT_SUB_FONT_SIZE, SUB_FONT_SIZE_MIN, SUB_FONT_SIZE_MAX),
        subLineHeight: clamp(num(o.subLineHeight) ?? DEFAULT_SUB_LINE_HEIGHT, SUB_LINE_HEIGHT_MIN, SUB_LINE_HEIGHT_MAX),
        subAlign: parseSubAlign(o.subAlign),
    };
}

function parseSubAlign(v: unknown): SubAlign {
    return v === 'center' || v === 'left' || v === 'justify' ? v : 'right';
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

/**
 * משתני ה-CSS של הכרטיס (רצועה + טיפוגרפיית תת-הכותרת), לשתילה ב-style
 * של כרטיס בודד. אותם משתנים נצרכים ע"י ה-CSS בבילדר ובטור הימני, כדי
 * שהמפרסם יקבל בדיוק את מה שכיוון על המסך.
 */
export function adStyleVars(style: AdStyle): string {
    const { left, right } = bandCorners(style.bandHeight);
    return `--diag-top-left:${left}%;--diag-top-right:${right}%;`
        + `--sub-size:${style.subFontSize}rem;--sub-lh:${style.subLineHeight};--sub-align:${style.subAlign};`;
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
