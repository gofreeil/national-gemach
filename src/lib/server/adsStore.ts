// ============================================================
// adsStore.ts — מאגר הפרסומות שמפרסמים מעלים בבילדר המקומי
// (/advertise/builder): שליחה → אישור/דחייה במסך /admin/ads →
// תצוגה בטור הימני ובפרסומת-הביניים + דף נחיתה /ads/[id].
//
// אחסון: כמו adminStore — קטגוריה פנימית (__ng_ad) באוסף ה-items
// המשותף, כדי לא לדרוש שינוי סכמה ב-Strapi. מיפוי:
//   label = כותרת, description = שורת משנה,
//   status1 = pending / active (מאושרת) / rejected,
//   extra_fields = כל שאר שדות המודעה (גרדיאנט, תמונות data-URI,
//   דף נחיתה, פרטי מפרסם, תוקף...).
// זהירות: תמונות כ-data-URI — תקרת koa-body היא 1MB לבקשה,
// לכן הבילדר מכווץ תמונות לפני השליחה.
// ============================================================

import { strapiGet, strapiPost, strapiPut, strapiDelete } from './strapiClient.js';
import { DEFAULT_PLAN_DAYS, normalizePlanDays } from '../adPlans.js';

const AD_CATEGORY = '__ng_ad';
export const DEFAULT_DURATION_DAYS = DEFAULT_PLAN_DAYS;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AdStatus = 'pending' | 'approved' | 'rejected';

export interface AdLanding {
    headline: string;
    pitch: string;
    extended: string;
    image: string;
    advantages: [string, string, string];
    uniqueness: string;
    phone: string;
    whatsapp: string;
    website: string;
    email: string;
    address: string;
    hours: string;
    products: Array<{ id: number; name: string; price: string; image: string; description: string }>;
}

export interface SubmittedAd {
    id: string;                 // documentId
    status: AdStatus;
    title: string;
    subtitle: string;
    hoverText: string;
    cta: string;
    gradient: string;           // מחרוזת CSS מלאה (linear-gradient(...))
    logo: string;               // data URI
    mainImage: string;          // data URI
    landing: Partial<AdLanding>;
    submittedBy: { id: string; email: string; name: string };
    submittedAt: string;
    decidedAt: string;
    decidedBy: string;
    rejectionReason: string;
    /** עריכה אחרונה בידי המפרסם עצמו (דשבורד הנכס) — ריק אם לא נערכה */
    editedAt: string;
    expiresAt: string;
    durationDays: number;
    /** "code" = הוזן קוד התנועה בשליחה (כמו שולם); "pending" = תשלום לתיאום */
    payment: string;
    /** התקופה שהמפרסם ביקש בשליחה (אחד ממסלולי adPlans) — ברירת המחדל באישור */
    requestedDurationDays: number;
}

/** הצורה הרזה שמוזרמת לתצוגה הציבורית (טור ימני + פרסומת-ביניים) */
export interface ApprovedAdPublic {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    hover: string;
    gradient: string;
    mainImage: string;
}

interface StrapiItem {
    documentId: string;
    label: string | null;
    description: string | null;
    category: string;
    status1: string | null;
    extra_fields: Record<string, unknown> | null;
    createdAt: string;
}

// status1 של item ↔ סטטוס מודעה
function toItemStatus(s: AdStatus): string {
    return s === 'approved' ? 'active' : s;
}
function fromItemStatus(s: string | null): AdStatus {
    if (s === 'active') return 'approved';
    return s === 'rejected' ? 'rejected' : 'pending';
}

function fromStrapi(row: StrapiItem | null | undefined): SubmittedAd | null {
    if (!row) return null;
    const x = (row.extra_fields ?? {}) as Record<string, any>;
    return {
        id: row.documentId,
        status: fromItemStatus(row.status1),
        title: row.label ?? '',
        subtitle: row.description ?? '',
        hoverText: x.hover_text ?? '',
        cta: x.cta ?? '',
        gradient: x.gradient ?? '',
        logo: x.logo ?? '',
        mainImage: x.main_image ?? '',
        landing: x.landing ?? {},
        submittedBy: {
            id: x.submitted_by?.id ?? '',
            email: x.submitted_by?.email ?? '',
            name: x.submitted_by?.name ?? '',
        },
        submittedAt: x.submitted_at ?? row.createdAt ?? '',
        decidedAt: x.decided_at ?? '',
        decidedBy: x.decided_by ?? '',
        rejectionReason: x.rejection_reason ?? '',
        editedAt: x.edited_at ?? '',
        expiresAt: x.expires_at ?? '',
        durationDays: Number(x.duration_days) || DEFAULT_DURATION_DAYS,
        payment: x.payment ?? 'pending',
        requestedDurationDays: normalizePlanDays(x.requested_duration_days),
    };
}

