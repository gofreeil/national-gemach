// ============================================================
// visitorStats.ts — מונה גולשים בעומס אפסי
//
// עיקרון: קריאה ל-Google Analytics מתבצעת לכל היותר פעם ב-~24 שעות,
// ורק כשאדמין נכנס לפאנל (getVisitorCount לצד-הציבור לא קורא ל-GA בכלל —
// הוא מחזיר את הערך השמור ב-config, שכבר נטען ממילא). כך גם 13 אתרים
// לא יוצרים עומס.
//
// דרוש (משתני סביבה בשרת — service account אחד יכול לשמש את כל האתרים):
//   GA_PROPERTY_ID        מזהה ה-Property המספרי של GA4 (לא G-XXXX)
//   GA_SA_CLIENT_EMAIL    האימייל של ה-service account
//   GA_SA_PRIVATE_KEY     המפתח הפרטי (עם \n או שורות ממש)
// ============================================================

import { createSign } from 'crypto';
import { env } from '$env/dynamic/private';
import { getConfigValue, setConfigValue } from './adminStore.js';

const PROPERTY_ID = (env.GA_PROPERTY_ID ?? '').trim();
const SA_EMAIL    = (env.GA_SA_CLIENT_EMAIL ?? '').trim();
// תומך גם במפתח עם \n מילוליים (כפי שנשמר לרוב במשתני סביבה) וגם בשורות אמיתיות
const SA_KEY      = (env.GA_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');

const REFRESH_MS = 15 * 60 * 1000;           // 15 דקות בין רענוני GA (96 פעמים ביום, מתוזמן ב-Cron)
const STALE_MS   = 30 * 24 * 60 * 60 * 1000; // מעבר לכך — נחשב ישן מדי, נחזיר fallback
const LABEL = 'גולשים השבוע';

interface VisitorStat {
    count: number;
    updatedAt: number;
    label?: string;
}

// מונע רענון כפול באותו מופע (thundering herd)
let refreshing = false;
// מטמון access token (בתוקף ~שעה)
let tokenCache: { token: string; exp: number } | null = null;

function b64url(buf: Buffer | string): string {
    return (typeof buf === 'string' ? Buffer.from(buf) : buf)
        .toString('base64')
        .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(): Promise<string | null> {
    if (!SA_EMAIL || !SA_KEY) return null;
    if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({
        iss: SA_EMAIL,
        scope: 'https://www.googleapis.com/auth/analytics.readonly',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: now + 3600
    }));
    const signingInput = `${header}.${claim}`;

    let signature: string;
    try {
        const signer = createSign('RSA-SHA256');
        signer.update(signingInput);
        signature = b64url(signer.sign(SA_KEY));
    } catch (e) {
        console.error('[visitorStats] JWT sign failed (bad GA_SA_PRIVATE_KEY?):', e);
        return null;
    }
    const assertion = `${signingInput}.${signature}`;

    try {
        const res = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion
            })
        });
        if (!res.ok) {
            console.error('[visitorStats] token exchange failed:', res.status, await res.text());
            return null;
        }
        const j = (await res.json()) as { access_token?: string; expires_in?: number };
        if (!j.access_token) return null;
        tokenCache = { token: j.access_token, exp: Date.now() + (j.expires_in ?? 3600) * 1000 };
        return j.access_token;
    } catch (e) {
        console.error('[visitorStats] token request error:', e);
        return null;
    }
}

/** קורא מ-GA את מספר הגולשים ב-7 הימים האחרונים */
async function fetchFromGA(): Promise<number | null> {
    if (!PROPERTY_ID) return null;
    const token = await getAccessToken();
    if (!token) return null;
    try {
        const res = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:runReport`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dateRanges: [{ startDate: '7daysAgo', endDate: 'today' }],
                    metrics: [{ name: 'activeUsers' }]
                })
            }
        );
        if (!res.ok) {
            console.error('[visitorStats] runReport failed:', res.status, await res.text());
            return null;
        }
        const j = (await res.json()) as { rows?: { metricValues?: { value?: string }[] }[] };
        const raw = j.rows?.[0]?.metricValues?.[0]?.value;
        const n = Number(raw);
        return isNaN(n) ? null : n;
    } catch (e) {
        console.error('[visitorStats] runReport error:', e);
        return null;
    }
}

/**
 * מרענן את המונה מ-GA אם עברו ~24 שעות מהרענון האחרון.
 * נקרא רק מצד-האדמין (admin/+layout.server). לא חוסם אם אין הגדרות/נכשל.
 */
export async function refreshVisitorStatsIfStale(force = false): Promise<void> {
    if (!PROPERTY_ID || !SA_EMAIL || !SA_KEY) return; // GA לא מוגדר — אין מה לרענן
    if (refreshing) return;

    const cur = await getConfigValue<VisitorStat>('visitors');
    if (!force && cur?.updatedAt && Date.now() - cur.updatedAt < REFRESH_MS) return;

    refreshing = true;
    try {
        const count = await fetchFromGA();
        if (count !== null) {
            await setConfigValue('visitors', { count, updatedAt: Date.now(), label: LABEL } satisfies VisitorStat);
        }
    } finally {
        refreshing = false;
    }
}

/**
 * מחזיר את המונה השמור (ללא קריאה ל-GA). מוחזר null אם אין נתון או שהוא ישן מדי —
 * ואז ההאדר מציג מונה fallback חלק.
 */
export async function getVisitorCount(): Promise<{ count: number; label: string } | null> {
    try {
        const cur = await getConfigValue<VisitorStat>('visitors');
        if (cur && typeof cur.count === 'number' && cur.updatedAt && Date.now() - cur.updatedAt < STALE_MS) {
            return { count: cur.count, label: cur.label ?? LABEL };
        }
    } catch { /* fallback */ }
    return null;
}
