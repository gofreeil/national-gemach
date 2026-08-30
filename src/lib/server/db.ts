// ============================================================
// db.ts - שכבת נתונים לגמ"חים מ-Strapi
// משותף עם אתר "קהילה בשכונה"
// ============================================================

import { strapiGet, strapiGetAll, strapiPost, strapiPut, strapiDelete, StrapiContentTypeError } from './strapiClient.js';
import type { Gemach } from '$lib/gemachData';
import type { CreateGemachInput } from '$lib/gemachForm';
import { categories } from '$lib/gemachData';
import { parseImageFitMap } from '$lib/imageFit';
import { resolveGemachCoords, hasValidCoords } from './geocode';

export interface StrapiItem {
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

// ------------------------------------------------------------
// סטטוס הפריט: status1 ב-Strapi הוא enumeration סגור —
//   active | inactive | deleted | resolved | pending | rejected | frozen
// ולכן אי אפשר לכתוב בו 'draft'. מתרגמים בגבול ה-Strapi בלבד (בדיוק כמו
// adsStore, שמאחסן "מאושר" כ-'active'): שאר הקוד ממשיך לדבר 'draft'.
// 'pending' נבחר כי הוא פנוי לגמרי בקטגוריית הגמ"חים ותואם את מודל
// הפרסומות — וכל ערך שאינו 'active' ממילא מוסתר מהאתר הציבורי.
// ------------------------------------------------------------
const DRAFT_ITEM_STATUS = 'pending';

/** סטטוס אפליקטיבי → ערך חוקי ב-status1 */
export function toItemStatus(status: string): string {
    return status === 'draft' ? DRAFT_ITEM_STATUS : status;
}

/** status1 → הסטטוס האפליקטיבי שהמסכים מכירים */
export function fromItemStatus(status1: string | null): string | undefined {
    if (!status1) return undefined;
    return status1 === DRAFT_ITEM_STATUS ? 'draft' : status1;
}

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

/** ממפה item של Strapi לסכמת Gemach של האתר הארצי.
 *  includeOwner=true חושף את user_id ל-ownerId — רק לשליפת פריט בודד לעריכה,
 *  לעולם לא ברשימות (user_id עשוי להיות מייל ואסור לדלוף לציבור). */
export function mapItemToGemach(item: StrapiItem, includeOwner = false): Gemach {
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    const rawType = (extra.gmach_type ?? '').toString().trim();

    // שומר את מפתח הקטגוריה כפי שנשמר (תומך בקטגוריות דינמיות שנוספו בפאנל);
    // ריק → 'other'.
    const subCategory = rawType || 'other';

    // נושאים נוספים (extra_fields.gmach_types). `gmach_type` נשאר הנושא הראשי
    // כדי ש"קהילה בשכונה" והרשומות הישנות ימשיכו לעבוד בלי שינוי.
    const rawTypes = Array.isArray(extra.gmach_types)
        ? (extra.gmach_types as unknown[]).map(toStr).filter((s): s is string => !!s)
        : [];
    const allCategories = [subCategory, ...rawTypes.filter((t) => t !== subCategory)];

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
        categories:    allCategories,
        city:          item.city ?? '',
        neighborhood:  item.neighborhood ?? undefined,
        phone:         item.phone ?? undefined,
        description:   item.description ?? '',
        tags,
        contact:       item.contact ?? undefined,
        contact2:      toStr(extra.contact2),
        phone2:        toStr(extra.phone2),
        link:          toStr(extra.link),
        notes:         toStr(extra.notes),
        address:       item.address ?? undefined,
        hours:         toStr(extra.hours),
        floor:         toStr(extra.floor),
        apartment:     toStr(extra.apartment),
        arrivalNotes:  toStr(extra.arrival_notes),
        lat:           typeof item.lat === 'number' ? item.lat : null,
        lng:           typeof item.lng === 'number' ? item.lng : null,
        icon:          item.icon ?? undefined,
        image:         pickImage(extra),
        gallery:       pickGallery(extra),
        imageFit:      parseImageFitMap(extra.image_fit),
        order,
        featured:      extra.featured === true || extra.featured === 'true',
        needsReview:   !!extra.needs_review,
        sourceId:      toStr(extra.source_id),
        managed:       true,
        ownerId:       includeOwner ? (item.user_id ?? undefined) : undefined,
        status:        fromItemStatus(item.status1),
        verified:      extra.verified === true || extra.verified === 'true',
        createdAt:     item.createdAt,
    };
}

