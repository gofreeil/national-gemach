// ============================================================
// adStats.ts — מדדי הפרסומות שהמפרסם רואה בדשבורד שלו
// ------------------------------------------------------------
// ארבעה מדדים לכל מודעה:
//   impressions — חשיפות (המודעה נראתה בטור הימני / בפרסומת-הביניים)
//   clicks      — קליקים על המודעה
//   landing     — צפיות בדף הנחיתה /ads/[id]
//   leads       — פניות: לחיצה על טלפון / וואטסאפ / אתר / מייל בדף הנחיתה
//
// אחסון: כמו visitStats — קטגוריה פנימית (__ng_ad_stats) באוסף ה-items
// המשותף, פריט אחד לכל האתר. הספירה נצברת בזיכרון ונשטפת ל-Strapi לכל
// היותר אחת לדקה, כדי לא לכתוב ל-DB בכל חשיפה.
// המדדים נשמרים במפתחות מקוצרים (i/c/v/l) ובחלוקה יומית מוגבלת ל-60 יום,
// כדי שהפריט יישאר קטן — תקרת koa-body היא 1MB לבקשה.
// ============================================================

import { strapiGet, strapiPost, strapiPut, StrapiContentTypeError } from './strapiClient.js';

const STATS_CATEGORY = '__ng_ad_stats';
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 25;
const KEEP_DAYS = 60;

export type AdMetric = 'impressions' | 'clicks' | 'landing' | 'leads';
export const AD_METRICS: AdMetric[] = ['impressions', 'clicks', 'landing', 'leads'];

export interface AdCounters {
    impressions: number;
    clicks: number;
    landing: number;
    leads: number;
}
export interface AdDayCounters extends AdCounters {
    /** YYYY-MM-DD */
    date: string;
}
export interface AdStats {
    totals: AdCounters;
    /** N הימים האחרונים, כולל ימים ריקים — לגרף העמודות בדשבורד */
    days: AdDayCounters[];
}

interface StrapiItem {
    documentId: string;
    extra_fields: Record<string, unknown> | null;
}

/** המפתחות המקוצרים כפי שהם נשמרים ב-Strapi */
type Short = 'i' | 'c' | 'v' | 'l';
type RawCounters = Partial<Record<Short, number>>;
interface RawAd {
    /** סך הכל מאז ומתמיד */
    t?: RawCounters;
    /** פירוט יומי: YYYY-MM-DD → מדדים */
    d?: Record<string, RawCounters>;
}
type RawStore = Record<string, RawAd>;

const SHORT: Record<AdMetric, Short> = {
    impressions: 'i',
    clicks: 'c',
    landing: 'v',
    leads: 'l',
};

// ---------- צבירה בזיכרון ----------
// מפתח: `${adId}|${YYYY-MM-DD}` — היום נקבע בזמן הרישום, כך ששטיפה
// שחוצה חצות לא מזיזה ספירות ליום הלא נכון.
const pending = new Map<string, RawCounters>();
let pendingCount = 0;
let lastFlush = 0;
let flushing = false;
let statsItemId: string | null = null;

function today(): string {
    return new Date().toISOString().slice(0, 10);
}

function isDayKey(k: string): boolean {
    return /^\d{4}-\d{2}-\d{2}$/.test(k);
}

function addInto(target: RawCounters, add: RawCounters): RawCounters {
    for (const key of ['i', 'c', 'v', 'l'] as Short[]) {
        const n = Number(add[key]);
        if (Number.isFinite(n) && n !== 0) target[key] = (Number(target[key]) || 0) + n;
    }
    return target;
}

function sanitizeStore(raw: unknown): RawStore {
    const out: RawStore = {};
    if (!raw || typeof raw !== 'object') return out;
    for (const [adId, val] of Object.entries(raw as Record<string, unknown>)) {
        if (!adId || !val || typeof val !== 'object') continue;
        const rec = val as { t?: unknown; d?: unknown };
        const clean: RawAd = { t: addInto({}, (rec.t ?? {}) as RawCounters), d: {} };
        if (rec.d && typeof rec.d === 'object') {
            for (const [day, counters] of Object.entries(rec.d as Record<string, unknown>)) {
                if (isDayKey(day)) clean.d![day] = addInto({}, (counters ?? {}) as RawCounters);
            }
        }
        out[adId] = clean;
    }
    return out;
}

async function loadStats(): Promise<{ id: string | null; store: RawStore }> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': STATS_CATEGORY,
            'pagination[limit]': '1',
        });
        const item = (res.data ?? [])[0];
        statsItemId = item?.documentId ?? null;
        const extra = (item?.extra_fields ?? {}) as Record<string, unknown>;
        return { id: statsItemId, store: sanitizeStore(extra.ad_stats) };
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) {
            console.error('[national-gemach] adStats load failed:', e);
        }
        return { id: null, store: {} };
    }
}

