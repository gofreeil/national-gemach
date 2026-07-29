// ============================================================
// imageCompress.ts — כיווץ תמונה בצד הלקוח ל-data URI
//
// זהה להתנהגות של "קהילה בשכונה" (items/[id]): התמונות נשמרות כ-data URI
// בתוך extra_fields (logo/images) ולא ב-Media Library של Strapi. חשוב לשמור
// על אותם פרמטרים בדיוק — שני האתרים קוראים וכותבים את אותן רשומות.
// ============================================================

/** הצלע הארוכה המקסימלית בפיקסלים (מעבר לזה — הקטנה יחסית) */
const MAX_EDGE = 1000;
/** איכות JPEG. 0.82 = פשרה טובה בין משקל לאיכות בתמונות מוצר/לוגו */
const JPEG_QUALITY = 0.82;

/** מספר התמונות המרבי בגלריה — תואם ל-MAX_IMAGES של "קהילה בשכונה" */
export const MAX_GALLERY_IMAGES = 5;

/**
 * תקרת משקל כוללת לכל התמונות של גמ"ח אחד.
 *
 * למה 850KB: התמונות נשמרות כ-data URI *בתוך* רשומת ה-JSON של Strapi, ו-Strapi
 * לא מגדיר jsonLimit משלו — כלומר נופלים לברירת המחדל של koa-body, 1MB. חריגה
 * מחזירה 413 בלי הסבר. עוצרים קצת מתחת, עם מקום לשאר שדות הרשומה.
 */
export const MAX_TOTAL_IMAGE_KB = 850;

/**
 * קורא קובץ תמונה, מקטין אותו ומחזיר data URI של JPEG.
 * זורק שגיאה אם הקובץ אינו תמונה תקינה.
 */
export function compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('image'));
            img.onload = () => {
                let { width, height } = img;
                if (width > MAX_EDGE || height > MAX_EDGE) {
                    const scale = Math.min(MAX_EDGE / width, MAX_EDGE / height);
                    width = Math.round(width * scale);
                    height = Math.round(height * scale);
                }
                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('canvas')); return; }
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

/** צלע הריבוע של תמונת אריח קטגוריה. האריח מוצג ב-108px — 384 מכסה גם 3x. */
const TILE_EDGE = 384;

/**
 * תקרת משקל כוללת לכל תמונות הקטגוריות.
 *
 * כולן נשמרות כ-data URI בתוך רשומת ההגדרות היחידה (__ng_config), ולכן חלה
 * עליהן אותה תקרת 1MB של koa-body שמפילה בקשות ב-413 בלי הסבר. עוצרים
 * בהרבה מתחת, עם מקום לשאר ההגדרות שיושבות באותה רשומה.
 */
export const MAX_CATEGORY_IMAGES_KB = 600;

/**
 * קורא קובץ תמונה, חותך ממנו ריבוע-מרכז וממזער אותו לגודל אריח.
 * חיתוך ולא רק הקטנה: האריח ממילא מציג ריבוע-מרכז (object-fit: cover),
 * ושמירת הריבוע בלבד חוסכת שליש מהמשקל ברשומת ההגדרות.
 */
export function compressTileImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('read'));
        reader.onload = () => {
            const img = new Image();
            img.onerror = () => reject(new Error('image'));
            img.onload = () => {
                const side = Math.min(img.width, img.height);
                if (!side) { reject(new Error('image')); return; }
                const canvas = document.createElement('canvas');
                canvas.width = canvas.height = Math.min(TILE_EDGE, side);
                const ctx = canvas.getContext('2d');
                if (!ctx) { reject(new Error('canvas')); return; }
                ctx.drawImage(
                    img,
                    (img.width - side) / 2, (img.height - side) / 2, side, side,
                    0, 0, canvas.width, canvas.height
                );
                resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
            };
            img.src = String(reader.result);
        };
        reader.readAsDataURL(file);
    });
}

/** משקל מקורב ב-KB של data URI (base64 מנפח את המקור ב-~1/3) */
export function dataUriWeightKb(src: string): number {
    if (!src.startsWith('data:')) return 0;
    const b64 = src.slice(src.indexOf(',') + 1);
    return Math.round((b64.length * 0.75) / 1024);
}