/** מיון ידני: נעוצים בראש, ואז לפי order (קטן→גדול), ואז החדשים ביותר */
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
        // חשוב: לא map(mapItemToGemach) — הוא היה מעביר את ה-index כ-includeOwner
        // ומדליף user_id (מייל) לרשימה הציבורית. עוטפים כדי לקבל את ברירת המחדל.
        return data.map((item) => mapItemToGemach(item)).sort(sortManaged);
    } catch (e) {
        if (e instanceof StrapiContentTypeError) {
            console.warn('[national-gemach] content type not registered, returning []');
            return [];
        }
        console.error('[national-gemach] getAllGemachim failed:', e);
        return [];
    }
}

// ---------- מטמון רשימת הגמ"חים ----------
// כל דף ציבורי (בית, /gemachim, דף גמ"ח, sitemap) מתחיל ב"תן את כל הרשימה",
// ובלי מטמון זה סבב שליפה מלא מ-Strapi בכל בקשה — עיקר זמן-התגובה של האתר.
// TTL קצר + שיתוף בקשה-בטיסה: אינסטנס חם עונה מהזיכרון, בקשות מקבילות
// חולקות שליפה אחת, וכל כתיבה (יצירה/עריכה/סטטוס) מאפסת את המטמון מיד —
// כך אדמין שמפרסם טיוטה רואה את השינוי בלי להמתין ל-TTL.
let listCache: { at: number; data: Gemach[] } | null = null;
let listInflight: Promise<Gemach[]> | null = null;
const LIST_TTL_MS = 60_000;

export function invalidateGemachCache(): void {
    listCache = null;
    listInflight = null;
    draftCountCache = null;
}

// ---------- מונה "ממתינים לעין אדמין" ----------
// שני סוגים שמדליקים את בועת ההתראות של האדמינים (ראה +layout.server):
//   1. גמ"ח חדש מטופס ההוספה שכבר עלה לאוויר (extra_fields.needs_review) —
//      האדמין מוזמן לעבור עליו: לערוך, להעניק תו תקן או למחוק. ההתראה
//      נמחקת בכפתור "נבדק" (clearGemachReview) או עם הענקת תו תקן.
//   2. טיוטת-אורח ישנה (extra_fields.guest_claim במצב pending) — מהתקופה
//      שבה אורחים נשמרו כטיוטה; עדיין דורשת פרסום/דחייה ידניים.
// טיוטות הגילוי החכם (extra_fields.discovery, מהאוטומציה) מוחרגות —
// הן לא דחופות, והמונה שלהן מוצג באריח הגילוי בלבד.
let draftCountCache: { at: number; n: number } | null = null;

export async function countGemachAttention(): Promise<number> {
    if (draftCountCache && Date.now() - draftCountCache.at < LIST_TTL_MS) return draftCountCache.n;
    try {
        const [withDrafts, pendingRows] = await Promise.all([
            getAllGemachimWithDrafts(),
            strapiGetAll<StrapiItem>('/api/items', {
                'filters[category][$eq]': CATEGORY,
                'filters[status1][$eq]':  DRAFT_ITEM_STATUS,
            }),
        ]);
        const fresh = withDrafts.filter((g) => g.needsReview).length;
        const guestDrafts = pendingRows.filter((r) => {
            const extra = (r.extra_fields ?? {}) as Record<string, unknown>;
            return !!extra.guest_claim;
        }).length;
        const n = fresh + guestDrafts;
        draftCountCache = { at: Date.now(), n };
        return n;
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) {
            console.error('[national-gemach] countGemachAttention failed:', e);
        }
        return draftCountCache?.n ?? 0;
    }
}

