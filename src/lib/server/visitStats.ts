// ============================================================
// visitStats.ts — ספירת פניות חודשיות לאתר, בצד-השרת
// נשמר באוסף ה-items המשותף תחת קטגוריה פנימית (__ng_stats),
// באותו דפוס של adminStore. הצפיות נצברות בזיכרון ונשטפות
// ל-Strapi לכל היותר אחת לדקה, כדי לא לכתוב ל-DB בכל צפייה.
//
// למה בכלל מונה נוסף על Google Analytics: GA רץ בצד-הלקוח (gtag), ולכן
// רואה רק דפדפנים שמריצים JavaScript — כלומר בני אדם. הסורקים של מנועי
// החיפוש והבוטים של ה-AI לא מופיעים שם כלל. המונה הזה יושב ב-hook של
// השרת ולכן סופר גם אותם, ומפצל אותם לפרמטר נפרד בדף הסטטיסטיקה.
// ============================================================

import { strapiGet, strapiPost, strapiPut, StrapiContentTypeError } from './strapiClient.js';

const STATS_CATEGORY = '__ng_stats';
const FLUSH_INTERVAL_MS = 60_000;
const FLUSH_THRESHOLD = 25;

// בוטים של AI — מודלים שמאמנים, מסכמים או מביאים ציטוט חי מהאתר.
// נבדק ראשון, כי חלקם (Bytespider למשל) נראים כמו סורק חיפוש רגיל.
const AI_BOT =
    /GPTBot|OAI-SearchBot|ChatGPT-User|ClaudeBot|Claude-User|Claude-SearchBot|anthropic-ai|PerplexityBot|Perplexity-User|Google-Extended|Applebot-Extended|Bytespider|Amazonbot|meta-externalagent|FacebookBot|CCBot|cohere-ai|Diffbot|YouBot|ImagesiftBot|DuckAssistBot|MistralAI-User|Timpibot|Omgilibot/i;

// מנועי חיפוש, מציגי-תצוגה-מקדימה של רשתות, וכל סורק אחר שמצהיר על עצמו
const SEARCH_BOT =
    /Googlebot|Google-InspectionTool|Storebot-Google|AdsBot|APIs-Google|Mediapartners-Google|bingbot|BingPreview|Slurp|DuckDuckBot|Baiduspider|YandexBot|Sogou|Exabot|Applebot|PetalBot|SemrushBot|AhrefsBot|MJ12bot|DotBot|facebookexternalhit|Twitterbot|LinkedInBot|TelegramBot|WhatsApp|Discordbot|Pinterest|SkypeUriPreview|bot\b|crawler|crawling|spider|scrapy|curl|wget|python-requests|node-fetch|Go-http-client|okhttp|HeadlessChrome/i;

type Bucket = 'ai' | 'search' | null;

/** מסווג user-agent: בוט AI, סורק/מנוע-חיפוש, או בן אדם (null) */
export function classifyAgent(userAgent: string): Bucket {
    if (!userAgent) return 'search'; // בקשה בלי UA היא כמעט תמיד סקריפט, לא דפדפן
    if (AI_BOT.test(userAgent)) return 'ai';
    if (SEARCH_BOT.test(userAgent)) return 'search';
    return null;
}

interface StrapiItem {
    documentId: string;
    extra_fields: Record<string, unknown> | null;
}

export interface MonthCount {
    month: string; // YYYY-MM
    /** כל הפניות לדפי האתר באותו חודש — בני אדם + סורקים */
    count: number;
    /** מתוכן: סריקות של מנועי חיפוש וסורקים כלליים */
    searchBots: number;
    /** מתוכן: סריקות של בוטים מבוססי-AI */
    aiBots: number;
    /** true אם חלק מהמספרים בחודש הזה הם הערכה (לפני תחילת המדידה) */
    estimated: boolean;
}

// ------------------------------------------------------------
// בסיס היסטורי — הספירה בשרת עלתה לאוויר ב-6.8.2026, אבל האתר נסרק הרבה
// לפני כן. כדי שהכרטיס לא יראה 0 לתקופה שלא נמדדה, מוסיפים לה הערכה:
// מספר הדפים באתר כפול קצב סריקה טיפוסי, לכל יום שקדם למדידה. מרגע
// המדידה ואילך המספרים אמיתיים בלבד, והדף מציין איפה יש הערכה.
// ------------------------------------------------------------
const MEASURE_FROM = Date.UTC(2026, 7, 6); // 6.8.2026
/** סורקי חיפוש עוברים על דף בערך אחת ל-3 ימים */
const SEARCH_PER_PAGE_PER_DAY = 1 / 3;
/** בוטי AI נדירים יותר — בערך אחת ל-12 יום לדף */
const AI_PER_PAGE_PER_DAY = 1 / 12;

/** כמה ימים בחודש הזה קדמו לתחילת המדידה (0 = החודש נמדד במלואו) */
function daysBeforeMeasuring(month: string): number {
    const y = Number(month.slice(0, 4));
    const m = Number(month.slice(5, 7));
    const start = Date.UTC(y, m - 1, 1);
    const end = Date.UTC(y, m, 1);
    const until = Math.min(end, MEASURE_FROM);
    return until <= start ? 0 : (until - start) / 86_400_000;
}

/** מפת חודש→מספר, כפי שהיא נשמרת ב-extra_fields */
type Counts = Record<string, number>;

interface Buckets {
    total: Counts;
    search: Counts;
    ai: Counts;
}

let pending: { total: number; search: number; ai: number } = { total: 0, search: 0, ai: 0 };
let pendingMonth = currentMonth();
let lastFlush = 0;
let flushing = false;
let statsItemId: string | null = null;

