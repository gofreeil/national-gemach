// ============================================================
// db.ts - שכבת נתונים לגמ"חים מ-Strapi
// משותף עם אתר "קהילה בשכונה"
// ============================================================

import { strapiGet, strapiGetAll, strapiPost, strapiPut, strapiDelete, StrapiContentTypeError } from './strapiClient.js';
import type { Gemach } from '$lib/gemachData';
import { categories } from '$lib/gemachData';
import { resolveGemachCoords, hasValidCoords } from './geocode';

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
    lat: number | null;
    lng: number | null;
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

/** התמונה הראשית של הפריט. `logo` הוא השדה שהאתר הארצי כותב; `images[0]` הוא
 *  הנפילה-אחורה לפריטים שנוצרו ב"קהילה בשכונה" (שם נשמרת גלריה).
 *  `logo: ''` הוא סימון מפורש של "בלי תמונה" — מכבד ניקוי ידני בפאנל ולכן
 *  חוסם גם את הנפילה לגלריה (שאותה לא מוחקים, כדי לא לפגוע בקהילה). */
function pickImage(extra: Record<string, unknown>): string | undefined {
    if (typeof extra.logo === 'string' && extra.logo.trim() === '') return undefined;
    const logo = toStr(extra.logo);
    if (logo) return logo;
    return pickGallery(extra)[0];
}

/** גלריית התמונות של הפריט (extra_fields.images) — מנוקה מערכים ריקים/לא-מחרוזות */
function pickGallery(extra: Record<string, unknown>): string[] {
    if (!Array.isArray(extra.images)) return [];
    return extra.images.map(toStr).filter((s): s is string => !!s);
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
        lat:           typeof item.lat === 'number' ? item.lat : null,
        lng:           typeof item.lng === 'number' ? item.lng : null,
        icon:          item.icon ?? undefined,
        image:         pickImage(extra),
        gallery:       pickGallery(extra),
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

/** מחזיר את כל הגמ"חים הפעילים מ-Strapi (ממויינים לפי סדר הפאנל).
 *  ללא תקרה — מדפדף עמוד-אחר-עמוד, כך שהמאגר יכול לגדול ללא הגבלה. */
export async function getAllGemachim(): Promise<Gemach[]> {
    try {
        const data = await strapiGetAll<StrapiItem>('/api/items', {
            'filters[category][$eq]': CATEGORY,
            'filters[status1][$eq]':  'active',
            'sort':                   'createdAt:desc',
        });
        return data.map(mapItemToGemach).sort(sortManaged);
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
    image?: string;         // כתובת https או data URI — נשמר ב-extra_fields.logo
    link?: string;
    notes?: string;
    logoBase64?: string;
    images?: string[];
    tags?: string[];
    order?: number;
    featured?: boolean;
    sourceId?: string;      // מזהה מקורי בעת ייבוא הרשימה הסטטית
    status?: string;        // ברירת מחדל 'active'
    lat?: number | null;    // פין מפורש (אחרת נגזר מהכתובת/עיר)
    lng?: number | null;
}

/** בונה את גוף ה-extra_fields מקלט (משותף ליצירה/עדכון) */
function buildExtra(input: CreateGemachInput): Record<string, unknown> {
    const extra: Record<string, unknown> = { gmach_type: input.category };
    if (input.hours)      extra.hours   = input.hours;
    if (input.link)       extra.link    = input.link;
    if (input.notes)      extra.notes   = input.notes;
    const logo = input.image || input.logoBase64;
    if (logo)             extra.logo    = logo;
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

/** יוצר גמ"ח חדש ב-Strapi (מופיע מיד גם בקהילה).
 *  גוזר קואורדינטות (lat/lng) מהכתובת/עיר כדי שהפריט יופיע על מפת הקהילה,
 *  אלא אם opts.geocode === false (ייבוא אצווה גדול מדלג כדי לא להעמיס על
 *  Nominatim — ההשלמה נעשית במסך "השלמת פרטים" באצוות מבוקרות). */
export async function createGemach(
    input: CreateGemachInput,
    opts: { geocode?: boolean } = {},
): Promise<{ id: string }> {
    let lat: number | null = hasValidCoords(input.lat, input.lng) ? (input.lat as number) : null;
    let lng: number | null = hasValidCoords(input.lat, input.lng) ? (input.lng as number) : null;
    if ((opts.geocode ?? true) && (lat === null || lng === null)) {
        const c = await resolveGemachCoords(input);
        lat = c.lat;
        lng = c.lng;
    }

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
            lat,
            lng,
            extra_fields: buildExtra(input),
            status1:      input.status ?? 'active',
            ...(input.sourceId ? { user_id: SHEET_PREFIX + input.sourceId } : {}),
            publishedAt:  new Date().toISOString(),
        },
    });
    return { id: res.data.documentId };
}