/** "נבדק" — מסיר את דגל needs_review של גמ"ח חדש (קריאה-מיזוג-כתיבה,
 *  כמו setGemachVerified, כדי לא לדרוס שדות משותפים עם "קהילה בשכונה"). */
export async function clearGemachReview(documentId: string): Promise<void> {
    const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
    if (!cur.data) throw new Error(`clearGemachReview: הפריט ${documentId} לא נמצא`);
    const extra = { ...((cur.data.extra_fields ?? {}) as Record<string, unknown>) };
    delete extra.needs_review;
    await strapiPut(`/api/items/${documentId}`, { data: { extra_fields: extra } });
    invalidateGemachCache();
}

/** כמו getAllGemachim אבל כולל גם טיוטות ('draft') — לרשימת הניהול בפאנל,
 *  שם האדמין רואה טיוטה עם תג ויכול לפרסם/להחזיר. 'rejected' לא נכלל —
 *  הוא שייך למסך הגילוי בלבד. */
export async function getAllGemachimWithDrafts(): Promise<Gemach[]> {
    if (listCache && Date.now() - listCache.at < LIST_TTL_MS) return listCache.data;
    if (listInflight) return listInflight;
    listInflight = (async () => {
        try {
            const data = await strapiGetAll<StrapiItem>('/api/items', {
                'filters[category][$eq]':    CATEGORY,
                'filters[status1][$in][0]':  'active',
                'filters[status1][$in][1]':  DRAFT_ITEM_STATUS,
                'sort':                      'createdAt:desc',
            });
            const mapped = data.map((item) => mapItemToGemach(item)).sort(sortManaged);
            listCache = { at: Date.now(), data: mapped };
            return mapped;
        } catch (e) {
            if (e instanceof StrapiContentTypeError) return [];
            console.error('[national-gemach] getAllGemachimWithDrafts failed:', e);
            // Strapi לא זמין כרגע — רשימה ישנה עדיפה על אתר ריק
            return listCache?.data ?? [];
        } finally {
            listInflight = null;
        }
    })();
    return listInflight;
}

/** הגמ"חים שבבעלות המשתמש המחובר — ל"הנכסים שלי".
 *  כולל טיוטות, כדי שהבעלים יראה גם גמ"ח שממתין לאישור.
 *  הסינון נעשה ב-Strapi לפי user_id (התאמה מדויקת — זה הפורמט שגם "קהילה
 *  בשכונה" כותב), ובנוסף רשת-ביטחון ב-JS מול אותה קבוצת מזהים.
 *  שים לב: הפריטים ממופים עם ownerId — אסור להעביר אותם כמות שהם ללקוח. */
export async function getGemachimByOwner(keys: Set<string>): Promise<Gemach[]> {
    if (keys.size === 0) return [];
    const params: Record<string, string> = {
        'filters[category][$eq]':   CATEGORY,
        'filters[status1][$in][0]': 'active',
        'filters[status1][$in][1]': DRAFT_ITEM_STATUS,
        'sort':                     'createdAt:desc',
    };
    [...keys].forEach((k, i) => { params[`filters[user_id][$in][${i}]`] = k; });

    try {
        const data = await strapiGetAll<StrapiItem>('/api/items', params);
        return data
            .map((item) => mapItemToGemach(item, true))
            .filter((g) => {
                const oid = (g.ownerId ?? '').trim();
                return !!oid && (keys.has(oid) || keys.has(oid.toLowerCase()));
            })
            .sort(sortManaged);
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return [];
        console.error('[national-gemach] getGemachimByOwner failed:', e);
        return [];
    }
}

