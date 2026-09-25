// ============================================================
// claimInvite.ts — הזמנה ב-SMS לבעלי גמ"חים לקבל בעלות על הכרטיס שלהם
//
// (אותו מנגנון כמו claimSms של "אינדקס בעלי עסקים", מותאם לגמ"חים.)
//
// מסך /admin/invites מציג את כל הגמ"חים הפעילים שעדיין בלי בעלים ויש
// בכרטיס שלהם נייד. האדמין שולח לכל אחד SMS עם שני קישורים קצרים:
//
//   {link}     /c/<id>.<sig> — שם עוגיית הזמנה חתומה ומפנה לדף הגמ"ח.
//              הקישור החתום נשלח רק לנייד שבכרטיס, ולכן מי שנכנס דרכו
//              מקבל בעלות בלחיצה אחת אחרי התחברות — בלי אישור אדמין.
//              קישורים ישנים בלי חתימה (/c/<id>) רק פותחים את התיבה —
//              שם ההוכחה נשארת קוד ה-SMS לנייד שבכרטיס (ownerOtp).
//   {decline}  /d/<token> — קישור חתום, בלי להתחבר, עם שתי בחירות:
//              "הגמ"ח לא שלי" (מסמן את הכרטיס לבדיקת אדמין — הנייד שגוי)
//              או "שלי, אבל לא מעוניין". בשתיהן המסך חוסם שליחה חוזרת.
//
// הנוסח והיומן נשמרים בהגדרות הכלליות (__ng_config).
// ============================================================

import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Cookies } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { getConfigValue, setConfigValue } from './adminStore';
import { strapiGetAll } from './strapiClient.js';
import { toMobileE164 } from './sms';
import { markGemachWrongPhone } from './db';

const TEMPLATE_KEY = 'claim_invite_template';
const LOG_KEY = 'claim_invite_log';
const INVITE_COOKIE = 'ng_invite';
const INVITE_COOKIE_DAYS = 30;
// SMS בעברית הוא 70 תווים למקטע — גג סביר כדי שהנוסח לא יתפוצץ לחמישה מקטעים
export const MAX_SMS_CHARS = 480;

// כל קישור בשורה משלו אחרי המלל שמסביר אותו — ב-SMS אין טקסט-עוגן
export const DEFAULT_TEMPLATE =
    'שלום{name}, הגמ"ח "{gemach}" מופיע באתר הגמ"ח הארצי.\n' +
    'הגמ"ח מזוהה עם המספר שלך\n' +
    'אנא כנס כדי לקבל עליו בעלות\n' +
    'על ידי זה תוכל לעדכן את התוכן:\n' +
    'לשים פרטים לבקשת תרומות\n' +
    'ואף לקבל התראות מאנשים אם תבחר\n' +
    '{link}\n' +
    'אם הגמ"ח במקרה לא שלך נשמח שתעדכן אותנו:\n' +
    '{decline}';

export const PLACEHOLDERS = [
    { key: '{name}', help: 'איש הקשר שבכרטיס (או ריק)' },
    { key: '{gemach}', help: 'שם הגמ"ח' },
    { key: '{link}', help: 'קישור קצר לכרטיס עם תיבת קבלת הבעלות' },
    { key: '{decline}', help: 'קישור קצר "לא שלי / הסרה"' },
];

// ── נוסח ─────────────────────────────────────────────────────

export async function getInviteTemplate(): Promise<string> {
    const saved = await getConfigValue<string>(TEMPLATE_KEY).catch(() => undefined);
    const text = typeof saved === 'string' ? saved.trim() : '';
    return text || DEFAULT_TEMPLATE;
}

/** שומר נוסח חדש. ריק = חזרה לברירת המחדל. */
export async function setInviteTemplate(text: string): Promise<{ ok: true } | { ok: false; error: string }> {
    const t = String(text ?? '').trim();
    if (t.length > MAX_SMS_CHARS) return { ok: false, error: `הנוסח ארוך מדי (עד ${MAX_SMS_CHARS} תווים)` };
    if (t && !t.includes('{link}')) return { ok: false, error: 'הנוסח חייב לכלול את {link} — בלעדיו אין לאן להיכנס' };
    await setConfigValue(TEMPLATE_KEY, t);
    return { ok: true };
}

