// ============================================================
// visitStats.ts — ספירת כניסות חודשיות לאתר
// נשמר באוסף ה-items המשותף תחת קטגוריה פנימית (__ng_stats),
// באותו דפוס של adminStore. הצפיות נצברות בזיכרון ונשטפות
// ל-Strapi לכל היותר אחת לדקה, כדי לא לכתוב ל-DB בכל צפייה.
// ============================================================

import { strapiGet, strapiPost, strapiPut, StrapiContentTypeError } from './strapiClient.js';

const STATS_CATEGORY = '__ng_stats';
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 25;

interface StrapiItem {
    documentId: string;
    extra_fields: Record<string, unknown> | null;
}

export interface MonthCount {
    month: string; // YYYY-MM
    count: number;
}

let pending = 0;
let pendingMonth = currentMonth();
let lastFlush = 0;
let flushing = false;
let statsItemId: string | null = null;

function currentMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

async function loadVisits(): Promise<{ id: string | null; visits: Record<string, number> }> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': STATS_CATEGORY,
            'pagination[limit]':      '1',
        });
        const item = (res.data ?? [])[0];
        statsItemId = item?.documentId ?? null;
        const extra = (item?.extra_fields ?? {}) as Record<string, unknown>;
        const raw = (extra.monthly_visits ?? {}) as Record<string, unknown>;
        const visits: Record<string, number> = {};
        for (const [k, v] of Object.entries(raw)) {
            const n = Number(v);
            if (/^\d{4}-\d{2}$/.test(k) && Number.isFinite(n)) visits[k] = n;
        }
        return { id: statsItemId, visits };
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) console.error('[national-gemach] loadVisits failed:', e);
        return { id: null, visits: {} };
    }
}

/** שוטף את הצבירה ל-Strapi. לעולם לא זורק. */
async function flush(): Promise<void> {
    if (flushing || pending === 0) return;
    flushing = true;
    const month = pendingMonth;
    const add = pending;
    pending = 0;
    pendingMonth = currentMonth();
    try {
        const { id, visits } = await loadVisits();
        visits[month] = (visits[month] ?? 0) + add;
        if (id) {
            await strapiPut(`/api/items/${id}`, { data: { extra_fields: { monthly_visits: visits } } });
        } else {
            const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
                data: {
                    label:        'national-gemach-stats',
                    category:     STATS_CATEGORY,
                    description:  '[SYSTEM] סטטיסטיקת כניסות — הגמ"ח הארצי',
                    icon:         '📈',
                    extra_fields: { monthly_visits: visits },
                    status1:      'active',
                    publishedAt:  new Date().toISOString(),
                },
            });
            statsItemId = res.data.documentId;
        }
        lastFlush = Date.now();
    } catch (e) {
        // מחזירים לצבירה — ננסה שוב בשטיפה הבאה
        pending += add;
        pendingMonth = month;
        console.error('[national-gemach] visit flush failed:', e);
    } finally {
        flushing = false;
    }
}

/** רושם צפיית עמוד אחת. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה. */
export function recordVisit(): void {
    if (currentMonth() !== pendingMonth) {
        if (pending > 0) void flush();
        else pendingMonth = currentMonth();
    }
    pending++;
    if (pending >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS) {
        void flush();
    }
}

/** N החודשים האחרונים (כולל החודש הנוכחי), כולל חודשים ללא נתונים. */
export async function getMonthlyVisits(months = 12): Promise<MonthCount[]> {
    const { visits } = await loadVisits();
    // מוסיפים את מה שעוד לא נשטף כדי שהפאנל יראה מספר עדכני
    if (pending > 0) visits[pendingMonth] = (visits[pendingMonth] ?? 0) + pending;
    const out: MonthCount[] = [];
    const now = new Date();
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = d.toISOString().slice(0, 7);
        out.push({ month: key, count: visits[key] ?? 0 });
    }
    return out;
}
