// ============================================================
// userAvatar.ts — תמונת הפרופיל של המשתמש המחובר, לאווטאר שבהדר
//
// המקור: avatar_url על רשומת המשתמש ב-Strapi המשותף — קישור (תמונת Google/Facebook שהקהילה
// מסנכרנת בכל כניסה) או data:image;base64 שהועלה ידנית בפרופיל הקהילה. קישור נשמר בסשן כמות
// שהוא; תמונה מוטבעת גדולה מדי לעוגיית הסשן, ולכן מוגשת מ-/api/me/avatar עם חותם תוכן ב-?v=.
// אין תמונה → ההדר מציג את האות הראשונה של השם.
// ============================================================

export const MY_AVATAR_PATH = '/api/me/avatar';

/** כל כמה זמן מרעננים את התמונה מול Strapi (כדי שהחלפת תמונה בקהילה תגיע גם לכאן) */
const RESYNC_MS = 24 * 60 * 60 * 1000;
/** Strapi לא ענה → מנסים שוב בעוד רבע שעה, לא בכל בקשה */
const RETRY_MS = 15 * 60 * 1000;
/** קישורים ארוכים מזה לא נכנסים לעוגיית הסשן */
const MAX_URL_LENGTH = 1500;

type MeFetcher = (jwt: string) => Promise<{ avatar_url?: string | null } | null>;

function stamp(s: string): string {
    const probe = `${s.length}:${s.slice(28, 60)}:${s.slice(-32)}`;
    let h = 0;
    for (let i = 0; i < probe.length; i++) h = (Math.imul(h, 31) + probe.charCodeAt(i)) | 0;
    return (h >>> 0).toString(36);
}

/** כתובת להצגה: קישור http(s) כמו שהוא, תמונה מוטבעת → נתיב ההגשה, ואחרת '' */
export function avatarSrc(raw: string | null | undefined): string {
    const a = (raw ?? '').trim();
    if (/^https?:\/\//i.test(a)) return a.length <= MAX_URL_LENGTH ? a : '';
    if (/^data:image\//i.test(a)) return `${MY_AVATAR_PATH}?v=${stamp(a)}`;
    return '';
}

// כמה קריאות auth() באותה בקשה מפענחות את אותה עוגייה ישנה — בלי זה כל אחת הייתה פונה ל-Strapi
const recent = new Map<string, { src: string; at: number }>();

/**
 * מעדכן את תמונת הפרופיל על טוקן הסשן (token.picture → session.user.image) מ-avatar_url שב-Strapi.
 * רץ בכניסה, ואחר כך פעם ביום; גם סשנים ישנים שנוצרו בלי תמונה נרפאים כך בלי כניסה מחדש.
 * תמונת Google/Facebook שכבר על הטוקן נשמרת כשב-Strapi אין תמונה.
 */
export async function syncAvatar(
    token: { picture?: string | null; avatarAt?: number },
    jwt: string | null | undefined,
    fetchMe: MeFetcher
): Promise<void> {
    if (!jwt || (token.avatarAt && Date.now() - token.avatarAt < RESYNC_MS)) return;
    let hit = recent.get(jwt);
    if (!hit || Date.now() - hit.at > 60_000) {
        const me = await fetchMe(jwt).catch(() => null);
        if (!me) {
            token.avatarAt = Date.now() - RESYNC_MS + RETRY_MS;
            return;
        }
        hit = { src: avatarSrc(me.avatar_url), at: Date.now() };
        recent.set(jwt, hit);
        if (recent.size > 500) recent.delete(recent.keys().next().value as string);
    }
    if (hit.src) token.picture = hit.src;
    token.avatarAt = Date.now();
}

/** תשובת GET /api/me/avatar: התמונה המוטבעת של המשתמש המחובר, או 404 */
export function myAvatarResponse(raw: string | null | undefined): Response {
    const m = /^data:(image\/[\w+.-]+);base64,(.*)$/s.exec(raw ?? '');
    if (!m) return new Response(null, { status: 404, headers: { 'cache-control': 'private, no-store' } });
    const buf = Buffer.from(m[2], 'base64');
    return new Response(new Uint8Array(buf), {
        headers: {
            'content-type': m[1],
            'content-length': String(buf.byteLength),
            // ?v= מתחלף עם התמונה — קאש ארוך, בדפדפן בלבד (תמונה של משתמש מחובר)
            'cache-control': 'private, max-age=31536000, immutable',
            'x-content-type-options': 'nosniff',
            'content-security-policy': "default-src 'none'; sandbox"
        }
    });
}