/** ממלא את הסוגריים. {name} ריק נמחק יחד עם הרווח שלפניו. */
export function renderInvite(
    template: string,
    v: { name?: string; gemach: string; link: string; decline: string },
): string {
    const name = String(v.name ?? '').trim();
    let s = String(template ?? '');
    s = name ? s.replace(/\{name\}/g, ` ${name}`).replace(/ {2,}/g, ' ') : s.replace(/\s?\{name\}/g, '');
    s = s.replace(/\{gemach\}/g, v.gemach.trim());
    s = s.replace(/\{link\}/g, v.link).replace(/\{decline\}/g, v.decline);
    return s.trim();
}

// ── חתימות וקישורים ──────────────────────────────────────────

function secret(): string {
    return env.CLAIM_LINK_SECRET || env.AUTH_SECRET || env.STRAPI_TOKEN || 'dev-only';
}

// 12 תווי hex = 48 סיביות — די מול ניחוש, וקצר ב-SMS
const SIG_LEN = 12;
const ID_RE = /^[A-Za-z0-9_-]{6,64}$/;

function sign(purpose: string, gemachId: string): string {
    return createHmac('sha256', secret()).update(`${purpose}|${gemachId}`).digest('hex').slice(0, SIG_LEN);
}

function checkSig(purpose: string, gemachId: string, sig: string): boolean {
    if (!ID_RE.test(gemachId) || !/^[0-9a-f]+$/.test(sig) || sig.length !== SIG_LEN) return false;
    return timingSafeEqual(Buffer.from(sig), Buffer.from(sign(purpose, gemachId)));
}

export function isGemachDocId(id: string): boolean {
    return ID_RE.test(id);
}

export function declineToken(gemachId: string): string {
    return `${gemachId}.${sign('decline', gemachId)}`;
}

export function verifyDeclineToken(token: string): string | null {
    const [id, sig, ...rest] = String(token ?? '').split('.');
    if (rest.length || !id || !sig) return null;
    return checkSig('decline', id, sig) ? id : null;
}

/** קישור "אשרו/דייקו את המיקום במפה" (/l/<token>) — פותח את עמוד דקירת
 *  המפה של הגמ"ח בלי התחברות. נשלח ב-SMS לנייד שבכרטיס. */
export function geoToken(gemachId: string): string {
    return `${gemachId}.${sign('geo', gemachId)}`;
}

export function verifyGeoToken(token: string): string | null {
    const [id, sig, ...rest] = String(token ?? '').split('.');
    if (rest.length || !id || !sig) return null;
    return checkSig('geo', id, sig) ? id : null;
}

/** origin = של הבקשה הנוכחית, כדי שבפריוויו הקישור יוביל לאותה סביבה */
export function inviteLinks(origin: string, gemachId: string) {
    const base = origin.replace(/\/$/, '');
    return {
        link: `${base}/c/${gemachId}.${sign('invite-link', gemachId)}`,
        decline: `${base}/d/${declineToken(gemachId)}`,
    };
}

/** מפרק את /c/<param>: קישור חתום (נשלח לנייד שבכרטיס) או ישן בלי חתימה */
export function parseInviteParam(param: string): { id: string; proof: boolean } | null {
    const [id, sig, ...rest] = String(param ?? '').split('.');
    if (rest.length || !isGemachDocId(id)) return null;
    if (!sig) return { id, proof: false };
    return checkSig('invite-link', id, sig) ? { id, proof: true } : null;
}

// proof = הגיע מהקישור החתום שנשלח לנייד שבכרטיס
const cookiePurpose = (proof: boolean) => (proof ? 'invite-proof' : 'invite');