// ---------- קאש קצר לרשימת המאושרות ----------
// נקראת בכל טעינת ה-endpoint הציבורי — אין צורך להציף את Strapi.
// קצר בכוונה: invalidateAdsCache מנקה רק את המופע (lambda) שביצע את האישור,
// ולכן זה גם הזמן המרבי שמופע אחר ימשיך להחזיר רשימה ישנה אחרי אישור מודעה.
const TTL_MS = 60_000;
let approvedCache: { at: number; list: ApprovedAdPublic[] } | null = null;
let pendingCache: { at: number; list: PendingAdBrief[] } | null = null;

export function invalidateAdsCache(): void {
    approvedCache = null;
    pendingCache = null;
}

/** מודעה שממתינה לאישור — תמצית להתראת האדמינים (בלי תמונות). */
export interface PendingAdBrief {
    id: string;
    title: string;
    submittedAt: string;
}

/**
 * המודעות שממתינות לאישור — הבסיס להתראה שרצה אצל כל אדמין בכל דף.
 * שאילתה רזה בכוונה: fields מצמצם ל-label/status1/createdAt ומשאיר את
 * extra_fields בחוץ — שם יושבות התמונות כ-data-URI, ומשיכתן בכל טעינת דף
 * הייתה עשרות עד מאות KB לחינם. הסינון עצמו בקוד ולא ב-filters[status1],
 * כדי שגם רשומה ישנה בלי status1 (שנחשבת pending) תיכנס להתראה.
 */
export async function listPendingAds(): Promise<PendingAdBrief[]> {
    if (pendingCache && Date.now() - pendingCache.at < TTL_MS) return pendingCache.list;
    try {
        const res = await strapiGet<{
            data: Array<{ documentId: string; label: string | null; status1: string | null; createdAt: string }>;
        }>('/api/items', {
            'filters[category][$eq]': AD_CATEGORY,
            'fields[0]': 'label',
            'fields[1]': 'status1',
            'fields[2]': 'createdAt',
            sort: 'createdAt:desc',
            'pagination[pageSize]': '100',
        });
        const list = (res.data ?? [])
            .filter((row) => fromItemStatus(row.status1) === 'pending')
            .map((row) => ({
                id: row.documentId,
                title: row.label ?? 'פרסומת ללא כותרת',
                submittedAt: row.createdAt ?? '',
            }));
        pendingCache = { at: Date.now(), list };
        return list;
    } catch (err) {
        // כשל זמני — לא מפילים את הדף שההתראה יושבת עליו
        console.warn('adsStore: listPendingAds failed', err instanceof Error ? err.message : err);
        pendingCache = { at: Date.now(), list: [] };
        return [];
    }
}

/** שליחת מודעה חדשה מהבילדר (status: pending). */
export async function submitAd(payload: {
    title: string;
    subtitle?: string;
    hoverText?: string;
    cta?: string;
    gradient?: string;
    logo?: string;
    mainImage?: string;
    landing?: Partial<AdLanding>;
    submittedBy?: { id: string; email: string; name: string };
    payment?: string;
    requestedDurationDays?: number;
}): Promise<{ id: string; status: AdStatus }> {
    const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
        data: {
            category:    AD_CATEGORY,
            label:       payload.title,
            description: payload.subtitle ?? '',
            status1:     toItemStatus('pending'),
            extra_fields: {
                hover_text:   payload.hoverText ?? '',
                cta:          payload.cta ?? '',
                gradient:     payload.gradient ?? '',
                logo:         payload.logo ?? '',
                main_image:   payload.mainImage ?? '',
                landing:      payload.landing ?? {},
                submitted_by: payload.submittedBy ?? { id: '', email: '', name: '' },
                submitted_at: new Date().toISOString(),
                payment: payload.payment === 'code' ? 'code' : 'pending',
                requested_duration_days: normalizePlanDays(payload.requestedDurationDays),
            },
            publishedAt: new Date().toISOString(),
        },
    });
    invalidateAdsCache();
    return { id: res.data?.documentId ?? '', status: 'pending' };
}