/** גמ"חים לפי סטטוס, כ-items גולמיים (למסך הגילוי בפאנל — שצריך גם את
 *  extra_fields.discovery). 'draft' = טיוטות מהאוטומציה, 'rejected' = נדחו. */
export async function getRawGemachimByStatus(status: string): Promise<StrapiItem[]> {
    try {
        return await strapiGetAll<StrapiItem>('/api/items', {
            'filters[category][$eq]': CATEGORY,
            'filters[status1][$eq]':  toItemStatus(status),
            'sort':                   'createdAt:desc',
        });
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return [];
        console.error('[national-gemach] getRawGemachimByStatus failed:', e);
        return [];
    }
}

/** קובע את status1 של פריט, עם עדכון אופציונלי של מטא-הגילוי
 *  (extra_fields.discovery). קריאה-מיזוג-כתיבה — לא דורס extra_fields.
 *
 *  אם הקריאה נכשלה — זורקים ולא כותבים: PUT עם extra_fields ממוזג מ"ריק"
 *  היה מוחק את gmach_type/logo/images/tags של הפריט (שדות משותפים עם
 *  "קהילה בשכונה"). עדיף שהפעולה תיכשל ותוצג לאדמין מאשר איבוד נתונים. */
export async function setGemachStatus(
    documentId: string,
    status: string,
    discoveryPatch?: Record<string, unknown>,
): Promise<void> {
    const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
    if (!cur.data) throw new Error(`setGemachStatus: הפריט ${documentId} לא נמצא`);
    const existingExtra = (cur.data.extra_fields ?? {}) as Record<string, unknown>;

    const extra = { ...existingExtra };
    if (discoveryPatch) {
        const prev = (typeof extra.discovery === 'object' && extra.discovery !== null)
            ? extra.discovery as Record<string, unknown>
            : {};
        extra.discovery = { ...prev, ...discoveryPatch };
    }
    await strapiPut(`/api/items/${documentId}`, { data: { status1: toItemStatus(status), extra_fields: extra } });
    invalidateGemachCache();
}

/** מעניק/מסיר את חותמת "מאושר" (extra_fields.verified) — הגמ"ח עבר בדיקת
 *  מערכת. קריאה-מיזוג-כתיבה כדי לא לדרוס שדות אחרים ב-extra_fields.
 *  כמו ב-setGemachStatus: כשל בקריאה → זורקים ולא כותבים, אחרת ה-PUT היה
 *  מוחק את gmach_type/logo/images/tags (שדות משותפים עם "קהילה בשכונה"). */
export async function setGemachVerified(documentId: string, verified: boolean): Promise<void> {
    const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
    if (!cur.data) throw new Error(`setGemachVerified: הפריט ${documentId} לא נמצא`);
    const existingExtra = (cur.data.extra_fields ?? {}) as Record<string, unknown>;

    const extra = { ...existingExtra };
    if (verified) {
        extra.verified = true;
        extra.verified_at = new Date().toISOString();
        // תו תקן = האדמין בדק את הגמ"ח — ההתראה "חדש לבדיקה" מיותרת מעתה
        delete extra.needs_review;
    } else {
        delete extra.verified;
        delete extra.verified_at;
    }
    await strapiPut(`/api/items/${documentId}`, { data: { extra_fields: extra } });
    invalidateGemachCache();
}

/** מחזיר גמ"ח בודד לפי documentId (לעריכה בפאנל / ע"י הבעלים). כולל ownerId. */
export async function getGemachById(documentId: string): Promise<Gemach | null> {
    try {
        const res = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        return res.data ? mapItemToGemach(res.data, true) : null;
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return null;
        console.error('[national-gemach] getGemachById failed:', e);
        return null;
    }
}

/** מעביר בעלות על גמ"ח: כותב user_id בלבד (בלי extra_fields, כדי לא לדרוס
 *  שדות משותפים עם "קהילה בשכונה"). משמש את אישור תביעות-הבעלות. */
