// ============================================================
// userPhone.ts — הנייד המאומת של המשתמש המחובר
//
// למה: משתמש שנרשם דרך Google מגיע בלי טלפון בסשן (OAuth לא מחזיר
// מספר), ולכן הזיהוי האוטומטי "אולי הגמ"ח הזה שלך?" (findClaimableByPhone
// והצלבת isClaimMatch) לא עובד עבורו. כאן הוא מוסיף את הנייד בעצמו
// ומאמת אותו בקוד SMS — ומאותו רגע ההצלבה מול הכרטיסים עובדת מעצמה.
//
// אחסון: פריט אחד לכל משתמש ב-items תחת קטגוריה __ng_user_phone
// (label = האימייל, כמו שאר החנויות הפנימיות — claimsStore/adsStore).
// מצב ה-OTP נשמר על הפריט עצמו ולא בעוגייה — עוגייה ניתנת לשחזור
// (replay) ומאפשרת איפוס מונה-הניסיונות; הפריט לא.
//
// אחרי אימות מוצלח הנייד נכתב גם על רשומת המשתמש ב-Strapi המשותף
// (best-effort) — כך הוא זורם לסשן בהתחברויות credentials/SSO הבאות
// וזמין גם לאתרים התאומים.
// ============================================================

import { createHash, randomInt } from 'node:crypto';
import { env } from '$env/dynamic/private';
import { strapiGet, strapiPost, strapiPut, StrapiContentTypeError } from './strapiClient.js';
import { smsEnabled, sendSms, toMobileE164 } from './sms.js';

const CATEGORY = '__ng_user_phone';
const OTP_TTL_MS = 10 * 60_000;   // תוקף הקוד
const RESEND_MS = 60_000;         // מרווח מינימלי בין שליחות
const MAX_TRIES = 5;              // ניסיונות הקלדה עד ביטול הקוד

interface PhoneItem {
    documentId: string;
    label: string;
    extra_fields: Record<string, unknown> | null;
}

export type PhoneOtpResult = { ok: true } | { ok: false; error: string };

function normEmail(email: string | null | undefined): string {
    return (email ?? '').trim().toLowerCase();
}

function hashCode(code: string, email: string): string {
    return createHash('sha256').update(`${code}:${email}:${env.AUTH_SECRET ?? ''}`).digest('hex');
}

/** E.164 ‎+9725x → תצוגה מקומית 05x (כך שמור גם על כרטיסי הגמ"חים) */
function e164ToLocal(e164: string): string {
    return '0' + e164.replace(/^\+972/, '');
}

async function findItem(email: string): Promise<PhoneItem | null> {
    try {
        const res = await strapiGet<{ data: PhoneItem[] }>('/api/items', {
            'filters[category][$eq]': CATEGORY,
            'filters[label][$eq]': email,
            'pagination[limit]': '1',
        });
        return res.data?.[0] ?? null;
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return null;
        throw e;
    }
}

// מטמון קצר לקריאה בכל טעינת עמוד (פרופיל / דף גמ"ח) — כמו בשאר החנויות
const cache = new Map<string, { at: number; phone: string }>();
const CACHE_TTL = 60_000;
function invalidate(email: string) { cache.delete(email); }

/**
 * הנייד של המשתמש: מהסשן אם קיים (credentials/SSO מביאים אותו מרשומת
 * ה-Strapi), אחרת הנייד שאומת כאן. '' = אין — וזה הטריגר לבאנר בפרופיל.
 */
export async function getVerifiedPhone(
    user: { email?: string | null; phone?: string | null },
): Promise<string> {
    const sessionPhone = (user.phone ?? '').trim();
    if (sessionPhone) return sessionPhone;
    const email = normEmail(user.email);
    if (!email) return '';

    const hit = cache.get(email);
    if (hit && Date.now() - hit.at < CACHE_TTL) return hit.phone;

    let phone = '';
    try {
        const item = await findItem(email);
        const x = (item?.extra_fields ?? {}) as Record<string, unknown>;
        if (typeof x.phone === 'string') phone = x.phone;
    } catch (e) {
        console.warn('[user-phone] getVerifiedPhone failed:', e instanceof Error ? e.message : e);
        return '';
    }
    cache.set(email, { at: Date.now(), phone });
    return phone;
}

/** האם להציג את באנר "הוסיפו נייד" — אין נייד ויש דרך לאמת אחד */
export async function needsPhone(
    user: { email?: string | null; phone?: string | null },
): Promise<boolean> {
    if (!smsEnabled()) return false;
    return (await getVerifiedPhone(user)) === '';
}