/** רשימת המודעות המאושרות — גרסה רזה לתצוגה, עם אכיפת תוקף בזמן קריאה. */
export async function listApproved(): Promise<ApprovedAdPublic[]> {
    if (approvedCache && Date.now() - approvedCache.at < TTL_MS) {
        return approvedCache.list;
    }
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': AD_CATEGORY,
            'filters[status1][$eq]':  toItemStatus('approved'),
            sort: 'createdAt:desc',
            'pagination[pageSize]': '25',
        });
        const now = Date.now();
        const list = (res.data ?? [])
            .map(fromStrapi)
            .filter((a): a is SubmittedAd => Boolean(a))
            // מודעה שפג תוקפה יורדת מהאתר אוטומטית (הרשומה נשארת לארכיון)
            .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now)
            .map((a) => ({
                id: a.id,
                title: a.title,
                subtitle: a.subtitle,
                cta: a.cta,
                hover: a.hoverText,
                gradient: a.gradient,
                mainImage: a.mainImage,
            }));
        approvedCache = { at: Date.now(), list };
        return list;
    } catch (err) {
        // כשל זמני — קאש שלילי קצר, האתר ממשיך עם משבצות "מקום פרסום"
        console.warn('adsStore: listApproved failed', err instanceof Error ? err.message : err);
        approvedCache = { at: Date.now(), list: [] };
        return [];
    }
}

/** מודעה בודדת לפי documentId — לדף הנחיתה /ads/[id]. */
export async function getAd(id: string): Promise<SubmittedAd | null> {
    try {
        const res = await strapiGet<{ data: StrapiItem }>(`/api/items/${encodeURIComponent(id)}`);
        const ad = fromStrapi(res.data);
        // הגנה: לא לחשוף פריט שאינו מודעה דרך המסלול הזה
        return ad && res.data?.category === AD_CATEGORY ? ad : null;
    } catch {
        return null;
    }
}

/** מיפוי אחיד של שדות דף הנחיתה מגוף בקשה — משותף לשליחה חדשה
 *  (/api/ads/submit) ולעריכה בידי הבעלים (PUT /api/ads/[id]). */
export function normalizeLanding(raw: unknown): Partial<AdLanding> {
    const l = (raw ?? {}) as Record<string, any>;
    return {
        headline: l.headline ?? '',
        pitch: l.pitch ?? '',
        extended: l.extended ?? '',
        image: l.image ?? '',
        advantages: [l.advantages?.[0] ?? '', l.advantages?.[1] ?? '', l.advantages?.[2] ?? ''],
        uniqueness: l.uniqueness ?? '',
        phone: l.phone ?? '',
        whatsapp: l.whatsapp ?? '',
        website: l.website ?? '',
        email: l.email ?? '',
        address: l.address ?? '',
        hours: l.hours ?? '',
        products: Array.isArray(l.products) ? l.products : [],
    };
}

/** האם המודעה נשלחה בידי המשתמש הזה. משווים מול קבוצת המזהים שלו
 *  (ownerCandidateKeys) — כי submitted_by נשמר עם id ומייל, ובאתרים
 *  התאומים המזהה המספרי לא בהכרח זהה. */
export function isAdOwner(keys: Set<string>, ad: SubmittedAd): boolean {
    const id = (ad.submittedBy.id ?? '').trim();
    const email = (ad.submittedBy.email ?? '').trim().toLowerCase();
    return Boolean((id && keys.has(id)) || (email && keys.has(email)));
}