/** מי שנכנס מקישור ההזמנה — עוגייה חתומה שמזהה את הגמ"ח */
export function setInviteCookie(cookies: Cookies, gemachId: string, proof = false): void {
    cookies.set(INVITE_COOKIE, `${gemachId}.${sign(cookiePurpose(proof), gemachId)}`, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: true,
        maxAge: INVITE_COOKIE_DAYS * 24 * 3600,
    });
}

/** האם הדפדפן הזה הגיע מקישור ההזמנה של הגמ"ח הזה */
export function hasInvite(cookies: Cookies, gemachId: string): boolean {
    const [id, sig] = String(cookies.get(INVITE_COOKIE) ?? '').split('.');
    return !!id && id === gemachId && !!sig && (checkSig('invite', id, sig) || checkSig('invite-proof', id, sig));
}

/** הגיע מהקישור החתום שנשלח לנייד שבכרטיס — מספיק לבעלות מיידית */
export function hasInviteProof(cookies: Cookies, gemachId: string): boolean {
    const [id, sig] = String(cookies.get(INVITE_COOKIE) ?? '').split('.');
    return !!id && id === gemachId && !!sig && checkSig('invite-proof', id, sig);
}

// ── יומן ──────────────────────────────────────────────────────

export interface InviteLogEntry {
    /** שליחה אחרונה */
    at?: string;
    by?: string;
    count?: number;
    /** ביקש לא לקבל הודעות (קישור "לא שלי") */
    declinedAt?: string;
    /** למה: הגמ"ח לא שלו (הנייד בכרטיס שגוי) / שלו אבל לא מעוניין */
    declineReason?: DeclineReason;
    /** נכנס לאתר מהקישור — הפעם הראשונה + מספר כניסות */
    openedAt?: string;
    opens?: number;
    /** שלח בקשת בעלות שממתינה לאדמין */
    claimRequestedAt?: string;
    /** קיבל בעלות (מיידית / בקוד) */
    claimedAt?: string;
}

export async function getInviteLog(): Promise<Record<string, InviteLogEntry>> {
    const raw = await getConfigValue(LOG_KEY).catch(() => undefined);
    return raw && typeof raw === 'object' ? (raw as Record<string, InviteLogEntry>) : {};
}

async function patchLog(gemachId: string, patch: (cur: InviteLogEntry) => InviteLogEntry): Promise<void> {
    const log = { ...(await getInviteLog()) };
    log[gemachId] = patch(log[gemachId] ?? {});
    await setConfigValue(LOG_KEY, log);
}

/** רושם שליחה. נכשל בשקט — ה-SMS כבר יצא, והיומן הוא נוחות בלבד. */
export async function recordInviteSent(gemachId: string, by: string): Promise<void> {
    try {
        await patchLog(gemachId, (c) => ({ ...c, at: new Date().toISOString(), by, count: (c.count ?? 0) + 1 }));
    } catch (e) {
        console.error('[claim-invite] log failed:', e instanceof Error ? e.message : e);
    }
}

export type DeclineReason = 'not_mine' | 'opt_out';

/** "לא שלי" מסמן גם את הכרטיס לבדיקת אדמין — הנייד בו כנראה שגוי */
export async function recordInviteDeclined(gemachId: string, reason: DeclineReason): Promise<void> {
    await patchLog(gemachId, (c) => ({ ...c, declinedAt: c.declinedAt ?? new Date().toISOString(), declineReason: reason }));
    if (reason === 'not_mine') await markGemachWrongPhone(gemachId);
}

/** אדמין: הסירוב נרשם בטעות (למשל בעלים שקיבל הודעה שלא הייתה צריכה לצאת) —
 *  מוחק אותו מהיומן ומכבה את דגל "טלפון שגוי" */
export async function undoInviteDeclined(gemachId: string): Promise<void> {
    await patchLog(gemachId, ({ declinedAt: _d, declineReason: _r, ...rest }) => rest);
    // גמ"ח שכבר נמחק — אין דגל לכבות
    await markGemachWrongPhone(gemachId, false).catch(() => {});
}