/** שולח קוד אימות לנייד שהמשתמש הקליד, ושומר את מצב ה-OTP על הפריט שלו */
export async function requestPhoneCode(
    user: { email?: string | null },
    rawPhone: string,
): Promise<PhoneOtpResult> {
    if (!smsEnabled()) return { ok: false, error: 'שליחת SMS אינה זמינה כרגע' };
    const email = normEmail(user.email);
    if (!email) return { ok: false, error: 'אין אימייל בסשן — התחברו מחדש' };
    const e164 = toMobileE164(rawPhone);
    if (!e164) return { ok: false, error: 'המספר לא נראה כמו נייד ישראלי תקין (05xxxxxxxx)' };

    const item = await findItem(email);
    const extra = { ...((item?.extra_fields ?? {}) as Record<string, unknown>) };
    const prev = (typeof extra.otp === 'object' && extra.otp !== null)
        ? (extra.otp as Record<string, unknown>)
        : null;
    if (prev && typeof prev.sent_at === 'string') {
        const since = Date.now() - Date.parse(prev.sent_at);
        if (since >= 0 && since < RESEND_MS) {
            return { ok: false, error: 'קוד כבר נשלח — המתינו דקה לפני שליחה חוזרת' };
        }
    }

    const code = String(randomInt(100000, 1000000));
    extra.otp = {
        h: hashCode(code, email),
        phone: e164ToLocal(e164),
        exp: new Date(Date.now() + OTP_TTL_MS).toISOString(),
        tries: 0,
        sent_at: new Date().toISOString(),
    };

    // קודם שולחים, ואז שומרים — קוד שנכשל בשליחה לא ננעל על הפריט
    try {
        await sendSms(e164, `קוד האימות שלך לאתר הגמ"ח הארצי: ${code}`);
    } catch (e) {
        console.error('[user-phone] sendSms failed:', e);
        return { ok: false, error: 'שליחת הקוד נכשלה — נסו שוב בעוד רגע' };
    }

    if (item) {
        await strapiPut(`/api/items/${item.documentId}`, { data: { extra_fields: extra } });
    } else {
        await strapiPost('/api/items', {
            data: {
                label: email,
                category: CATEGORY,
                description: 'נייד מאומת של משתמש',
                icon: '📱',
                status1: 'active',
                extra_fields: extra,
                publishedAt: new Date().toISOString(),
            },
        });
    }
    return { ok: true };
}

/** מאמת את הקוד; בהצלחה — הנייד נשמר כמאומת ומסונכרן לרשומת המשתמש */
export async function verifyPhoneCode(
    user: { email?: string | null },
    code: string,
): Promise<PhoneOtpResult> {
    const email = normEmail(user.email);
    if (!email) return { ok: false, error: 'אין אימייל בסשן — התחברו מחדש' };
    const clean = (code ?? '').replace(/\D/g, '');
    if (clean.length !== 6) return { ok: false, error: 'הקוד הוא 6 ספרות' };

    const item = await findItem(email);
    const extra = { ...((item?.extra_fields ?? {}) as Record<string, unknown>) };
    const otp = (typeof extra.otp === 'object' && extra.otp !== null)
        ? (extra.otp as Record<string, unknown>)
        : null;
    if (!item || !otp || typeof otp.h !== 'string' || typeof otp.phone !== 'string') {
        return { ok: false, error: 'לא נשלח קוד — לחצו קודם על שליחת קוד' };
    }
    if (typeof otp.exp !== 'string' || Date.now() > Date.parse(otp.exp)) {
        return { ok: false, error: 'תוקף הקוד פג — שלחו קוד חדש' };
    }
    const tries = typeof otp.tries === 'number' ? otp.tries : 0;
    if (tries >= MAX_TRIES) {
        return { ok: false, error: 'יותר מדי ניסיונות — שלחו קוד חדש' };
    }

    if (hashCode(clean, email) !== otp.h) {
        extra.otp = { ...otp, tries: tries + 1 };
        await strapiPut(`/api/items/${item.documentId}`, { data: { extra_fields: extra } });
        return { ok: false, error: 'קוד שגוי — בדקו ונסו שוב' };
    }

    const phone = otp.phone;
    delete extra.otp;
    extra.phone = phone;
    extra.verified_at = new Date().toISOString();
    await strapiPut(`/api/items/${item.documentId}`, { data: { extra_fields: extra } });
    invalidate(email);

    // סנכרון לרשומת המשתמש המשותפת — כשל כאן לא מבטל את האימות
    try {
        // users-permissions מחזיר מערך שטוח וגוף עדכון שטוח (בלי { data })
        const users = await strapiGet<Array<{ id: number }>>('/api/users', {
            'filters[email][$eq]': email,
        });
        const uid = users?.[0]?.id;
        if (uid) await strapiPut(`/api/users/${uid}`, { phone });
    } catch (e) {
        console.warn('[user-phone] user record sync failed:', e instanceof Error ? e.message : e);
    }
    return { ok: true };
}
