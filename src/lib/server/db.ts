// ============================================================
// db.ts - שכבת נתונים לגמ"חים מ-Strapi
// משותף עם אתר "קהילה בשכונה"
// ============================================================

import { strapiGet, strapiPost, strapiPut, strapiDelete, StrapiContentTypeError } from './strapiClient.js';
import type { Gemach } from '$lib/gemachData';
import { categories } from '$lib/gemachData';

interface StrapiItem {
    id: number;
    documentId: string;
    label: string;
    category: string;
    description: string | null;
    contact: string | null;
    phone: string | null;
    address: string | null;
    icon: string | null;
    color: string | null;
    neighborhood: string | null;
    city: string | null;
    extra_fields: Record<string, unknown> | null;
    status1: string | null;
    user_id: string | null;
    createdAt: string;
}

const KNOWN_KEYS = new Set(categories.map(c => c.key));

// קטגוריית הגמ"חים באוסף ה-items המשותף. חייבת להיות זהה למפתח שבו משתמש
// אתר "קהילה בשכונה" (categoryConfig.gemachim) — זה מה שמסנכרן את הפריטים
// דו-כיוונית בין שני האתרים. תת-הקטגוריה נשמרת ב-extra_fields.gmach_type.
const CATEGORY = 'gemachim';

function toStr(v: unknown): string | undefined {
    if (v === null || v === undefined) return undefined;
    const s = String(v).trim();
    return s === '' ? undefined : s;
}

/** ממפה item של Strapi לסכמת Gemach של האתר הארצי */
function mapItemToGemach(item: StrapiItem): Gemach {
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    const rawType = (extra.gmach_type ?? '').toString().trim();

    // שומר את מפתח הקטגוריה כפי שנשמר (תומך בקטגוריות דינמיות שנוספו בפאנל);
    // ריק → 'other'.
    const subCategory = rawType || 'other';

    // tags - prefer real tags saved by the publisher, fall back to derived ones
    let tags: string[] = [];
    if (Array.isArray(extra.tags)) {
        tags = (extra.tags as unknown[]).filter(t => typeof t === 'string').map(t => t as string);
    }
    if (tags.length === 0) {
        if (rawType && !KNOWN_KEYS.has(rawType)) tags.push(rawType);
        if (item.neighborhood) tags.push(item.neighborhood);
    }

    const orderRaw = extra.order;
    const order = typeof orderRaw === 'number' ? orderRaw
        : (typeof orderRaw === 'string' && orderRaw.trim() !== '' && !isNaN(Number(orderRaw)) ? Number(orderRaw) : undefined);

    return {
        id:            item.documentId,
        name:          item.label ?? '',
        category:      subCategory,
        city:          item.city ?? '',
        neighborhood:  item.neighborhood ?? undefined,
        phone:         item.phone ?? undefined,
        description:   item.description ?? '',
        tags,
        contact:       item.contact ?? undefined,
        link:          toStr(extra.link),
        notes:         toStr(extra.notes),
        address:       item.address ?? undefined,
        hours:         toStr(extra.hours),
        icon:          item.icon ?? undefined,
        order,
        featured:      extra.featured === true || extra.featured === 'true',
        sourceId:      toStr(extra.source_id),
        managed:       true,
    };
}

/** מיון ידני: מומלצים בראש, ואז לפי order (קטן→גדול), ואז החדשים ביותר */
function sortManaged(a: Gemach, b: Gemach): number {
    if (!!a.featured !== !!b.featured) return a.featured ? -1 : 1;
    const ao = a.order ?? Number.POSITIVE_INFINITY;
    const bo = b.order ?? Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return 0; // נשמר סדר ה-fetch (createdAt:desc)
}

/** מחזיר את כל הגמ"חים הפעילים מ-Strapi (ממויינים לפי סדר הפאנל) */
export async function getAllGemachim(): Promise<Gemach[]> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': CATEGORY,
            'filters[status1][$eq]':  'active',
            'sort':                   'createdAt:desc',
            'pagination[limit]':      '2000',
        });
        return (res.data ?? []).map(mapItemToGemach).sort(sortManaged);
    } catch (e) {
        if (e instanceof StrapiContentTypeError) {
            console.warn('[national-gemach] content type not registered, returning []');
            return [];
        }
        console.error('[national-gemach] getAllGemachim failed:', e);
        return [];
    }
}

/** מחזיר גמ"ח בודד לפי documentId (לעריכה בפאנל) */
export async function getGemachById(documentId: string): Promise<Gemach | null> {
    try {
        const res = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        return res.data ? mapItemToGemach(res.data) : null;
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return null;
        console.error('[national-gemach] getGemachById failed:', e);
        return null;
    }
}

export interface CreateGemachInput {
    name: string;
    category: string;       // sub-category key (clothing, baby, ...)
    city: string;
    neighborhood?: string;
    address?: string;
    phone?: string;
    contact?: string;
    description?: string;
    hours?: string;
    icon?: string;
    link?: string;
    notes?: string;
    logoBase64?: string;
    images?: string[];
    tags?: string[];
    order?: number;
    featured?: boolean;
    sourceId?: string;      // מזהה מקורי בעת ייבוא הרשימה הסטטית
    status?: string;        // ברירת מחדל 'active'
}

