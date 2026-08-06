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
// הדומיין של האתר הזה — מסננים לפיו כדי לספור רק את הגולשים של האתר הזה
// (הנכס ב-GA משותף לכמה אתרים; כל אתר סופר רק את עצמו). ניתן לעקוף ב-GA_HOSTNAME.
const HOSTNAME = (env.GA_HOSTNAME ?? 'gemach.gofreeil.com').trim();

// טעינת פרטי ה-service account. שתי דרכים:
//  1. GA_SA_JSON — כל קובץ ה-JSON שהורד (הכי קל: העתק-הדבק את כולו).
//  2. שני משתנים נפרדים: GA_SA_CLIENT_EMAIL + GA_SA_PRIVATE_KEY.
function loadCredentials(): { clientEmail: string; privateKey: string } | null {
    const rawJson = (env.GA_SA_JSON ?? '').trim();
    if (rawJson) {
        try {
            const j = JSON.parse(rawJson) as { client_email?: string; private_key?: string };
            if (j.client_email && j.private_key) {
                return { clientEmail: j.client_email, privateKey: j.private_key };
            }
        } catch (e) {
            console.error('[visitorStats] GA_SA_JSON parse failed:', e);
        }
    }
    const clientEmail = (env.GA_SA_CLIENT_EMAIL ?? '').trim();
    // תומך גם במפתח עם \n מילוליים וגם בשורות אמיתיות
    const privateKey = (env.GA_SA_PRIVATE_KEY ?? '').replace(/\\n/g, '\n');
    if (clientEmail && privateKey) return { clientEmail, privateKey };
    return null;
}

const REFRESH_MS = 15 * 60 * 1000;           // 15 דקות בין רענוני GA (96 פעמים ביום, מתוזמן ב-Cron)
const STALE_MS   = 30 * 24 * 60 * 60 * 1000; // מעבר לכך — נחשב ישן מדי, נחזיר fallback
const LABEL = 'כניסות החודש';
// כניסות = גולשים ייחודיים (activeUsers), לא צפיות בדפים. screenPageViews סופר
// כל מעבר דף (וב-GA4 גם ניווטי SPA), ולכן ניפח את המונה פי כמה מול מספר האנשים
// שבאמת נכנסו. כרטיס הפירוט החודשי בפאנל מציג את אותו מדד — אחרת דף הבית
// והפאנל מראים מספרים שונים וזה נראה כמו באג.
const METRIC = 'activeUsers';

interface VisitorStat {
    count: number;
    updatedAt: number;
    label?: string;
    /** המדד שנמדד ב-GA; שינוי מדד בקוד מרענן מיד ולא ממתין ל-TTL */
    metric?: string;
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
    const creds = loadCredentials();
    if (!creds) return null;
    if (tokenCache && Date.now() < tokenCache.exp - 60_000) return tokenCache.token;

    const now = Math.floor(Date.now() / 1000);
    const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const claim = b64url(JSON.stringify({
        iss: creds.clientEmail,
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
        signature = b64url(signer.sign(creds.privateKey));
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

/** תחילת החודש הלועזי הנוכחי (YYYY-MM-01) לפי שעון ישראל — אזור הזמן של נכס ה-GA */
function monthStartDate(): string {
    const ym = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit'
    }).format(new Date());
    return `${ym}-01`;
}

/** קורא מ-GA את מספר הצפיות מתחילת החודש הלועזי הנוכחי (אותו מדד כמו בפאנל) */
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
                    dateRanges: [{ startDate: monthStartDate(), endDate: 'today' }],
                    metrics: [{ name: METRIC }],
                    ...(HOSTNAME
                        ? {
                            dimensionFilter: {
                                filter: {
                                    fieldName: 'hostName',
                                    stringFilter: { matchType: 'EXACT', value: HOSTNAME }
                                }
                            }
                        }
                        : {})
                })
            }
        );
        if (!res.ok) {
            console.error('[visitorStats] runReport failed:', res.status, await res.text());
            return null;
        }
        const j = (await res.json()) as { rows?: { metricValues?: { value?: string }[] }[] };
        const raw = j.rows?.[0]?.metricValues?.[0]?.value;
        // אין שורות = אין תנועה = 0 גולשים (זה נתון תקין, לא כשל — ולכן נשמר).
        if (raw === undefined) return 0;
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
    if (!PROPERTY_ID || !loadCredentials()) return; // GA לא מוגדר — אין מה לרענן
    if (refreshing) return;

    const cur = await getConfigValue<VisitorStat>('visitors');
    // label/metric שונים = טווח או מדד המדידה השתנו בקוד — מרעננים מיד ולא מחכים
    if (
        !force &&
        cur?.updatedAt &&
        cur.label === LABEL &&
        cur.metric === METRIC &&
        Date.now() - cur.updatedAt < REFRESH_MS
    ) {
        return;
    }

    refreshing = true;
    try {
        const count = await fetchFromGA();
        if (count !== null) {
            await setConfigValue('visitors', {
                count,
                updatedAt: Date.now(),
                label: LABEL,
                metric: METRIC,
            } satisfies VisitorStat);
        }
    } finally {
        refreshing = false;
    }
}