export async function setGemachOwner(documentId: string, ownerId: string): Promise<void> {
    if (!ownerId.trim()) throw new Error('setGemachOwner: אין מזהה-בעלים');
    await strapiPut(`/api/items/${documentId}`, { data: { user_id: ownerId } });
    invalidateGemachCache();
}

/** מזהה-הבעלים (user_id) של פריט בלבד — שליפה קלה (שדה יחיד) לבדיקת הרשאת
 *  עריכה בדף הציבורי, בלי להביא את כל ה-extra_fields (שעשוי לכלול תמונות כבדות). */
export async function getGemachOwnerId(documentId: string): Promise<string | null> {
    try {
        const res = await strapiGet<{ data: { user_id: string | null } | null }>(
            `/api/items/${documentId}`,
            { 'fields[0]': 'user_id' },
        );
        return res.data?.user_id ?? null;
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return null;
        console.error('[national-gemach] getGemachOwnerId failed:', e);
        return null;
    }
}

// הסכמה עצמה יושבת ב-$lib/gemachForm כדי שגם הלקוח (טיוטות אוטומטיות) יכיר
// אותה; נשמרת כאן היצוא-מחדש כדי שכל מי שמייבא מ-'$lib/server/db' ימשיך לעבוד.
export type { CreateGemachInput } from '$lib/gemachForm';

/** בונה את גוף ה-extra_fields מקלט (משותף ליצירה/עדכון) */
function buildExtra(input: CreateGemachInput): Record<string, unknown> {
    const extra: Record<string, unknown> = { gmach_type: input.category };
    // הנושאים הנוספים נשמרים לצד הראשי; נכתב תמיד (גם כמערך בן-איבר-אחד) כדי
    // שהסרת נושא בעריכה תמחק אותו באמת, ולא תישאר מהערך הקודם.
    extra.gmach_types = [
        input.category,
        ...(input.categories ?? []).filter((c) => c && c !== input.category),
    ];
    if (input.hours)      extra.hours   = input.hours;
    if (input.link)       extra.link    = input.link;
    if (input.notes)      extra.notes   = input.notes;
    // איש קשר/טלפון נוספים — אין להם עמודה משלהם ב-items, ולכן הם יושבים ב-extra
    if (input.contact2)   extra.contact2 = input.contact2;
    if (input.phone2)     extra.phone2   = input.phone2;
    // שמות המפתחות זהים ל"קהילה בשכונה" — אותו פריט נערך בשני האתרים
    if (input.floor)        extra.floor         = input.floor;
    if (input.apartment)    extra.apartment     = input.apartment;
    if (input.arrivalNotes) extra.arrival_notes = input.arrivalNotes;
    const logo = input.image || input.logoBase64;
    if (logo)             extra.logo    = logo;
    if (input.images && input.images.length > 0) extra.images = input.images;
    if (input.imageFit && Object.keys(input.imageFit).length > 0) extra.image_fit = input.imageFit;
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
    opts: { geocode?: boolean; ownerId?: string; guestToken?: string; needsReview?: boolean } = {},
): Promise<{ id: string }> {
    let lat: number | null = hasValidCoords(input.lat, input.lng) ? (input.lat as number) : null;
    let lng: number | null = hasValidCoords(input.lat, input.lng) ? (input.lng as number) : null;
    if ((opts.geocode ?? true) && (lat === null || lng === null)) {
        const c = await resolveGemachCoords(input);
        lat = c.lat;
        lng = c.lng;
    }

    // בעלות: פריט מיובא מהרשימה הסטטית → sheet:<id>; פריט שנוצר ע"י משתמש מחובר
    // → opts.ownerId (בפורמט credentials_<email> של "קהילה בשכונה", כך שהגמ"ח
    // ניתן לעריכה ע"י אותו משתמש בשני האתרים). יצירת-אדמין ללא ownerId → בלי user_id.
    const userId = input.sourceId ? SHEET_PREFIX + input.sourceId : opts.ownerId;

    // טיוטת אורח (ראה guestDraft.ts): נשמרת בלי בעלים, עם אסימון שרק הדפדפן
    // שיצר אותה מחזיק — הוא מה שיאפשר לו לאמץ אותה אחרי ההתחברות.
    const extra = buildExtra(input);
    if (opts.guestToken) {
        extra[GUEST_CLAIM_KEY] = { token: opts.guestToken, at: new Date().toISOString() };
    }
    // גמ"ח חדש מהטופס הציבורי — מסומן "לבדיקת אדמין" ומדליק את בועת ההתראות
    // עד שאדמין יסמן "נבדק" / יעניק תו תקן (ראה countGemachAttention).
    if (opts.needsReview) {
        extra.needs_review = new Date().toISOString();
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
            extra_fields: extra,
            // דרך toItemStatus — 'draft' אינו ערך חוקי ב-status1 של Strapi
            status1:      toItemStatus(input.status ?? 'active'),
            ...(userId ? { user_id: userId } : {}),
            publishedAt:  new Date().toISOString(),
        },
    });
    invalidateGemachCache();
    return { id: res.data.documentId };
}