/** בונה את גוף ה-extra_fields מקלט (משותף ליצירה/עדכון) */
function buildExtra(input: CreateGemachInput): Record<string, unknown> {
    const extra: Record<string, unknown> = { gmach_type: input.category };
    if (input.hours)      extra.hours   = input.hours;
    if (input.link)       extra.link    = input.link;
    if (input.notes)      extra.notes   = input.notes;
    if (input.logoBase64) extra.logo    = input.logoBase64;
    if (input.images && input.images.length > 0) extra.images = input.images;
    if (input.tags  && input.tags.length  > 0)   extra.tags   = input.tags;
    if (typeof input.order === 'number' && !isNaN(input.order)) extra.order = input.order;
    if (input.featured) extra.featured = true;
    if (input.sourceId) extra.source_id = input.sourceId;
    return extra;
}

// קידומת ב-user_id לפריטים שיובאו מהרשימה הסטטית — מאפשרת שאילתה מהירה
// (שדה מחרוזת מאונדקס) של "מה כבר יובא" בלי לשלוף את כל ה-extra_fields.
const SHEET_PREFIX = 'sheet:';

/** יוצר גמ"ח חדש ב-Strapi (מופיע מיד גם בקהילה) */
export async function createGemach(input: CreateGemachInput): Promise<{ id: string }> {
    const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
        data: {
            label:        input.name,
            category:     CATEGORY,
            description:  input.description ?? '',
            contact:      input.contact     ?? '',
            phone:        input.phone       ?? '',
            address:      input.address     ?? '',
            icon:         input.icon        || '🤝',
            color:        'amber',
            neighborhood: input.neighborhood ?? '',
            city:         input.city,
            extra_fields: buildExtra(input),
            status1:      input.status ?? 'active',
            ...(input.sourceId ? { user_id: SHEET_PREFIX + input.sourceId } : {}),
            publishedAt:  new Date().toISOString(),
        },
    });
    return { id: res.data.documentId };
}

/** מעדכן גמ"ח קיים. ממזג את extra_fields כדי לא לדרוס שדות של הקהילה. */
export async function updateGemach(documentId: string, input: CreateGemachInput): Promise<void> {
    // שולפים את הקיים כדי לשמר extra_fields לא-מנוהלים (logo/images וכו')
    let existingExtra: Record<string, unknown> = {};
    try {
        const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        existingExtra = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
    } catch { /* ממשיכים עם extra ריק */ }

    const mergedExtra = { ...existingExtra, ...buildExtra(input) };
    // אם השדות רוקנו — מוחקים אותם מה-extra הממוזג
    if (!input.hours)    delete mergedExtra.hours;
    if (!input.link)     delete mergedExtra.link;
    if (!input.notes)    delete mergedExtra.notes;
    if (!input.featured) delete mergedExtra.featured;
    if (input.order === undefined) delete mergedExtra.order;
    if (input.tags && input.tags.length === 0) delete mergedExtra.tags;

    await strapiPut(`/api/items/${documentId}`, {
        data: {
            label:        input.name,
            category:     CATEGORY,
            description:  input.description ?? '',
            contact:      input.contact     ?? '',
            phone:        input.phone       ?? '',
            address:      input.address     ?? '',
            icon:         input.icon        || '🤝',
            neighborhood: input.neighborhood ?? '',
            city:         input.city,
            extra_fields: mergedExtra,
            ...(input.status ? { status1: input.status } : {}),
        },
    });
}

/** מוחק גמ"ח (נעלם גם מהקהילה) */
export async function deleteGemach(documentId: string): Promise<void> {
    await strapiDelete(`/api/items/${documentId}`);
}

/** קובע את שדה ה-order/featured בלבד (לשימוש בסידור מהיר) */
export async function patchGemachOrder(documentId: string, patch: { order?: number; featured?: boolean }): Promise<void> {
    let existingExtra: Record<string, unknown> = {};
    try {
        const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        existingExtra = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
    } catch { /* noop */ }
    const merged = { ...existingExtra };
    if (patch.order !== undefined)    merged.order = patch.order;
    if (patch.featured !== undefined) {
        if (patch.featured) merged.featured = true; else delete merged.featured;
    }
    await strapiPut(`/api/items/${documentId}`, { data: { extra_fields: merged } });
}

// ============================================================
// ייבוא הרשימה הסטטית ל-DB (חד-פעמי, batched, idempotent)
// ============================================================

/**
 * מחזיר את קבוצת ה-source_id שכבר יובאו (כדי לא לכפול בייבוא חוזר).
 * שולף רק את השדה user_id (מסומן בקידומת sheet:) — מהיר וקטן.
 */
export async function getImportedSourceIds(): Promise<Set<string>> {
    const ids = new Set<string>();
    try {
        const res = await strapiGet<{ data: { user_id: string | null }[] }>('/api/items', {
            'filters[category][$eq]':         CATEGORY,
            'filters[user_id][$startsWith]':  SHEET_PREFIX,
            'fields[0]':                      'user_id',
            'pagination[limit]':              '5000',
        });
        for (const item of res.data ?? []) {
            if (item.user_id && item.user_id.startsWith(SHEET_PREFIX)) {
                ids.add(item.user_id.slice(SHEET_PREFIX.length));
            }
        }
    } catch (e) {
        console.error('[national-gemach] getImportedSourceIds failed:', e);
    }
    return ids;
}

/** מייבא אצווה של גמ"חים סטטיים ל-DB. מדלג על כאלה שכבר יובאו (idempotent). */
export async function importStaticBatch(
    items: CreateGemachInput[]
): Promise<{ imported: number; failed: number; failedIds: string[] }> {
    let imported = 0;
    const failedIds: string[] = [];
    for (const item of items) {
        try {
            await createGemach(item);
            imported++;
        } catch (e) {
            console.error(`[national-gemach] import failed for ${item.sourceId}:`, e);
            if (item.sourceId) failedIds.push(item.sourceId);
        }
    }
    return { imported, failed: failedIds.length, failedIds };
}
