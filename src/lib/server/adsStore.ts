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

const AD_CATEGORY = '__ng_ad';
export const DEFAULT_DURATION_DAYS = 30;
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
    expiresAt: string;
    durationDays: number;
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
        expiresAt: x.expires_at ?? '',
        durationDays: Number(x.duration_days) || DEFAULT_DURATION_DAYS,
    };
}

// ---------- קאש קצר לרשימת המאושרות ----------
// נקראת בכל טעינת ה-endpoint הציבורי — אין צורך להציף את Strapi.
const TTL_MS = 120_000;
let approvedCache: { at: number; list: ApprovedAdPublic[] } | null = null;

export function invalidateAdsCache(): void {
    approvedCache = null;
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
 *  מי שקיבל את הכסף (המנהל) הוא שקובע חודש או חצי שנה. */
export async function approveAd(
    id: string,
    { durationDays = DEFAULT_DURATION_DAYS, decidedBy = '' }: { durationDays?: number; decidedBy?: string } = {},
): Promise<void> {
    const expires = new Date(Date.now() + durationDays * DAY_MS);
    await mergeExtra(id, {
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        rejection_reason: '',
        duration_days: durationDays,
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