/** מעקב: כניסה / בקשת בעלות / קבלת בעלות. נכשל בשקט — לא חוסם את המשתמש. */
export async function recordInviteEvent(gemachId: string, kind: 'open' | 'request' | 'claimed'): Promise<void> {
    const now = new Date().toISOString();
    try {
        await patchLog(gemachId, (c) =>
            kind === 'open' ? { ...c, openedAt: c.openedAt ?? now, opens: (c.opens ?? 0) + 1 }
            : kind === 'request' ? { ...c, claimRequestedAt: c.claimRequestedAt ?? now }
            : { ...c, claimedAt: c.claimedAt ?? now });
    } catch (e) {
        console.error('[claim-invite] track failed:', e instanceof Error ? e.message : e);
    }
}

// ── מי זכאי להזמנה ───────────────────────────────────────────

interface RawRow {
    documentId: string;
    label: string | null;
    phone: string | null;
    contact: string | null;
    city: string | null;
    user_id: string | null;
}

export interface InviteCandidate {
    id: string;
    name: string;
    city: string;
    contact: string;
    /** 4 הספרות האחרונות של הנייד — הסוד המלא לא נשלח לדפדפן */
    phoneTail: string;
}

/** כל הגמ"חים הפעילים בלי בעלים אמיתי (ריק או "sheet:" של ייבוא) שהטלפון
 *  הראשי שלהם נייד — זה המספר שאליו ownerOtp ישלח את קוד האימות. */
export async function listInviteCandidates(): Promise<{
    candidates: InviteCandidate[];
    owned: number;
    noMobile: number;
    /** גמ"חים שכבר יש להם בעלים — לשיוך מול יומן ההזמנות */
    ownedRows: { id: string; name: string; city: string }[];
}> {
    const rows = await strapiGetAll<RawRow>('/api/items', {
        'filters[category][$eq]': 'gemachim',
        'filters[status1][$eq]': 'active',
        'fields[0]': 'documentId',
        'fields[1]': 'label',
        'fields[2]': 'phone',
        'fields[3]': 'contact',
        'fields[4]': 'city',
        'fields[5]': 'user_id',
        sort: 'label:asc',
    });
    const candidates: InviteCandidate[] = [];
    const ownedRows: { id: string; name: string; city: string }[] = [];
    let noMobile = 0;
    for (const r of rows) {
        const oid = (r.user_id ?? '').trim();
        if (oid && !oid.startsWith('sheet:')) {
            ownedRows.push({ id: r.documentId, name: r.label ?? '', city: r.city ?? '' });
            continue;
        }
        if (!toMobileE164(r.phone ?? '')) { noMobile++; continue; }
        candidates.push({
            id: r.documentId,
            name: r.label ?? '',
            city: r.city ?? '',
            contact: (r.contact ?? '').trim(),
            phoneTail: (r.phone ?? '').replace(/\D/g, '').slice(-4),
        });
    }
    return { candidates, owned: ownedRows.length, noMobile, ownedRows };
}

/** פרטי השליחה לגמ"ח אחד, מחושבים מחדש בשרת (לא סומכים על הדפדפן) */
export async function inviteTarget(gemachId: string): Promise<(RawRow & { e164: string }) | null> {
    if (!isGemachDocId(gemachId)) return null;
    const rows = await strapiGetAll<RawRow & { status1: string | null }>('/api/items', {
        'filters[documentId][$eq]': gemachId,
        'fields[0]': 'documentId',
        'fields[1]': 'label',
        'fields[2]': 'phone',
        'fields[3]': 'contact',
        'fields[4]': 'city',
        'fields[5]': 'user_id',
        'fields[6]': 'status1',
    });
    const r = rows[0];
    if (!r || r.status1 !== 'active') return null;
    const oid = (r.user_id ?? '').trim();
    if (oid && !oid.startsWith('sheet:')) return null;
    const e164 = toMobileE164(r.phone ?? '');
    return e164 ? { ...r, e164 } : null;
}