// ------------------------------------------------------------
// טיוטות אורח — גמ"ח שנוצר ע"י מבקר לא-מחובר וממתין שיתחבר ויאמץ אותו.
// האסימון נשמר ב-extra_fields.guest_claim ומוצלב מול העוגייה שבדפדפן
// (ראה guestDraft.ts). מזהה הפריט לבדו לא מספיק כדי לאמץ טיוטה.
// ------------------------------------------------------------
const GUEST_CLAIM_KEY = 'guest_claim';

function guestClaimToken(extra: Record<string, unknown>): string | null {
    const c = extra[GUEST_CLAIM_KEY];
    if (!c || typeof c !== 'object') return null;
    const t = (c as { token?: unknown }).token;
    return typeof t === 'string' && t.trim() !== '' ? t : null;
}

/** שולף את הפריט רק אם הוא באמת טיוטת-אורח פנויה שהאסימון תואם לה.
 *  שגיאות רשת/Strapi נזרקות — הקוראים מחליטים איך להציג אותן. */
async function fetchGuestDraft(documentId: string, token: string): Promise<StrapiItem | null> {
    const res = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
    const item = res.data;
    if (!item) return null;
    // כבר יש בעלים → אינו ניתן לאימוץ
    if ((item.user_id ?? '').trim() !== '') return null;
    // 'active' מותר: אם אדמין הספיק לאשר את הטיוטה מרשימת הסקירה לפני
    // שהאורח התחבר, האימוץ עדיין צריך לרשום אותה על שמו. סטטוס אחר
    // (rejected/inactive) הוא החלטת אדמין — אסור לעקוף אותה באימוץ.
    const st = fromItemStatus(item.status1);
    if (st !== 'draft' && st !== 'active') return null;
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    return guestClaimToken(extra) === token ? item : null;
}

/** פרטי טיוטת אורח להצגה במסך "התחברו כדי לפרסם".
 *  null גם בכשל שליפה — זהו מסך תצוגה, ואין מה להראות בלי הטיוטה. */
export async function getGuestDraft(
    documentId: string,
    token: string,
): Promise<{ id: string; name: string; city: string } | null> {
    try {
        const item = await fetchGuestDraft(documentId, token);
        if (!item) return null;
        return { id: item.documentId, name: item.label ?? '', city: item.city ?? '' };
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return null;
        console.error('[national-gemach] getGuestDraft failed:', e);
        return null;
    }
}

/** מאמץ טיוטת אורח: רושם אותה על שם המשתמש, מפרסם אותה ומבטל את האסימון
 *  (חד-פעמי). false = האסימון לא תואם / הטיוטה כבר אומצה. כשל כתיבה נזרק,
 *  כדי שהמשתמש יראה שגיאה אמיתית ולא "לא נמצאה טיוטה". */