/** המודעות של המפרסם עצמו — לדשבורד הנכס (/advertise/manage). */
export async function listForOwner(keys: Set<string>): Promise<SubmittedAd[]> {
    if (keys.size === 0) return [];
    const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
        'filters[category][$eq]': AD_CATEGORY,
        sort: 'createdAt:desc',
        'pagination[pageSize]': '100',
    });
    return (res.data ?? [])
        .map(fromStrapi)
        .filter((a): a is SubmittedAd => Boolean(a))
        .filter((a) => isAdOwner(keys, a));
}

/** עריכה מחדש בידי המפרסם — תוכן בלבד. סטטוס, תוקף, תשלום ותקופה
 *  לא נוגעים כאן: מודעה מאושרת נשארת באוויר, ורק edited_at מתעדכן
 *  כדי שמסך האישור (/admin/ads) יראה שהיא נערכה אחרי האישור. */
export async function updateAdContent(
    id: string,
    patch: {
        title: string;
        subtitle?: string;
        hoverText?: string;
        cta?: string;
        gradient?: string;
        logo?: string;
        mainImage?: string;
        landing?: Partial<AdLanding>;
    },
): Promise<void> {
    const res = await strapiGet<{ data: StrapiItem }>(`/api/items/${encodeURIComponent(id)}`);
    if (res.data?.category !== AD_CATEGORY) throw new Error('not an ad');
    const existing = (res.data?.extra_fields ?? {}) as Record<string, unknown>;
    await strapiPut(`/api/items/${encodeURIComponent(id)}`, {
        data: {
            label: patch.title,
            description: patch.subtitle ?? '',
            extra_fields: {
                ...existing,
                hover_text: patch.hoverText ?? '',
                cta: patch.cta ?? '',
                gradient: patch.gradient ?? existing.gradient ?? '',
                logo: patch.logo ?? '',
                main_image: patch.mainImage ?? existing.main_image ?? '',
                landing: { ...((existing.landing ?? {}) as object), ...(patch.landing ?? {}) },
                edited_at: new Date().toISOString(),
            },
        },
    });
    invalidateAdsCache();
}

/** כל המודעות למסך האדמין (ממתינות + מאושרות + נדחות). */
export async function listAllForAdmin(): Promise<SubmittedAd[]> {
    const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
        'filters[category][$eq]': AD_CATEGORY,
        sort: 'createdAt:desc',
        'pagination[pageSize]': '100',
    });
    return (res.data ?? []).map(fromStrapi).filter((a): a is SubmittedAd => Boolean(a));
}

/** עדכון extra_fields תוך שמירה על השדות הקיימים. */
async function mergeExtra(id: string, patch: Record<string, unknown>, status?: AdStatus): Promise<void> {
    const res = await strapiGet<{ data: StrapiItem }>(`/api/items/${encodeURIComponent(id)}`);
    const existing = (res.data?.extra_fields ?? {}) as Record<string, unknown>;
    await strapiPut(`/api/items/${encodeURIComponent(id)}`, {
        data: {
            ...(status ? { status1: toItemStatus(status) } : {}),
            extra_fields: { ...existing, ...patch },
        },
    });
}

/** אישור מודעה — קובע תוקף (ברירת מחדל 30 יום). התשלום ידני, ולכן
 *  מי שקיבל את הכסף (המנהל) הוא שקובע את המסלול בפועל. */
export async function approveAd(
    id: string,
    { durationDays = DEFAULT_DURATION_DAYS, decidedBy = '' }: { durationDays?: number; decidedBy?: string } = {},
): Promise<void> {
    const days = normalizePlanDays(durationDays);
    const expires = new Date(Date.now() + days * DAY_MS);
    await mergeExtra(id, {
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        rejection_reason: '',
        duration_days: days,
        expires_at: expires.toISOString(),
    }, 'approved');
    invalidateAdsCache();
}

/** דחיית מודעה (עם סיבה אופציונלית). */
export async function rejectAd(
    id: string,
    { reason = '', decidedBy = '' }: { reason?: string; decidedBy?: string } = {},
): Promise<void> {
    await mergeExtra(id, {
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        rejection_reason: reason,
    }, 'rejected');
    invalidateAdsCache();
}

/** מחיקה לצמיתות (ניקוי מודעות ישנות במסך האדמין). */
export async function removeAd(id: string): Promise<void> {
    await strapiDelete(`/api/items/${encodeURIComponent(id)}`);
    invalidateAdsCache();
}
