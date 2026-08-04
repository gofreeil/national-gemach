// ============================================================
// share.ts — מקור אמת יחיד לשיתוף גמ"ח.
//
// שלושה כללים שכל שיתוף מקיים:
//   1. בלי טלפון. גם לא מספר שנכתב בתוך התיאור — הטלפון נחשף רק בדף
//      הגמ"ח, אחרי "גלה טלפון". (ראו withoutPhones ב-$lib/phoneText)
//   2. כתובת דף הגמ"ח בשורה נפרדת. ווצאפ/טלגרם/פייסבוק מושכים ממנה
//      תצוגה מקדימה עם התמונה של הגמ"ח (תגי og ב-Seo.svelte), והלוחץ
//      עליה נוחת ישירות בדף הגמ"ח.
//   3. משפט סיום קבוע שקורא להשתמש במאגר הארצי.
//
// כל כתובת נושאת utm_source לפי היעד — כך "מקורות תנועה" בפאנל
// (/admin/stats) מראה כמה כניסות הגיעו משיתופי וואטסאפ.
// ============================================================

import { SITE_NAME, SITE_TAGLINE, SITE_URL } from '$lib/seo';
import { withoutPhones } from '$lib/phoneText';

export interface ShareGemachInfo {
    id: string;
    name: string;
    description?: string;
    /** תווית הנושא, למשל "ציוד רפואי" */
    categoryLabel?: string;
    /** עיר או שכונה — מה שמוצג ככותרת המקום בדף */
    place?: string;
}

/** המשפט הגנרי שנלווה לכל שיתוף. בלי כתובת שנייה בכוונה — ווצאפ וטלגרם
 *  בונים תצוגה מקדימה מהקישור הראשון בהודעה, וזה חייב להיות דף הגמ"ח. */
const CALL_TO_ACTION = `${SITE_NAME} — ${SITE_TAGLINE}, חינם ובלי הרשמה 🤝`;

/** תיאור לשיתוף: בלי טלפונים, בשורה אחת, עד ~180 תווים */
function shortDescription(text?: string): string {
    const clean = (withoutPhones(text) ?? '').replace(/\s+/g, ' ').trim();
    if (clean.length <= 180) return clean;
    return clean.slice(0, 177).replace(/\s+\S*$/, '') + '…';
}

/** כתובת דף הגמ"ח לשיתוף, מתויגת ביעד שממנו יגיעו הלוחצים */
export function gemachShareUrl(id: string, source: string): string {
    return `${SITE_URL}/gemach/${encodeURIComponent(id)}?utm_source=${source}&utm_medium=share`;
}

/** שורת הכותרת — גם ככותרת בשיתוף המובנה של המכשיר וגם כנושא במייל */
export function gemachShareTitle(g: ShareGemachInfo): string {
    const what = [g.categoryLabel ? `גמ"ח ${g.categoryLabel}` : 'גמ"ח', g.place ? `ב${g.place}` : '']
        .filter(Boolean)
        .join(' ');
    return `${g.name} — ${what}`;
}

/**
 * גוף ההודעה. url ריק = בלי שורת הכתובת, ליעדים (טלגרם, פייסבוק, X)
 * שמקבלים את הכתובת בשדה נפרד ואחרת היא הייתה מופיעה פעמיים.
 */
export function gemachShareMessage(g: ShareGemachInfo, url = ''): string {
    const desc = shortDescription(g.description);
    return [
        `🤝 ${g.name}`,
        [g.categoryLabel ? `גמ"ח ${g.categoryLabel}` : '', g.place ? `📍 ${g.place}` : '']
            .filter(Boolean)
            .join(' · '),
        desc,
        url,
        CALL_TO_ACTION,
    ]
        .filter(Boolean)
        .join('\n');
}

/** מה שכל יעד שיתוף מקבל כדי לבנות את הכתובת שלו */
export interface ShareParts {
    /** ההודעה בלי שורת הכתובת */
    text: string;
    /** ההודעה כולל שורת הכתובת */
    textWithUrl: string;
    url: string;
    title: string;
}

export interface ShareTarget {
    /** גם המפתח וגם ה-utm_source של היעד */
    key: string;
    label: string;
    icon: string;
    href: (p: ShareParts) => string;
}

/** האפליקציות שמציעים ללחיצה אחת, לפי הנפוצות בישראל */
export const SHARE_TARGETS: ShareTarget[] = [
    {
        key: 'whatsapp', label: 'וואטסאפ', icon: '💬',
        // wa.me בלי מספר פותח את בוחר אנשי הקשר של האפליקציה (או WhatsApp Web)
        href: (p) => `https://wa.me/?text=${encodeURIComponent(p.textWithUrl)}`,
    },
    {
        key: 'telegram', label: 'טלגרם', icon: '✈️',
        href: (p) => `https://t.me/share/url?url=${encodeURIComponent(p.url)}&text=${encodeURIComponent(p.text)}`,
    },
    {
        key: 'facebook', label: 'פייסבוק', icon: '📘',
        // פייסבוק מתעלם מטקסט מוזרק ובונה את הפוסט מתגי ה-og של הדף
        href: (p) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(p.url)}`,
    },
    {
        key: 'sms', label: 'SMS', icon: '📱',
        href: (p) => `sms:?&body=${encodeURIComponent(p.textWithUrl)}`,
    },
    {
        key: 'email', label: 'מייל', icon: '✉️',
        href: (p) => `mailto:?subject=${encodeURIComponent(p.title)}&body=${encodeURIComponent(p.textWithUrl)}`,
    },
];

/** בונה את כל מה שיעד מסוים צריך — כולל כתובת מתויגת ב-utm שלו */
export function sharePartsFor(g: ShareGemachInfo, source: string): ShareParts {
    const url = gemachShareUrl(g.id, source);
    return {
        text: gemachShareMessage(g),
        textWithUrl: gemachShareMessage(g, url),
        url,
        title: gemachShareTitle(g),
    };
}
