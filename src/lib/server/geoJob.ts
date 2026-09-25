// ============================================================
// geoJob.ts — הצבה אוטומטית של גמ"חים על המפה של "קהילה בשכונה"
//
// רץ פעם ביום (Vercel Cron → /api/cron/geo), וגם ידנית ממסך האדמין:
//
//   1. גמ"ח בלי קואורדינטות → הגיאוקודר החכם (geocode.ts) מוצא לו מיקום,
//      מהבית המדויק ועד מרכז היישוב. כמעט כל גמ"ח עם עיר עולה למפה מיד.
//   2. יממה אחרי שהמיקום נקבע: אם הפין משוער (רחוב/שכונה/מרכז יישוב) או
//      שלא נמצא בכלל — נשלח SMS אחד לנייד שבכרטיס: "קהילה בשכונה מסונכרן
//      עם אתר הגמ"חים הארצי… הצבנו כאן — האם נכון? אשרו או דייקו", עם
//      קישור חתום לעמוד דקירת המפה (/l/<token>) שלא דורש התחברות.
//
// כל גמ"ח מקבל לכל היותר בקשה אחת (extra_fields.geo.asked). לא נשלח למי
// שביקש להסיר את עצמו מהודעות, ולא לגמ"ח שהסתיר את כתובתו (הפין הגס
// שלו מכוון). אפשר לכבות את השליחה ממסך "גמ"חים לא מלאים".
// ============================================================

import { getAllGemachim, geocodeGemachById, patchGemachGeo } from './db';
import { hasValidCoords } from './geocode';
import { getConfigValue, setConfigValue } from './adminStore';
import { declineToken, geoToken, getInviteLog } from './claimInvite';
import { sendSms, smsEnabled, toMobileE164 } from './sms';
import { isApproxGeo, type Gemach } from '$lib/gemachData';
import { SITE_URL } from '$lib/seo';

const DAY_MS = 24 * 3600 * 1000;
// ניסיון חוזר לגמ"ח שלא נמצא — אולי מישהו השלים לו עיר/כתובת בינתיים
const RETRY_FAILED_MS = 7 * DAY_MS;
const MAX_SMS_PER_RUN = 25;
const OFF_KEY = 'geo_notify_off';

export async function isGeoNotifyOff(): Promise<boolean> {
    return (await getConfigValue<boolean>(OFF_KEY).catch(() => undefined)) === true;
}

export async function setGeoNotifyOff(off: boolean): Promise<void> {
    await setConfigValue(OFF_KEY, off);
}

const age = (iso: string | undefined) => (iso ? Date.now() - Date.parse(iso) : Infinity);

/** צריך גיאוקודינג: אין פין, ולא ניסינו לאחרונה */
function needsGeocode(g: Gemach): boolean {
    if (hasValidCoords(g.lat, g.lng)) return false;
    return !g.geo || (g.geo.p === null && age(g.geo.at) > RETRY_FAILED_MS);
}

/** ממתין לבקשת אישור/דיוק מהבעלים (בלי לבדוק טלפון/הסרה) */
export function awaitsOwnerPin(g: Gemach): boolean {
    const geo = g.geo;
    if (!geo || geo.asked || geo.ok || g.hideAddress || g.wrongPhone) return false;
    return geo.p === null || isApproxGeo(geo.p);
}

export function renderGeoRequest(g: Pick<Gemach, 'id' | 'name' | 'contact' | 'lat' | 'lng'>): string {
    const name = (g.contact ?? '').trim();
    const placed = hasValidCoords(g.lat, g.lng);
    return [
        `שלום${name ? ' ' + name : ''}, אתר "קהילה בשכונה" מסונכרן עם אתר הגמ"חים הארצי ומעוניין להציג את הגמ"ח "${g.name.trim()}" על המפה.`,
        placed
            ? 'הצבנו אותו במיקום משוער — האם הוא נכון? אפשר לאשר או לדייק בנגיעה במפה:'
            : 'לא הצלחנו לאתר את הכתובת — נשמח שתסמנו את המקום על המפה ותשלימו את הפרטים:',
        `${SITE_URL}/l/${geoToken(g.id)}`,
        `לא שלכם / הסרה מהודעות: ${SITE_URL}/d/${declineToken(g.id)}`,
    ].join('\n');
}

export interface GeoJobResult {
    geocoded: number;
    notFound: number;
    /** נשארו לריצה הבאה (נגמר הזמן) */
    pendingGeocode: number;
    smsSent: number;
    smsFailed: number;
    smsSkipped: string | null;
}

export async function runGeoJob(opts: { budgetMs?: number } = {}): Promise<GeoJobResult> {
    const deadline = Date.now() + (opts.budgetMs ?? 45_000);
    const res: GeoJobResult = { geocoded: 0, notFound: 0, pendingGeocode: 0, smsSent: 0, smsFailed: 0, smsSkipped: null };

    // 1. הצבה על המפה
    const todo = (await getAllGemachim()).filter(needsGeocode);
    for (const g of todo) {
        if (Date.now() > deadline) {
            res.pendingGeocode++;
            continue;
        }
        try {
            const c = await geocodeGemachById(g.id);
            if (c && c.lat !== null) res.geocoded++;
            else res.notFound++;
        } catch (e) {
            console.error('[geo-job] geocode failed for', g.id, e);
            res.notFound++;
        }
    }

    // 2. בקשת אישור/דיוק מהבעלים — יממה אחרי ההצבה
    if (!smsEnabled()) res.smsSkipped = 'no-sms-provider';
    else if (await isGeoNotifyOff()) res.smsSkipped = 'disabled';
    if (res.smsSkipped) return res;

    const log = await getInviteLog().catch(() => ({}) as Awaited<ReturnType<typeof getInviteLog>>);
    const due = (await getAllGemachim()).filter((g) =>
        awaitsOwnerPin(g)
        && age(g.geo?.at) >= DAY_MS
        && !log[g.id]?.declinedAt
        && !!toMobileE164(g.phone ?? ''),
    );
    for (const g of due.slice(0, MAX_SMS_PER_RUN)) {
        if (Date.now() > deadline + 10_000) break;
        try {
            await sendSms(toMobileE164(g.phone ?? '') as string, renderGeoRequest(g));
            await patchGemachGeo(g.id, { asked: new Date().toISOString() });
            res.smsSent++;
        } catch (e) {
            console.error('[geo-job] sms failed for', g.id, e instanceof Error ? e.message : e);
            res.smsFailed++;
        }
    }
    return res;
}