/** גורע ימים ישנים — הפריט נשאר קטן גם אחרי שנים של תנועה */
function pruneDays(store: RawStore): void {
    const cutoff = new Date(Date.now() - KEEP_DAYS * 24 * 60 * 60 * 1000)
        .toISOString()
        .slice(0, 10);
    for (const rec of Object.values(store)) {
        if (!rec.d) continue;
        for (const day of Object.keys(rec.d)) {
            if (day < cutoff) delete rec.d[day];
        }
    }
}

/** שוטף את הצבירה ל-Strapi. לעולם לא זורק. */
async function flush(): Promise<void> {
    if (flushing || pending.size === 0) return;
    flushing = true;
    const batch = new Map(pending);
    const batchCount = pendingCount;
    pending.clear();
    pendingCount = 0;
    try {
        const { id, store } = await loadStats();
        for (const [key, add] of batch) {
            const sep = key.lastIndexOf('|');
            const adId = key.slice(0, sep);
            const day = key.slice(sep + 1);
            const rec = (store[adId] ??= {});
            rec.t = addInto(rec.t ?? {}, add);
            rec.d ??= {};
            rec.d[day] = addInto(rec.d[day] ?? {}, add);
        }
        pruneDays(store);
        if (id) {
            await strapiPut(`/api/items/${id}`, { data: { extra_fields: { ad_stats: store } } });
        } else {
            const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
                data: {
                    label: 'national-gemach-ad-stats',
                    category: STATS_CATEGORY,
                    description: '[SYSTEM] מדדי פרסומות — הגמ"ח הארצי',
                    icon: '📊',
                    extra_fields: { ad_stats: store },
                    status1: 'active',
                    publishedAt: new Date().toISOString(),
                },
            });
            statsItemId = res.data?.documentId ?? null;
        }
        lastFlush = Date.now();
    } catch (e) {
        // מחזירים לצבירה — ננסה שוב בשטיפה הבאה
        for (const [key, add] of batch) {
            pending.set(key, addInto(pending.get(key) ?? {}, add));
        }
        pendingCount += batchCount;
        console.error('[national-gemach] adStats flush failed:', e);
    } finally {
        flushing = false;
    }
}

/** רושם אירועי מדידה. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה. */
export function recordAdEvents(events: Array<{ id: string; metric: AdMetric }>): void {
    const day = today();
    for (const ev of events) {
        const id = (ev?.id ?? '').trim();
        const short = SHORT[ev?.metric];
        if (!id || !short) continue;
        const key = `${id}|${day}`;
        const cur = pending.get(key) ?? {};
        cur[short] = (cur[short] ?? 0) + 1;
        pending.set(key, cur);
        pendingCount++;
    }
    if (pendingCount >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS) {
        void flush();
    }
}

function toCounters(raw: RawCounters | undefined): AdCounters {
    return {
        impressions: Number(raw?.i) || 0,
        clicks: Number(raw?.c) || 0,
        landing: Number(raw?.v) || 0,
        leads: Number(raw?.l) || 0,
    };
}

/** מזג הצבירה שעוד לא נשטפה — כדי שהדשבורד יראה מספרים עדכניים */
function withPending(store: RawStore): RawStore {
    if (pending.size === 0) return store;
    for (const [key, add] of pending) {
        const sep = key.lastIndexOf('|');
        const adId = key.slice(0, sep);
        const day = key.slice(sep + 1);
        const rec = (store[adId] ??= {});
        rec.t = addInto({ ...(rec.t ?? {}) }, add);
        rec.d = { ...(rec.d ?? {}) };
        rec.d[day] = addInto({ ...(rec.d[day] ?? {}) }, add);
    }
    return store;
}

function lastDays(rec: RawAd | undefined, days: number): AdDayCounters[] {
    const out: AdDayCounters[] = [];
    const now = Date.now();
    for (let i = days - 1; i >= 0; i--) {
        const date = new Date(now - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
        out.push({ date, ...toCounters(rec?.d?.[date]) });
    }
    return out;
}

/** המדדים של המודעות המבוקשות. מודעה בלי תנועה מקבלת אפסים (ולא נעדרת). */
export async function getAdStats(
    ids: string[],
    days = 14,
): Promise<Record<string, AdStats>> {
    const out: Record<string, AdStats> = {};
    if (ids.length === 0) return out;
    const { store } = await loadStats();
    const merged = withPending(store);
    for (const id of ids) {
        out[id] = { totals: toCounters(merged[id]?.t), days: lastDays(merged[id], days) };
    }
    return out;
}
