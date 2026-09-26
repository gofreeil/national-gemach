// ============================================================
// gemachDedupe.ts — אותו גמ"ח שנשלח פעמיים לא הופך לשני כרטיסים
//
// הבעיה (נתפסה באינדקס: ארבעה כרטיסים זהים בתוך עשר שניות): לחיצה כפולה,
// רענון או "שליחה ליתר ביטחון" בזמן שהתמונות והמיקום עוד נשמרים — וכל
// בקשה יוצרת רשומה משלה. בפרודקשן (Vercel) כל בקשה יכולה לנחות במופע שרת
// אחר, ולכן נעילה בזיכרון לא עוזרת. שתי שכבות:
//   1. לפני היצירה — אם כבר קיים גמ"ח פעיל זהה, לא יוצרים (findActiveTwins).
//   2. אחרי היצירה — כל מי שיצר בודק שוב, ומי שאינו הוותיק מוחק את עצמו
//      (settleCreateRace). המאגר הוא נקודת ההכרעה, כך שזה עובד בין מופעים.
//
// "אותו גמ"ח" = אותו שם (בלי רישיות/גרשיים/רווחים כפולים) וגם אותו טלפון
// (9 ספרות אחרונות); כשלשניהם אין טלפון — אותה עיר. שם בלבד לא מספיק:
// "גמ"ח כלים" יש בעשרות ערים.
// ============================================================

import { strapiGet } from './strapiClient.js';
import { deleteGemach, type StrapiItem } from './db';
import { phoneTail } from './adminStore';

const CATEGORY = 'gemachim';

function normName(raw: unknown): string {
    return String(raw ?? '')
        .toLowerCase()
        .replace(/["'`״׳]/g, '')
        .replace(/[\s\-_.,;:!?()[\]{}]+/g, ' ')
        .trim();
}

function normCity(raw: unknown): string {
    return String(raw ?? '').replace(/\s+/g, ' ').trim();
}

interface Identity {
    name: string;
    phone?: string | null;
    city?: string | null;
}

function isSameGemach(a: Identity, b: Identity): boolean {
    const name = normName(a.name);
    if (!name || name !== normName(b.name)) return false;
    const pa = phoneTail(String(a.phone ?? ''));
    const pb = phoneTail(String(b.phone ?? ''));
    if (pa || pb) return pa.length >= 9 && pa === pb;
    return normCity(a.city) !== '' && normCity(a.city) === normCity(b.city);
}

/** גמ"חים פעילים שהם אותו גמ"ח — מהוותיק לחדש. שאילתה ישירה (לא המטמון
 *  של הרשימה), כדי לראות גם רשומה שנוצרה לפני שנייה במופע אחר. */
export async function findActiveTwins(v: Identity): Promise<StrapiItem[]> {
    const name = String(v.name ?? '').trim();
    if (!name) return [];
    const tail = phoneTail(String(v.phone ?? ''));
    const params: Record<string, string> = {
        'filters[category][$eq]': CATEGORY,
        'filters[status1][$eq]': 'active',
        'filters[$or][0][label][$eqi]': name,
        'sort[0]': 'createdAt:asc',
        'sort[1]': 'documentId:asc',
        'pagination[pageSize]': '50',
    };
    if (tail.length >= 9) params['filters[$or][1][phone][$contains]'] = tail.slice(-7);
    const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', params);
    const rows = Array.isArray(res?.data) ? res.data : [];
    return rows.filter((r) => isSameGemach(v, { name: r.label, phone: r.phone, city: r.city }));
}

/**
 * אחרי יצירה: אם נוצר במקביל גמ"ח ותיק יותר זהה — שלנו נמחק ומחזירים את
 * הוותיק. ההכרעה דטרמיניסטית (createdAt ואז documentId), ולכן גם כשכמה
 * שליחות מתיישבות יחד בדיוק אחת שורדת. כשל לא מפיל את השליחה.
 */
export async function settleCreateRace(v: Identity, ourId: string): Promise<StrapiItem | null> {
    try {
        const winner = (await findActiveTwins(v))[0];
        if (!winner || winner.documentId === ourId) return null;
        await deleteGemach(ourId);
        return winner;
    } catch (e) {
        console.warn('[gemachDedupe] settleCreateRace failed:', e);
        return null;
    }
}

/** אסימון האימוץ של טיוטת אורח (extra_fields.guest_claim) — כדי שאורח
 *  שהשליחה הכפולה שלו נמחקה יקבל את הכרטיס שנשאר. */
export function guestTokenOf(item: StrapiItem): string | null {
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    const c = extra.guest_claim as { token?: unknown } | undefined;
    return typeof c?.token === 'string' ? c.token : null;
}