// ------------------------------------------------------------
// סטטיסטיקה חודשית — לדף /admin/stats בלבד.
// קריאת GA אחת לכל היותר בשעה (הדף נצפה רק ע"י אדמינים), עם מטמון ב-config
// שמוגש גם אם GA נופל רגעית.
// ------------------------------------------------------------

export interface MonthlyStat {
    /** YYYYMM כפי שמוחזר מ-GA, למשל "202608" */
    yearMonth: string;
    visitors: number;
    pageViews: number;
}

interface MonthlyCache {
    rows: MonthlyStat[];
    updatedAt: number;
}

const MONTHLY_REFRESH_MS = 60 * 60 * 1000;

/** גולשים וצפיות לכל חודש קלנדרי בשנה האחרונה. null = GA לא מוגדר/נכשל ואין מטמון. */
export async function getMonthlyVisitorStats(): Promise<MonthlyCache | null> {
    const cached = await getConfigValue<MonthlyCache>('visitors_monthly').catch(() => null);
    if (cached?.rows && Date.now() - cached.updatedAt < MONTHLY_REFRESH_MS) return cached;

    const rows = await fetchMonthlyFromGA();
    if (rows) {
        const value: MonthlyCache = { rows, updatedAt: Date.now() };
        await setConfigValue('visitors_monthly', value).catch(() => {});
        return value;
    }
    return cached?.rows ? cached : null;
}

async function fetchMonthlyFromGA(): Promise<MonthlyStat[] | null> {
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
                    dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
                    dimensions: [{ name: 'yearMonth' }],
                    metrics: [{ name: 'activeUsers' }, { name: 'screenPageViews' }],
                    orderBys: [{ dimension: { dimensionName: 'yearMonth' } }],
                    ...(HOSTNAME
                        ? {
                            dimensionFilter: {
                                filter: {
                                    fieldName: 'hostName',
                                    stringFilter: { matchType: 'EXACT', value: HOSTNAME }
                                }
                            }
                        }
                        : {})
                })
            }
        );
        if (!res.ok) {
            console.error('[visitorStats] monthly runReport failed:', res.status, await res.text());
            return null;
        }
        const j = (await res.json()) as {
            rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[];
        };
        return (j.rows ?? [])
            .map((r) => ({
                yearMonth: r.dimensionValues?.[0]?.value ?? '',
                visitors: Number(r.metricValues?.[0]?.value) || 0,
                pageViews: Number(r.metricValues?.[1]?.value) || 0
            }))
            .filter((r) => /^\d{6}$/.test(r.yearMonth));
    } catch (e) {
        console.error('[visitorStats] monthly runReport error:', e);
        return null;
    }
}

// ------------------------------------------------------------
// תובנות שנתיות — לדף /admin/stats: הגמ"חים הנצפים ביותר, ערי הגולשים,
// מכשירים ומקורות תנועה. batchRunReports אחד (4 דוחות בקריאה אחת),
// מטמון שעה ב-config שמוגש גם אם GA נופל רגעית.
// ------------------------------------------------------------

export interface RankRow {
    /** ערך המימד כפי שהוחזר מ-GA (נתיב / שם עיר באנגלית / mobile וכו') */
    key: string;
    count: number;
}

export interface YearlyInsights {
    /** נתיבי /gemach/{id} עם צפיות — ההמרה לשמות נעשית בדף */
    gemachPages: RankRow[];
    cities: RankRow[];
    devices: RankRow[];
    channels: RankRow[];
}

interface InsightsCache {
    data: YearlyInsights;
    updatedAt: number;
}

const INSIGHTS_REFRESH_MS = 60 * 60 * 1000;

// מקורות שהם שיתוף בוואטסאפ: l.whatsapp.com / whatsapp.com / com.whatsapp (אפליקציית
// אנדרואיד) / wa.me, וגם קישורים שסומנו ידנית ב-utm_source=whatsapp.
const WHATSAPP_SOURCE = /whatsapp|wa\.me/i;
/** ערוץ סינתטי (לא קיים ב-GA) — מתורגם לעברית בדף /admin/stats */
const WHATSAPP_CHANNEL = 'WhatsApp';

