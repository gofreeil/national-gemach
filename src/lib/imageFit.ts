// ============================================================
// imageFit.ts — מיקום-ותקריב של תמונות במשבצות תצוגה קבועות
// ------------------------------------------------------------
// משבצות התצוגה (באנר הכרטיס, תמונת השער בעמוד הגמ"ח) הן קופסאות ביחס
// קבוע עם object-cover, שחותך אזור-מרכז מהתמונה. שתי שכבות שליטה:
//
// 1. מיקום ידני (ImageFit) — המעלה בוחר איזה חלק מהתמונה ימלא את המשבצת
//    (גרירה + תקריב בטופס). נשמר ב-extra_fields.image_fit של הפריט, ממופתח
//    לפי מקור התמונה: 'logo' ללוגו, '0'..'4' לאינדקס בגלריה.
// 2. נפילה אוטומטית — תמונה ביחס קיצוני בלי מיקום ידני מוצגת בשלמותה
//    (object-contain) על רקע המשבצת הכהה, במקום להיחתך לרצועה צרה.
// ============================================================

/** מיקום התמונה במשבצת: x/y באחוזי object-position (50/50 = מרכז), z = תקריב ≥1.
 *  contain = "תמונה שלמה": התמונה מוקטנת עד שכולה נכנסת למשבצת, בלי חיתוך
 *  (הקצה הרחוק ביותר של הזום-אאוט). אז z חסר משמעות, ו-x/y רק מזיזים את
 *  התמונה בתוך הרצועה הריקה שנשארת בציר הקצר. */
export interface ImageFit {
    x: number;
    y: number;
    z: number;
    contain?: boolean;
}

export const DEFAULT_FIT: ImageFit = { x: 50, y: 50, z: 1 };

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** מנרמל ערך fit בודד מקלט לא-בטוח; null אם אינו אובייקט fit בכלל */
export function parseImageFit(raw: unknown): ImageFit | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const num = (v: unknown, fallback: number) =>
        typeof v === 'number' && isFinite(v) ? v : fallback;
    const contain = o.contain === true || o.contain === 'true';
    return {
        x: clamp(num(o.x, 50), 0, 100),
        y: clamp(num(o.y, 50), 0, 100),
        z: contain ? 1 : clamp(num(o.z, 1), 1, 3),
        ...(contain ? { contain: true } : {}),
    };
}

/** האם ה-fit שונה מברירת המחדל (מרכז בלי תקריב) — רק כזה שווה שמירה/החלה */
export function isCustomFit(fit: ImageFit): boolean {
    return fit.x !== DEFAULT_FIT.x || fit.y !== DEFAULT_FIT.y || fit.z !== DEFAULT_FIT.z || fit.contain === true;
}

/** מפת המיקומים של פריט (extra_fields.image_fit) מקלט לא-בטוח.
 *  מפתחות: 'logo' או אינדקס גלריה כמחרוזת. ערכים לא-תקינים נשמטים בשקט. */
export function parseImageFitMap(raw: unknown): Record<string, ImageFit> | undefined {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return undefined;
    const out: Record<string, ImageFit> = {};
    for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
        if (key !== 'logo' && !/^\d+$/.test(key)) continue;
        const fit = parseImageFit(value);
        if (fit && isCustomFit(fit)) out[key] = fit;
    }
    return Object.keys(out).length > 0 ? out : undefined;
}

/** ה-fit של התמונה הראשית (gemach.image): 'logo' אם יש לוגו, אחרת התמונה
 *  הראשונה בגלריה ('0'). זיהוי לפי השוואת כתובות — pickImage נופל ל-images[0]
 *  כשאין לוגו, ואז image === gallery[0] (גם אחרי ההמרה לכתובות endpoint). */
export function mainImageFit(g: {
    image?: string;
    gallery?: string[];
    imageFit?: Record<string, ImageFit>;
}): ImageFit | undefined {
    if (!g.imageFit || !g.image) return undefined;
    const key = g.gallery?.[0] === g.image ? '0' : 'logo';
    return g.imageFit[key];
}

/** ה-fit של תמונה מוצגת כלשהי של הגמ"ח — הראשית (ראו mainImageFit) או
 *  תמונה מהגלריה (לפי האינדקס שלה). undefined = אין מיקום ידני לתמונה זו. */
export function displayedImageFit(
    g: { image?: string; gallery?: string[]; imageFit?: Record<string, ImageFit> },
    src: string | undefined,
): ImageFit | undefined {
    if (!src || !g.imageFit) return undefined;
    if (g.image && src === g.image) return mainImageFit(g);
    const gi = g.gallery?.indexOf(src) ?? -1;
    return gi >= 0 ? g.imageFit[String(gi)] : undefined;
}

/** סגנון inline להחלת fit על <img>.
 *  ה-transform-origin בנקודת המיקוד — התקריב מתרחב סביבה ולא סביב המרכז.
 *  ב"תמונה שלמה" (contain) התמונה ממילא אינה גולשת, ולכן רק object-position. */
export function fitStyle(fit: ImageFit): string {
    const pos = `object-position:${fit.x}% ${fit.y}%;`;
    return !fit.contain && fit.z !== 1
        ? `${pos}transform:scale(${fit.z});transform-origin:${fit.x}% ${fit.y}%;`
        : pos;
}

/** מחלקת ה-object-fit הנגזרת מהבחירה: "תמונה שלמה" → contain, אחרת חיתוך */
export function fitObjectClass(fit: ImageFit): 'object-contain' | 'object-cover' {
    return fit.contain ? 'object-contain' : 'object-cover';
}

/** רחבה מ-16:9 בערך, או גבוהה מ-3:5 — יחס שמשבצת ריבועית-בקירוב חותכת קשה */
export function isExtremeAspect(img: HTMLImageElement): boolean {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return false;
    const ratio = w / h;
    return ratio > 1.7 || ratio < 0.6;
}
