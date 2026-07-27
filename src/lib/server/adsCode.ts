// ============================================================
// adsCode.ts — קוד הבעלים לפרסום ללא תשלום, בצד השרת בלבד.
// הקוד עצמו לא נמצא בקוד המקור (המאגר ציבורי!) אלא במשתנה
// הסביבה ADS_OWNER_CODE. הדפדפן שולח את מה שהוקלד, והשרת:
//   1. מאמת מולו (verify-code + בזמן ההגשה עצמה — כך שאי אפשר
//      לזייף payment='code' בבקשה ישירה).
//   2. בכל שימוש בקוד — שולח הודעה לתיבת ההודעות של הבעלים
//      באתר קהילה בשכונה (אוסף messages ב-Strapi המשותף), עם
//      זהות המשתמש שהשתמש בקוד.
// נמען ההודעה: ADS_NOTIFY_EMAIL, ואם לא הוגדר — הסופר-אדמין
// הראשון (מסוג אימייל) ברשימת האדמינים של האתר.
// ============================================================

import { env } from '$env/dynamic/private';
import { strapiGet, strapiPost } from './strapiClient.js';
import { getAdmins } from './adminStore.js';
import { planLabelWithPrice } from '../adPlans.js';

const SITE_NAME = 'הגמ"ח הארצי';

function normalize(v: string): string {
    return v.trim().replace(/\s+/g, ' ');
}

/** האם הטקסט שהוקלד הוא קוד הבעלים. אם ADS_OWNER_CODE לא הוגדר — תמיד לא. */
export function isOwnerCode(raw: unknown): boolean {
    const secret = normalize(env.ADS_OWNER_CODE ?? '');
    if (!secret) return false;
    return typeof raw === 'string' && normalize(raw) === secret;
}

/** מזהה המשתמש (Strapi) של הבעלים — לפי ADS_NOTIFY_EMAIL או הסופר-אדמין הראשון. */
async function resolveOwnerUserId(): Promise<number | null> {
    let email = (env.ADS_NOTIFY_EMAIL ?? '').trim().toLowerCase();
    if (!email) {
        try {
            const admins = await getAdmins();
            email = admins.find((a) => a.role === 'super_admin' && a.type === 'email')?.identifier ?? '';
        } catch {
            /* בלי רשימה — פשוט אין נמען */
        }
    }
    if (!email) return null;
    try {
        // users-permissions מחזיר מערך שטוח (לא { data })
        const users = await strapiGet<Array<{ id: number }>>('/api/users', {
            'filters[email][$eq]': email,
        });
        return users?.[0]?.id ?? null;
    } catch {
        return null;
    }
}

/** הודעה לבעלים על שימוש בקוד — לתיבת ההודעות בקהילה בשכונה.
 *  כשל כאן לא מפיל את ההגשה (fire-and-forget מבחינת הקורא). */
export async function notifyOwnerCodeUse(info: {
    adTitle: string;
    durationDays: number;
    submitter?: { name?: string | null; email?: string | null } | null;
}): Promise<void> {
    try {
        const receiver = await resolveOwnerUserId();
        if (!receiver) {
            console.warn('adsCode: no notify recipient resolved — skipping owner notification');
            return;
        }
        const who = info.submitter?.email
            ? `${info.submitter.name || 'ללא שם'} (${info.submitter.email})`
            : 'משתמש לא מחובר';
        const content =
            `📢 שימוש בקוד בעלים — ${SITE_NAME}\n` +
            `פרסומת: "${info.adTitle}"\n` +
            `מי השתמש: ${who}\n` +
            `תקופה מבוקשת: ${planLabelWithPrice(info.durationDays)}\n` +
            `המודעה ממתינה לאישור ב-gemach.gofreeil.com/admin/ads`;
        await strapiPost('/api/messages', {
            data: { receiver, content, read: false },
        });
    } catch (err) {
        console.warn('adsCode: owner notification failed', err instanceof Error ? err.message : err);
    }
}
