// ============================================================
// ownerOtp.ts — העברת בעלות מיידית בקוד לטלפון של הגמ"ח
//
// למי זה מגיע: כל גמ"ח פעיל בלי בעלים (כולל ייבוא/גילוי חכם) שיש בו
// נייד תקין — הקוד נשלח לטלפון שבכרטיס, ומי שמחזיק את הטלפון הזה הוא
// הבעלים. גמ"ח בלי נייד (או כש-SMS לא מוגדר) נשאר בתביעת הבעלות
// הרגילה עם אישור אדמין (claimsStore).
//
// ההוכחה: הקוד נשלח לטלפון ששמור על הגמ"ח עצמו — רק מי שמחזיק את
// הטלפון הזה יכול לאמת. הקוד נשמר מגובב (sha256 + AUTH_SECRET) בתוך
// extra_fields.owner_otp של הפריט — לא בזיכרון, כי כל בקשת Vercel
// עשויה לפגוש אינסטנס אחר.
// ============================================================

import { createHash, randomInt } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { strapiGet, strapiPut } from './strapiClient.js';
import { invalidateGemachCache } from './db.js';
import { smsEnabled, sendSms, toMobileE164 } from './sms.js';

const OTP_TTL_MS = 10 * 60_000;   // תוקף הקוד
const RESEND_MS = 60_000;         // מרווח מינימלי בין שליחות
const MAX_TRIES = 5;              // ניסיונות הקלדה עד ביטול הקוד

interface RawItem {
    documentId: string;
    label: string;
    phone: string | null;
    user_id: string | null;
    status1: string | null;
    extra_fields: Record<string, unknown> | null;
}

function hashCode(code: string, gemachId: string): string {
    return createHash('sha256').update(`${code}:${gemachId}:${env.AUTH_SECRET ?? ''}`).digest('hex');
}

async function fetchItem(gemachId: string): Promise<RawItem | null> {
    const res = await strapiGet<{ data: RawItem | null }>(`/api/items/${gemachId}`);
    return res.data ?? null;
}

/** האם הפריט זכאי למסלול המהיר: בלי בעלים אמיתי, פעיל, עם נייד תקין.
 *  "sheet:" של פריט מיובא אינו בעלים — הטלפון שבכרטיס הוא ההוכחה. */
function eligibility(item: RawItem | null): { ok: boolean; e164?: string } {
    if (!item) return { ok: false };
    const oid = (item.user_id ?? '').trim();
    if (oid !== '' && !oid.startsWith('sheet:')) return { ok: false };
    if (item.status1 !== 'active') return { ok: false };
    const e164 = toMobileE164(item.phone ?? '');
    if (!e164) return { ok: false };
    return { ok: true, e164 };
}

/** ל-load של דף הגמ"ח: האם להציג את המסלול המהיר, ואיזה זנב-טלפון להראות */
export async function getFastClaimState(
    gemachId: string,
): Promise<{ available: boolean; phoneTail: string }> {
    if (!smsEnabled()) return { available: false, phoneTail: '' };
    try {
        const item = await fetchItem(gemachId);
        const { ok } = eligibility(item);
        const digits = (item?.phone ?? '').replace(/\D/g, '');
        return { available: ok, phoneTail: ok ? digits.slice(-4) : '' };
    } catch {
        return { available: false, phoneTail: '' };
    }
}

export type OtpResult =
    | { ok: true }
    | { ok: false; error: string };

/** שולח קוד אימות לטלפון של הגמ"ח */
export async function requestOwnerCode(gemachId: string): Promise<OtpResult> {
    if (!smsEnabled()) return { ok: false, error: 'שליחת SMS אינה זמינה כרגע' };
    const item = await fetchItem(gemachId);
    const elig = eligibility(item);
    if (!item || !elig.ok || !elig.e164) {
        return { ok: false, error: 'הגמ"ח הזה אינו זכאי לאימות מהיר — שלחו בקשת בעלות רגילה' };
    }

    const extra = { ...((item.extra_fields ?? {}) as Record<string, unknown>) };
    const prev = (typeof extra.owner_otp === 'object' && extra.owner_otp !== null)
        ? (extra.owner_otp as Record<string, unknown>)
        : null;
    if (prev && typeof prev.sent_at === 'string') {
        const since = Date.now() - Date.parse(prev.sent_at);
        if (since >= 0 && since < RESEND_MS) {
            return { ok: false, error: 'קוד כבר נשלח — המתינו דקה לפני שליחה חוזרת' };
        }
    }

    const code = String(randomInt(100000, 1000000));
    extra.owner_otp = {
        h: hashCode(code, gemachId),
        exp: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        tries: 0,
        sent_at: new Date().toISOString(),
    };

    // קודם שולחים, ואז שומרים — קוד שנכשל בשליחה לא ננעל על הפריט
    try {
        await sendSms(elig.e164, `קוד האימות שלך לגמ"ח "${item.label}" באתר הגמ"ח הארצי: ${code}`);
    } catch (e) {
        console.error('[owner-otp] sendSms failed:', e);
        return { ok: false, error: 'שליחת הקוד נכשלה — נסו שוב בעוד רגע' };
    }
    await strapiPut(`/api/items/${gemachId}`, { data: { extra_fields: extra } });
    return { ok: true };
}

/** מאמת קוד ומעביר בעלות. ownerId — המזהה שיירשם (ownerIdForSession). */
export async function verifyOwnerCode(
    gemachId: string,
    code: string,
    ownerId: string,
): Promise<OtpResult> {
    if (!ownerId.trim()) return { ok: false, error: 'אין מזהה משתמש בסשן — התחברו מחדש' };
    const clean = (code ?? '').replace(/\D/g, '');
    if (clean.length !== 6) return { ok: false, error: 'הקוד הוא 6 ספרות' };

    const item = await fetchItem(gemachId);
    const elig = eligibility(item);
    if (!item || !elig.ok) {
        return { ok: false, error: 'הגמ"ח כבר אינו זמין לאימות מהיר' };
    }

    const extra = { ...((item.extra_fields ?? {}) as Record<string, unknown>) };
    const otp = (typeof extra.owner_otp === 'object' && extra.owner_otp !== null)
        ? (extra.owner_otp as Record<string, unknown>)
        : null;
    if (!otp || typeof otp.h !== 'string') {
        return { ok: false, error: 'לא נשלח קוד — לחצו קודם על "שלחו לי קוד"' };
    }
    if (typeof otp.exp !== 'string' || Date.now() > Date.parse(otp.exp)) {
        return { ok: false, error: 'תוקף הקוד פג — שלחו קוד חדש' };
    }
    const tries = typeof otp.tries === 'number' ? otp.tries : 0;
    if (tries >= MAX_TRIES) {
        return { ok: false, error: 'יותר מדי ניסיונות — שלחו קוד חדש' };
    }

    if (hashCode(clean, gemachId) !== otp.h) {
        extra.owner_otp = { ...otp, tries: tries + 1 };
        await strapiPut(`/api/items/${gemachId}`, { data: { extra_fields: extra } });
        return { ok: false, error: 'קוד שגוי — בדקו ונסו שוב' };
    }

    // הצלחה: רושמים בעלות, מוחקים את הקוד ואת אסימון-האורח (הגמ"ח אומץ)
    delete extra.owner_otp;
    delete extra.guest_claim;
    await strapiPut(`/api/items/${gemachId}`, {
        data: { user_id: ownerId, extra_fields: extra },
    });
    invalidateGemachCache();
    return { ok: true };
}