/** תובנות שנה אחורה. null = GA לא מוגדר/נכשל ואין מטמון. */
export async function getYearlyInsights(): Promise<InsightsCache | null> {
    const cached = await getConfigValue<InsightsCache>('visitors_insights').catch(() => null);
    if (cached?.data && Date.now() - cached.updatedAt < INSIGHTS_REFRESH_MS) return cached;

    const data = await fetchInsightsFromGA();
    if (data) {
        const value: InsightsCache = { data, updatedAt: Date.now() };
        await setConfigValue('visitors_insights', value).catch(() => {});
        return value;
    }
    return cached?.data ? cached : null;
}

async function fetchInsightsFromGA(): Promise<YearlyInsights | null> {
    if (!PROPERTY_ID) return null;
    const token = await getAccessToken();
    if (!token) return null;

    // דוח אחד: מימד (או כמה) + מטריקה, ממוין יורד, עם סינון hostName (הנכס משותף לכמה אתרים)
    const mkRequest = (dimension: string | string[], metric: string, limit: number, extraFilter?: object) => {
        const expressions = [
            ...(HOSTNAME
                ? [{ filter: { fieldName: 'hostName', stringFilter: { matchType: 'EXACT', value: HOSTNAME } } }]
                : []),
            ...(extraFilter ? [extraFilter] : [])
        ];
        return {
            dateRanges: [{ startDate: '365daysAgo', endDate: 'today' }],
            dimensions: (Array.isArray(dimension) ? dimension : [dimension]).map((name) => ({ name })),
            metrics: [{ name: metric }],
            orderBys: [{ metric: { metricName: metric }, desc: true }],
            limit: String(limit),
            ...(expressions.length === 1
                ? { dimensionFilter: expressions[0] }
                : expressions.length > 1
                    ? { dimensionFilter: { andGroup: { expressions } } }
                    : {})
        };
    };

    try {
        const res = await fetch(
            `https://analyticsdata.googleapis.com/v1beta/properties/${PROPERTY_ID}:batchRunReports`,
            {
                method: 'POST',
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requests: [
                        // צפיות בדפי גמ"ח — limit גבוה כי הסינון לפי id נעשה בדף
                        mkRequest('pagePath', 'screenPageViews', 100, {
                            filter: { fieldName: 'pagePath', stringFilter: { matchType: 'BEGINS_WITH', value: '/gemach/' } }
                        }),
                        mkRequest('city', 'activeUsers', 15),
                        mkRequest('deviceCategory', 'activeUsers', 10),
                        // מקורות תנועה + המקור המדויק, כדי לשלוף מתוכם את שיתופי הוואטסאפ
                        // (GA משייך אותם ל-Organic Social/Referral ולכן לא נראו בנפרד)
                        mkRequest(['sessionDefaultChannelGroup', 'sessionSource'], 'sessions', 200)
                    ]
                })
            }
        );
        if (!res.ok) {
            console.error('[visitorStats] batchRunReports failed:', res.status, await res.text());
            return null;
        }
        const j = (await res.json()) as {
            reports?: { rows?: { dimensionValues?: { value?: string }[]; metricValues?: { value?: string }[] }[] }[];
        };
        const toRows = (i: number): RankRow[] =>
            (j.reports?.[i]?.rows ?? [])
                .map((r) => ({
                    key: r.dimensionValues?.[0]?.value ?? '',
                    count: Number(r.metricValues?.[0]?.value) || 0
                }))
                .filter((r) => r.key && r.count > 0);
        // מקורות תנועה: כל שורה היא (ערוץ, מקור). מקור וואטסאפ מקבל ערוץ משלו
        // ומנוכה מהערוץ המקורי, כך שאין ספירה כפולה והסכום נשאר נכון.
        const byChannel = new Map<string, number>();
        for (const r of j.reports?.[3]?.rows ?? []) {
            const channel = r.dimensionValues?.[0]?.value ?? '';
            const source = r.dimensionValues?.[1]?.value ?? '';
            const count = Number(r.metricValues?.[0]?.value) || 0;
            if (!channel || count <= 0) continue;
            const key = WHATSAPP_SOURCE.test(source) ? WHATSAPP_CHANNEL : channel;
            byChannel.set(key, (byChannel.get(key) ?? 0) + count);
        }
        const channels = [...byChannel]
            .map(([key, count]) => ({ key, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        return {
            gemachPages: toRows(0),
            cities: toRows(1),
            devices: toRows(2),
            channels
        };
    } catch (e) {
        console.error('[visitorStats] batchRunReports error:', e);
        return null;
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