export async function claimGuestDraft(
    documentId: string,
    token: string,
    ownerId: string,
): Promise<boolean> {
    // בלי מזהה-בעלים אין טעם לפרסם — הגמ"ח היה עולה לאוויר בלי שאיש יוכל
    // לערוך אותו. זורקים, כדי שהטיוטה והעוגייה יישמרו לניסיון נוסף.
    if (!ownerId.trim()) throw new Error('claimGuestDraft: אין מזהה-בעלים לסשן');

    const item = await fetchGuestDraft(documentId, token);
    if (!item) return false;

    // מיזוג ולא דריסה — extra_fields מכיל שדות משותפים עם "קהילה בשכונה"
    const extra = { ...((item.extra_fields ?? {}) as Record<string, unknown>) };
    delete extra[GUEST_CLAIM_KEY];

    await strapiPut(`/api/items/${documentId}`, {
        data: { user_id: ownerId, status1: 'active', extra_fields: extra },
    });
    invalidateGemachCache();
    return true;
}

/** מעדכן גמ"ח קיים. ממזג את extra_fields כדי לא לדרוס שדות של הקהילה. */
export async function updateGemach(
    documentId: string,
    input: CreateGemachInput,
    opts: { geocode?: boolean; clearReview?: boolean } = {},
): Promise<void> {
    // שולפים את הקיים כדי לשמר extra_fields לא-מנוהלים (logo/images וכו')
    let existingExtra: Record<string, unknown> = {};
    try {
        const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        existingExtra = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
    } catch { /* ממשיכים עם extra ריק */ }

    const mergedExtra = { ...existingExtra, ...buildExtra(input) };
    // אם השדות רוקנו — מוחקים אותם מה-extra הממוזג
    if (!input.hours)        delete mergedExtra.hours;
    if (!input.link)         delete mergedExtra.link;
    if (!input.notes)        delete mergedExtra.notes;
    if (!input.contact2)     delete mergedExtra.contact2;
    if (!input.phone2)       delete mergedExtra.phone2;
    if (!input.floor)        delete mergedExtra.floor;
    if (!input.apartment)    delete mergedExtra.apartment;
    if (!input.arrivalNotes) delete mergedExtra.arrival_notes;
    if (!input.featured) delete mergedExtra.featured;
    // תמונה שרוקנה: מסמנים במחרוזת ריקה (ולא במחיקה) כדי שגם גלריית `images`
    // של "קהילה בשכונה" לא תחזיר את התמונה מהדלת האחורית.
    if (!input.image && !input.logoBase64) mergedExtra.logo = '';
    if (input.order === undefined) delete mergedExtra.order;
    if (input.tags   && input.tags.length   === 0) delete mergedExtra.tags;
    if (input.images && input.images.length === 0) delete mergedExtra.images;
    // מיקומי-תמונה שאופסו לברירת המחדל נמחקים — הטופס שולח תמיד את המפה המלאה
    if (!input.imageFit || Object.keys(input.imageFit).length === 0) delete mergedExtra.image_fit;
    // עריכה ע"י אדמין = הגמ"ח החדש נבדק — מכבים את התראת needs_review.
    // עריכת בעלים אינה מעבירה את הדגל (clearReview נשלח רק ממסכי האדמין).
    if (opts.clearReview) delete mergedExtra.needs_review;

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
        ...(input.status ? { status1: toItemStatus(input.status) } : {}),
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
    invalidateGemachCache();
}

/** מוחק גמ"ח (נעלם גם מהקהילה) */
export async function deleteGemach(documentId: string): Promise<void> {
    await strapiDelete(`/api/items/${documentId}`);
    invalidateGemachCache();
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
    invalidateGemachCache();
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
    invalidateGemachCache();
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
    invalidateGemachCache();
    return coords;
}