function hasPending(): boolean {
    return pending.total > 0;
}

function currentMonth(): string {
    return new Date().toISOString().slice(0, 7);
}

/** מנקה מפת חודש→מספר שהגיעה מ-Strapi (מתעלמת ממפתחות/ערכים לא תקינים) */
function sanitize(raw: unknown): Counts {
    const out: Counts = {};
    for (const [k, v] of Object.entries((raw ?? {}) as Record<string, unknown>)) {
        const n = Number(v);
        if (/^\d{4}-\d{2}$/.test(k) && Number.isFinite(n)) out[k] = n;
    }
    return out;
}

async function loadVisits(): Promise<{ id: string | null; buckets: Buckets }> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': STATS_CATEGORY,
            'pagination[limit]':      '1',
        });
        const item = (res.data ?? [])[0];
        statsItemId = item?.documentId ?? null;
        const extra = (item?.extra_fields ?? {}) as Record<string, unknown>;
        return {
            id: statsItemId,
            buckets: {
                total:  sanitize(extra.monthly_visits),
                search: sanitize(extra.monthly_search_bots),
                ai:     sanitize(extra.monthly_ai_bots),
            },
        };
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) console.error('[national-gemach] loadVisits failed:', e);
        return { id: null, buckets: { total: {}, search: {}, ai: {} } };
    }
}

/** שוטף את הצבירה ל-Strapi. לעולם לא זורק. */
async function flush(): Promise<void> {
    if (flushing || !hasPending()) return;
    flushing = true;
    const month = pendingMonth;
    const add = pending;
    pending = { total: 0, search: 0, ai: 0 };
    pendingMonth = currentMonth();
    try {
        const { id, buckets } = await loadVisits();
        buckets.total[month]  = (buckets.total[month]  ?? 0) + add.total;
        buckets.search[month] = (buckets.search[month] ?? 0) + add.search;
        buckets.ai[month]     = (buckets.ai[month]     ?? 0) + add.ai;
        const extra_fields = {
            monthly_visits:      buckets.total,
            monthly_search_bots: buckets.search,
            monthly_ai_bots:     buckets.ai,
        };
        if (id) {
            await strapiPut(`/api/items/${id}`, { data: { extra_fields } });
        } else {
            const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
                data: {
                    label:        'national-gemach-stats',
                    category:     STATS_CATEGORY,
                    description:  '[SYSTEM] סטטיסטיקת כניסות — הגמ"ח הארצי',
                    icon:         '📈',
                    extra_fields,
                    status1:      'active',
                    publishedAt:  new Date().toISOString(),
                },
            });
            statsItemId = res.data.documentId;
        }
        lastFlush = Date.now();
    } catch (e) {
        // מחזירים לצבירה — ננסה שוב בשטיפה הבאה
        pending.total  += add.total;
        pending.search += add.search;
        pending.ai     += add.ai;
        pendingMonth = month;
        console.error('[national-gemach] visit flush failed:', e);
    } finally {
        flushing = false;
    }
}

/**
 * רושם פנייה אחת לדף. סינכרוני וזול — הכתיבה ל-DB נדחית לשטיפה.
 * ה-user-agent מסווג את הפנייה לבן-אדם / מנוע-חיפוש / בוט-AI.
 */
export function recordVisit(userAgent = ''): void {
    if (currentMonth() !== pendingMonth) {
        if (hasPending()) void flush();
        else pendingMonth = currentMonth();
    }
    pending.total++;
    const bucket = classifyAgent(userAgent);
    if (bucket) pending[bucket]++;
    if (pending.total >= FLUSH_THRESHOLD || Date.now() - lastFlush > FLUSH_INTERVAL_MS) {
        void flush();
    }
}

/**
 * N החודשים האחרונים (כולל החודש הנוכחי), כולל חודשים ללא נתונים.
 * pages = מספר הדפים הציבוריים באתר; משמש להערכת הסריקות שלפני תחילת המדידה.
 */
export async function getMonthlyVisits(months = 12, pages = 0): Promise<MonthCount[]> {
    const { buckets } = await loadVisits();
    // מוסיפים את מה שעוד לא נשטף כדי שהפאנל יראה מספר עדכני
    if (hasPending()) {
        buckets.total[pendingMonth]  = (buckets.total[pendingMonth]  ?? 0) + pending.total;
        buckets.search[pendingMonth] = (buckets.search[pendingMonth] ?? 0) + pending.search;
        buckets.ai[pendingMonth]     = (buckets.ai[pendingMonth]     ?? 0) + pending.ai;
    }
    const out: MonthCount[] = [];
    const now = new Date();
    const sitePages = Math.max(1, pages);
    for (let i = months - 1; i >= 0; i--) {
        const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
        const key = d.toISOString().slice(0, 7);
        // הערכה לימים שלפני תחילת המדידה, אמת מדודה לימים שאחריה — מחוברים יחד
        const estDays = daysBeforeMeasuring(key);
        const estSearch = Math.round(estDays * sitePages * SEARCH_PER_PAGE_PER_DAY);
        const estAi = Math.round(estDays * sitePages * AI_PER_PAGE_PER_DAY);
        const searchBots = (buckets.search[key] ?? 0) + estSearch;
        const aiBots = (buckets.ai[key] ?? 0) + estAi;
        out.push({
            month:      key,
            count:      (buckets.total[key] ?? 0) + estSearch + estAi,
            searchBots,
            aiBots,
            estimated:  estDays > 0,
        });
    }
    return out;
}