/** מעדכן גמ"ח קיים. ממזג את extra_fields כדי לא לדרוס שדות של הקהילה. */
export async function updateGemach(
    documentId: string,
    input: CreateGemachInput,
    opts: { geocode?: boolean } = {},
): Promise<void> {
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
    // תמונה שרוקנה: מסמנים במחרוזת ריקה (ולא במחיקה) כדי שגם גלריית `images`
    // של "קהילה בשכונה" לא תחזיר את התמונה מהדלת האחורית.
    if (!input.image && !input.logoBase64) mergedExtra.logo = '';
    if (input.order === undefined) delete mergedExtra.order;
    if (input.tags   && input.tags.length   === 0) delete mergedExtra.tags;
    if (input.images && input.images.length === 0) delete mergedExtra.images;

    const data: Record<string, unknown> = {
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
    };

    // קואורדינטות: פין מפורש מכובד; אחרת נגזרות מהכתובת/עיר. לא דורסים ערך
    // קיים בכשל גיאוקודינג (Nominatim לא זמין) — פשוט לא שולחים lat/lng.
    let lat: number | null = hasValidCoords(input.lat, input.lng) ? (input.lat as number) : null;
    let lng: number | null = hasValidCoords(input.lat, input.lng) ? (input.lng as number) : null;
    if ((opts.geocode ?? true) && (lat === null || lng === null)) {
        const c = await resolveGemachCoords(input);
        lat = c.lat;
        lng = c.lng;
    }
    if (lat !== null && lng !== null) {
        data.lat = lat;
        data.lng = lng;
    }

    await strapiPut(`/api/items/${documentId}`, { data });
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

/**
 * עדכון ממוקד של שדות המיקום בלבד (למסך "השלמת פרטים"): עיר/שכונה/כתובת +
 * גזירת קואורדינטות מחדש. PUT חלקי — לא נוגע בשם/תיאור/תגים/סידור.
 * מחזיר את הקואורדינטות שנגזרו (lat/lng = null אם הגיאוקודינג לא הצליח).
 */
export async function patchGemachLocation(
    documentId: string,
    loc: { city?: string; neighborhood?: string; address?: string },
): Promise<{ lat: number | null; lng: number | null }> {
    const coords = await resolveGemachCoords({
        address: loc.address,
        neighborhood: loc.neighborhood,
        city: loc.city,
    });
    const data: Record<string, unknown> = {};
    if (loc.city !== undefined)         data.city         = loc.city;
    if (loc.neighborhood !== undefined) data.neighborhood = loc.neighborhood;
    if (loc.address !== undefined)      data.address      = loc.address;
    if (coords.lat !== null && coords.lng !== null) {
        data.lat = coords.lat;
        data.lng = coords.lng;
    }
    await strapiPut(`/api/items/${documentId}`, { data });
    return coords;
}

/**
 * גזירת קואורדינטות בלבד לפריט קיים לפי מזהה (לייבוא-אצווה של מיקומים חסרים).
 * שולף את הגמ"ח, גוזר lat/lng מהכתובת/עיר, וכותב אותם. מחזיר את התוצאה
 * (null אם הפריט לא נמצא; lat/lng = null אם אין מספיק מידע/הגיאוקודינג נכשל).
 */
export async function geocodeGemachById(
    documentId: string,
): Promise<{ lat: number | null; lng: number | null } | null> {
    const g = await getGemachById(documentId);
    if (!g) return null;
    const coords = await resolveGemachCoords({
        address: g.address,
        neighborhood: g.neighborhood,
        city: g.city,
    });
    if (coords.lat === null || coords.lng === null) return coords;
    await strapiPut(`/api/items/${documentId}`, { data: { lat: coords.lat, lng: coords.lng } });
    return coords;
}
