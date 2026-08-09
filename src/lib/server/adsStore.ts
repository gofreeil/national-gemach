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
import { parseAdImageFit, type AdImageFit } from '../adImageFit.js';
import { parseAdStyle, type AdStyle } from '../adStyle.js';

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
    /** מיקום+זום של התמונה הראשית במשבצת (מהבילדר) */
    mainImageFit: AdImageFit;
    /** העיצוב שנקבע בבילדר (לוגו, רצועה, כותרת). null = מודעה ותיקה */
    adStyle: AdStyle | null;
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
    /** "code" = סומן כשולם; "pending" = תשלום לתיאום. הגשה תמיד נכנסת כ-pending. */
    payment: string;
    /** המפרסם הקליד את קוד הבעלים — בקשה לפרסום חינם שממתינה לאישור ידני */
    codeRequested: boolean;
    /** התקופה שהמפרסם ביקש בשליחה (אחד ממסלולי adPlans) — ברירת המחדל באישור */
    requestedDurationDays: number;
    /** מיקום ידני בטור הפרסומות (0 = המשבצת הראשונה). ריק = לפי סדר האישור */
    slotOrder?: number;
    /** מושהית — יורדת מהאתר ושומרת את הימים שנותרו לה */
    paused?: boolean;
    /** הימים ששמורים לה מרגע ההשהיה — מהם היא ממשיכה בהפעלה מחדש */
    pausedDaysLeft?: number;

    // ----- מפרסם חוזר: גרסה מעודכנת שמחליפה את המודעה הקיימת שלו -----
    /** המודעה הקודמת של אותו מפרסם שהגרסה הזו באה להחליף */
    replacesAdId?: string;
    /** כותרת אותה גרסה קודמת — כדי שהמנהל יראה מה בדיוק מוחלף */
    replacesTitle?: string;
    /** מי החליפה אותה. מודעה מסומנת כך היא היסטוריה ולא מועמדת להחלפה נוספת */
    supersededBy?: string;
    /** מודעה נוספת שנקנתה בכוונה - האישור לא מוריד את מה שכבר רץ למפרסם */
    standalone?: boolean;
}

/** הצורה הרזה שמוזרמת לתצוגה הציבורית (טור ימני + פרסומת-ביניים) */
export interface ApprovedAdPublic {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    hover: string;
    gradient: string;
    /** לוגו המפרסם (data-URI); ריק כשלא הועלה לוגו בבילדר */
    logo: string;
    mainImage: string;
    mainImageFit: AdImageFit;
    /** העיצוב מהבילדר; null במודעות שנשלחו לפני שהוא נשמר */
    adStyle: AdStyle | null;
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
        mainImageFit: parseAdImageFit(x.main_image_fit),
        // null במודעות שנשלחו לפני שהעיצוב נשמר — הצרכן נופל ל-legacyAdStyle
        adStyle: parseAdStyle(x.ad_style),
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
        // המפרסם הקליד את קוד הבעלים — בקשה לפרסום חינם, לא אישור שלה
        codeRequested: x.code_requested === true,
        requestedDurationDays: normalizePlanDays(x.requested_duration_days),
        slotOrder: typeof x.slot_order === 'number' ? x.slot_order : undefined,
        paused: x.paused === true,
        pausedDaysLeft: typeof x.paused_days_left === 'number' ? x.paused_days_left : undefined,
        replacesAdId: typeof x.replaces_ad_id === 'string' ? x.replaces_ad_id : undefined,
        replacesTitle: typeof x.replaces_title === 'string' ? x.replaces_title : undefined,
        supersededBy: typeof x.superseded_by === 'string' ? x.superseded_by : undefined,
        standalone: x.standalone === true,
    };
}

/** סדר המשבצות בטור: קודם מי שקיבל מיקום ידני, אחריו לפי סדר הכניסה (ותיק→חדש) */
function bySlotOrder(a: { slotOrder?: number }, b: { slotOrder?: number }): number {
    return (a.slotOrder ?? Number.MAX_SAFE_INTEGER) - (b.slotOrder ?? Number.MAX_SAFE_INTEGER);
}

// ---------- קאש קצר לרשימת המאושרות ----------
// נקראת בכל טעינת ה-endpoint הציבורי — אין צורך להציף את Strapi.
// קצר בכוונה: invalidateAdsCache מנקה רק את המופע (lambda) שביצע את האישור,
// ולכן זה גם הזמן המרבי שמופע אחר ימשיך להחזיר רשימה ישנה אחרי אישור מודעה.
// דקה הייתה יותר מדי: מודעה שאושרה במסך הניהול לא הופיעה בבאנר, והמנהל
// שרענן מיד ראה את המשבצת עדיין ריקה וחשב שהאישור לא נקלט.
const TTL_MS = 15_000;
// מונה הממתינות (ההתראה לאדמינים) לא חייב להיות טרי לשנייה, והוא נקרא בכל
// טעינת דף של אדמין — לכן נשאר על דקה.
const PENDING_TTL_MS = 60_000;
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
    if (pendingCache && Date.now() - pendingCache.at < PENDING_TTL_MS) return pendingCache.list;
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

/** מודעה ממתינה עם התוכן עצמו — התראת האדמינים מציגה את הפרסומת, לא רק שם. */
export interface PendingAdPreview extends PendingAdBrief {
    subtitle: string;
    cta: string;
    hoverText: string;
    gradient: string;
    mainImage: string;
    submittedBy: { email: string; name: string };
}

/**
 * הממתינות במלואן (כולל תמונה) — לבאנר שבפרופיל, שם האדמין רואה את
 * הפרסומת מיד בלי לנדוד למסך אחר. שתי פעימות בכוונה: הרשימה הרזה
 * (עם הקאש) נותנת את המזהים, ורק עבורם נמשכות הרשומות המלאות — כך
 * תמונות ה-data-URI הכבדות נטענות רק כשבאמת יש מה לאשר.
 */
export async function listPendingAdsPreview(): Promise<PendingAdPreview[]> {
    const brief = await listPendingAds();
    if (brief.length === 0) return [];
    const full = await Promise.all(brief.map((b) => getAd(b.id)));
    return brief.map((b, i) => {
        const a = full[i];
        return {
            ...b,
            subtitle: a?.subtitle ?? '',
            cta: a?.cta ?? '',
            hoverText: a?.hoverText ?? '',
            gradient: a?.gradient ?? '',
            mainImage: a?.mainImage ?? '',
            submittedBy: { email: a?.submittedBy.email ?? '', name: a?.submittedBy.name ?? '' },
        };
    });
}

// ============================================================
// מפרסם חוזר: זיהוי גרסה מעודכנת של מודעה קיימת
// ------------------------------------------------------------
// בבילדר אין "עריכה" של רשומה קיימת — מפרסם ששב לשפר את המודעה שלו
// שולח רשומה חדשה לגמרי. בלי הקישור שכאן ההתראה למנהל נוסחה כבקשה
// חדשה, ואישור שלה הוסיף מודעה שנייה לאותו מפרסם במקום להחליף.
// ============================================================

/** טלפון ישראלי מנורמל להשוואה: ספרות בלבד, 972 → 0 */
function normPhone(raw: string | undefined | null): string {
    const digits = (raw ?? '').replace(/\D/g, '').replace(/^972/, '0');
    return digits.length >= 9 ? digits : '';
}

type AdvertiserIdentity = {
    submittedBy?: { id?: string; email?: string; name?: string };
    landing?: { email?: string; phone?: string };
};

/** מפתחות הזהות של מפרסם — מזהה משתמש, אימייל ופרטי הקשר שבדף הנחיתה */
function identityKeys(ad: AdvertiserIdentity): string[] {
    const keys: string[] = [];
    if (ad.submittedBy?.id) keys.push(`id:${ad.submittedBy.id}`);
    const email = (ad.submittedBy?.email || ad.landing?.email || '').trim().toLowerCase();
    if (email) keys.push(`email:${email}`);
    const phone = normPhone(ad.landing?.phone);
    if (phone) keys.push(`phone:${phone}`);
    return keys;
}

function sameAdvertiser(a: AdvertiserIdentity, b: AdvertiserIdentity): boolean {
    const keysB = new Set(identityKeys(b));
    return identityKeys(a).some((k) => keysB.has(k));
}

const byNewest = (a: SubmittedAd, b: SubmittedAd) =>
    Date.parse(b.submittedAt || '') - Date.parse(a.submittedAt || '');

/**
 * מה כבר יש למפרסם הזה: target = המודעה שהשליחה החדשה היא גרסה מעודכנת
 * שלה (מאושרת → ממתינה → נדחתה), stalePending = כל בקשותיו הממתינות,
 * שהשליחה החדשה מייתרת. כשל כאן לא מפיל שליחה — מפרסם שלא זוהה מתנהג
 * פשוט כמפרסם חדש.
 */
async function findPredecessors(
    identity: AdvertiserIdentity,
): Promise<{ target: SubmittedAd | null; stalePending: SubmittedAd[] }> {
    let all: SubmittedAd[];
    try {
        all = await listAllForAdmin();
    } catch (err) {
        console.warn('adsStore: findPredecessors failed', err instanceof Error ? err.message : err);
        return { target: null, stalePending: [] };
    }
    const mine = all.filter((a) => !a.supersededBy && sameAdvertiser(a, identity));
    const live = mine.filter((a) => a.status === 'approved').sort(byNewest);
    const stalePending = mine.filter((a) => a.status === 'pending').sort(byNewest);
    const past = mine.filter((a) => a.status === 'rejected').sort(byNewest);
    return { target: live[0] ?? stalePending[0] ?? past[0] ?? null, stalePending };
}

/**
 * המודעה המאושרת שכבר חיה על האתר לאותו מפרסם - חוץ מזו שמאשרים כרגע.
 * מפרסם מקבל משבצת אחת; שתי מודעות זהות זו לצידה זו הן תמיד תקלה ולא
 * בחירה - מי שבאמת רוצה שתיים מאשר עם keepPrevious.
 */
async function findLiveAdsOfAdvertiser(current: SubmittedAd): Promise<SubmittedAd[]> {
    try {
        const all = await listAllForAdmin();
        return all.filter((a) => a.id !== current.id && a.status === 'approved'
            && !a.supersededBy && sameAdvertiser(a, current));
    } catch (err) {
        console.warn('adsStore: findLiveAdsOfAdvertiser failed', err instanceof Error ? err.message : err);
        return [];
    }
}

/**
 * מוציא גרסה ישנה מהמחזור אחרי שגרסה מעודכנת נכנסה במקומה. הסטטוס
 * 'rejected' הוא הארכיון היחיד שיש — המודעה יורדת מהאתר ומהתור אבל
 * נשארת במסך הניהול עם הסיבה, ואפשר להחזיר אותה. שום דבר לא נמחק.
 */
async function supersedeAd(oldId: string, newAdId: string, decidedBy: string, reason: string): Promise<void> {
    await mergeExtra(oldId, {
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        rejection_reason: reason,
        superseded_by: newAdId,
    }, 'rejected');
    invalidateAdsCache();
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
    mainImageFit?: unknown;
    adStyle?: unknown;
    landing?: Partial<AdLanding>;
    submittedBy?: { id: string; email: string; name: string };
    payment?: string;
    requestedDurationDays?: number;
    /** מודעה *נוספת* שנקנתה בכוונה - לא מתקשרת לקודמת ולא מורידה אותה באישור */
    standalone?: boolean;
}): Promise<{
    id: string;
    status: AdStatus;
    replacesAdId: string;
    replacesTitle: string;
    replacesStatus: AdStatus | '';
    retiredPendingIds: string[];
}> {
    // מפרסם חוזר: מחפשים לפני היצירה, כדי שהרשומה החדשה עצמה לא תיספר.
    // מודעה נוספת שנקנתה בכוונה (הגעה מדף המחירים) לא מחפשת קודמת בכלל -
    // היא לא באה במקום שום דבר, וזיהוי לפי זהות היה הורג את המודעה
    // שהמפרסם כבר משלם עליה.
    const { target: predecessor, stalePending } = payload.standalone
        ? { target: null, stalePending: [] as SubmittedAd[] }
        : await findPredecessors({
            submittedBy: payload.submittedBy,
            landing: payload.landing as { email?: string; phone?: string } | undefined,
        });
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
                main_image_fit: parseAdImageFit(payload.mainImageFit),
                // העיצוב שהמפרסם קבע בבילדר — בלעדיו המודעה מתפרסמת עם
                // ברירות המחדל של האתר ולא עם מה שהוא ראה על המסך
                ad_style:     parseAdStyle(payload.adStyle),
                landing:      payload.landing ?? {},
                submitted_by: payload.submittedBy ?? { id: '', email: '', name: '' },
                submitted_at: new Date().toISOString(),
                // הגשה לעולם לא נכנסת כ"שולם". קוד הבעלים הוא *בקשה* לפרסום
                // חינם, והזכות עצמה ניתנת רק באישור הידני של האדמין.
                payment: 'pending',
                code_requested: payload.payment === 'code',
                requested_duration_days: normalizePlanDays(payload.requestedDurationDays),
                // נשמר עם המודעה: גם באישור, שבא אחר-כך, אסור להוריד את הקיימת
                ...(payload.standalone ? { standalone: true } : {}),
                ...(predecessor
                    ? { replaces_ad_id: predecessor.id, replaces_title: predecessor.title }
                    : {}),
            },
            publishedAt: new Date().toISOString(),
        },
    });
    invalidateAdsCache();
    const id = res.data?.documentId ?? '';

    // בקשות ממתינות קודמות של אותו מפרסם יורדות מהתור: המנהל אמור לראות
    // בקשה אחת לכל מפרסם — האחרונה — ולא שתי בקשות שנראות כפולות.
    // מודעה מאושרת נשארת באוויר עד שהחדשה תאושר, אחרת האתר נשאר בלי מודעה.
    const retiredPendingIds: string[] = [];
    for (const stale of stalePending) {
        try {
            await supersedeAd(stale.id, id, 'system', 'הוחלפה בגרסה מעודכנת שהמפרסם שלח');
            retiredPendingIds.push(stale.id);
        } catch (err) {
            console.warn('adsStore: retire pending predecessor failed', err instanceof Error ? err.message : err);
        }
    }

    return {
        id,
        status: 'pending',
        replacesAdId:   predecessor?.id ?? '',
        replacesTitle:  predecessor?.title ?? '',
        replacesStatus: predecessor?.status ?? '',
        retiredPendingIds,
    };
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
            // מהוותיק לחדש: סדר הרשימה הוא סדר המשבצות בטור, ולכן מפרסם
            // חדש נכנס למשבצת הפנויה הבאה (2, 3...) ולא דוחף את מי שכבר
            // באוויר מטה. עם מיון יורד כל מודעה חדשה קפצה למשבצת 1 והזיזה
            // את כל השאר — מספר המשבצת של מפרסם קיים השתנה בלי שנגענו בו.
            sort: 'createdAt:asc',
            'pagination[pageSize]': '25',
        });
        const now = Date.now();
        const list = (res.data ?? [])
            .map(fromStrapi)
            .filter((a): a is SubmittedAd => Boolean(a))
            // מודעה שפג תוקפה יורדת מהאתר אוטומטית (הרשומה נשארת לארכיון)
            .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now)
            // מודעה מושהית יורדת מהאתר ושומרת את הימים שנותרו לה
            .filter((a) => !a.paused)
            // מיקום ידני שנקבע במסך הניהול גובר על סדר הכניסה
            .sort(bySlotOrder)
            .map((a) => ({
                id: a.id,
                title: a.title,
                subtitle: a.subtitle,
                cta: a.cta,
                hover: a.hoverText,
                gradient: a.gradient,
                // הלוגו והעיצוב עוברים לתצוגה הציבורית — בלעדיהם המודעה
                // מתפרסמת בלי הלוגו שהמפרסם העלה ובלי העיצוב שקבע
                logo: a.logo,
                mainImage: a.mainImage,
                mainImageFit: a.mainImageFit,
                adStyle: a.adStyle,
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
    if (id && keys.has(id)) return true;
    if (email && keys.has(email)) return true;
    // מודעות שנשלחו לפני שההתחברות הפכה לחובה נשמרו בלי בעלים כלל. שם
    // האימייל שהמפרסם הזין בפרטי הקשר של דף הנחיתה הוא הזיהוי היחיד שקיים,
    // ומי שמתחבר עם אותה כתובת הוא הבעלים. חל רק כשאין submitted_by —
    // מודעה עם בעלים רשום לא נלקחת מידיו.
    if (id || email) return false;
    const contact = (ad.landing?.email ?? '').trim().toLowerCase();
    return Boolean(contact && keys.has(contact));
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
        mainImageFit?: unknown;
        adStyle?: unknown;
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
                main_image_fit: patch.mainImageFit !== undefined
                    ? parseAdImageFit(patch.mainImageFit)
                    : (existing.main_image_fit ?? parseAdImageFit(undefined)),
                // עריכה מהדשבורד שומרת גם את העיצוב; בלי זה עריכת טקסט
                // הייתה מאפסת את הלוגו והרצועה שהמפרסם כיוון
                ad_style: patch.adStyle !== undefined
                    ? parseAdStyle(patch.adStyle)
                    : (existing.ad_style ?? null),
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
 *  מי שקיבל את הכסף (המנהל) הוא שקובע את המסלול בפועל.
 *
 *  גרסה מעודכנת של מפרסם קיים נכנסת *במקום* הישנה: אותה משבצת בטור
 *  ואותו תאריך סיום, ומיד אחרי האישור הישנה יורדת מהאתר. keepPrevious
 *  הוא המקרה ההפוך — מפרסם שבאמת רוצה שתי מודעות במקביל.
 *  מחזיר את כותרת המודעה שהוחלפה, כדי שהמנהל יראה מה ירד. */
export async function approveAd(
    id: string,
    {
        durationDays = DEFAULT_DURATION_DAYS,
        decidedBy = '',
        keepPrevious = false,
    }: { durationDays?: number; decidedBy?: string; keepPrevious?: boolean } = {},
): Promise<{ replacedTitle: string }> {
    const current = await getAd(id);
    // מודעה נוספת שנקנתה בכוונה מתנהגת בדיוק כמו keepPrevious: היא לא
    // באה במקום כלום, והמפרסם משלם על שתי המשבצות.
    const keep = keepPrevious || current?.standalone === true;
    const predecessor = current?.replacesAdId && !keep ? await getAd(current.replacesAdId) : null;

    // כל מה שחי כרגע לאותו מפרסם: replacesAdId מצביע על מה שהיה חי *בזמן
    // השליחה* בלבד. כששתי גרסאות היו באוויר, האישור הוריד את הישנה, השאיר
    // את השנייה ודחף אותה למטה. מפרסם מקבל משבצת אחת, ולכן ברירת המחדל
    // היא שהחדשה מכסה את כולן.
    const liveBefore = keep || !current ? [] : await findLiveAdsOfAdvertiser(current);
    const replacingAll = predecessor && predecessor.status === 'approved' && !predecessor.supersededBy
        && !liveBefore.some((a) => a.id === predecessor.id)
        ? [predecessor, ...liveBefore]
        : liveBefore;
    // הכי חדשה מביניהן היא זו שהחדשה יורשת ממנה את המשבצת בטור
    const replacing = [...replacingAll].sort(byNewest)[0] ?? null;

    const days = normalizePlanDays(durationDays);
    // התקופה שהמפרסם כבר שילם עליה ממשיכה כרגיל: אותו תאריך פקיעה, לא
    // ספירה חדשה. מבין כמה גרסאות שיורדות - הרחוקה ביותר.
    const inheritedExpiry = replacingAll
        .filter((a) => !a.paused && a.expiresAt && Date.parse(a.expiresAt) > Date.now())
        .map((a) => a.expiresAt)
        .sort()
        .pop() ?? '';
    const expires = inheritedExpiry || new Date(Date.now() + days * DAY_MS).toISOString();
    await mergeExtra(id, {
        decided_at: new Date().toISOString(),
        decided_by: decidedBy,
        rejection_reason: '',
        duration_days: inheritedExpiry ? (replacing?.durationDays ?? days) : days,
        expires_at: expires,
        // המשבצת בטור עוברת לגרסה החדשה, אחרת היא הייתה קופצת לסוף הרשימה
        ...(replacing && typeof replacing.slotOrder === 'number' ? { slot_order: replacing.slotOrder } : {}),
    }, 'approved');
    invalidateAdsCache();

    // סדר הפעולות מכוון: קודם החדשה עולה, רק אחר-כך הישנה יורדת. כשל כאן
    // משאיר את שתיהן באוויר (מצב שהמנהל רואה ומתקן) — עדיף מלהוריד את
    // הישנה ואז להיכשל בהעלאת החדשה ולהשאיר את המפרסם בלי מודעה.
    const retiredTitles: string[] = [];
    for (const old of replacingAll) {
        try {
            await supersedeAd(old.id, id, decidedBy, 'הוחלפה בגרסה מעודכנת שאישרת');
            retiredTitles.push(old.title);
        } catch (err) {
            console.warn('adsStore: supersede on approve failed', err instanceof Error ? err.message : err);
        }
    }
    return { replacedTitle: retiredTitles.join('", "') };
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

/** הורדת מודעה מאושרת מהאתר — חוזרת ל"ממתינה", בלי למחוק אותה.
 *  התוקף מתאפס כדי שהמשבצת תתפנה מיד ולא תיתפס ע"י מודעה שכבר לא באוויר. */
export async function unapproveAd(id: string, decidedBy = ''): Promise<void> {
    await mergeExtra(id, {
        decided_at: '',
        decided_by: decidedBy,
        expires_at: '',
        rejection_reason: '',
    }, 'pending');
    invalidateAdsCache();
}

/** מחיקה לצמיתות (ניקוי מודעות ישנות במסך האדמין). */
export async function removeAd(id: string): Promise<void> {
    await strapiDelete(`/api/items/${encodeURIComponent(id)}`);
    invalidateAdsCache();
}

// ---------- ניהול תקופת הפרסום: קציבה, השהיה, המשך ----------

const MIN_DURATION_DAYS = 1;
const MAX_DURATION_DAYS = 730;

/** מנרמל קלט ימים מהטופס לטווח שפוי (הקציבה הידנית אינה כבולה למסלולים) */
export function normalizeDurationDays(raw: unknown): number {
    const n = Math.round(Number(raw));
    if (!Number.isFinite(n)) return DEFAULT_DURATION_DAYS;
    return Math.min(MAX_DURATION_DAYS, Math.max(MIN_DURATION_DAYS, n));
}

/**
 * קוצב למודעה תקופה חדשה. התקופה נספרת מיום האישור, ולכן קציבה קצרה
 * מהזמן שכבר רץ מורידה את המודעה מהאתר מיד — וזו המשמעות של "לקצוב".
 */
export async function setAdDuration(
    id: string,
    days: number,
): Promise<{ title: string; expiresAt: string; daysLeft: number } | null> {
    const ad = await getAd(id);
    if (!ad) return null;
    const from = ad.decidedAt || ad.submittedAt || new Date().toISOString();
    const expires = new Date(new Date(from).getTime() + days * DAY_MS);
    await mergeExtra(id, { duration_days: days, expires_at: expires.toISOString() });
    invalidateAdsCache();
    return {
        title: ad.title,
        expiresAt: expires.toISOString(),
        daysLeft: Math.ceil((expires.getTime() - Date.now()) / DAY_MS),
    };
}

/**
 * השהיה: המודעה יורדת מהאתר אבל שומרת את הימים שנותרו לה. בשונה
 * מ"הורד מהאתר" — המפרסם לא מפסיד ימים ששילם עליהם.
 */
export async function pauseAd(id: string): Promise<{ title: string; daysLeft: number } | null> {
    const ad = await getAd(id);
    if (!ad) return null;
    if (ad.paused) return { title: ad.title, daysLeft: ad.pausedDaysLeft ?? 0 };
    const daysLeft = ad.expiresAt
        ? Math.max(0, Math.ceil((Date.parse(ad.expiresAt) - Date.now()) / DAY_MS))
        : (ad.durationDays || DEFAULT_DURATION_DAYS);
    await mergeExtra(id, { paused: true, paused_days_left: daysLeft });
    invalidateAdsCache();
    return { title: ad.title, daysLeft };
}

/** המשך אחרי השהיה: הימים שנשמרו נספרים מחדש מהיום. */
export async function resumeAd(
    id: string,
): Promise<{ title: string; expiresAt: string; daysLeft: number } | null> {
    const ad = await getAd(id);
    if (!ad) return null;
    const daysLeft = ad.pausedDaysLeft ?? ad.durationDays ?? DEFAULT_DURATION_DAYS;
    const expires = new Date(Date.now() + daysLeft * DAY_MS);
    await mergeExtra(id, {
        paused: false,
        paused_days_left: null,
        expires_at: expires.toISOString(),
    }, 'approved');
    invalidateAdsCache();
    return { title: ad.title, expiresAt: expires.toISOString(), daysLeft };
}

// ---------- החלפת מקום בטור הפרסומות ----------

export type MoveDirection = 'up' | 'down';

/** המודעות שבאוויר, בסדר התצוגה בטור (המשבצות). */
async function listActiveInSlotOrder(): Promise<SubmittedAd[]> {
    const now = Date.now();
    const all = await listAllForAdmin();
    return all
        .filter((a) => a.status === 'approved')
        .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now)
        // מושהית אינה תופסת משבצת בטור
        .filter((a) => !a.paused)
        // listAllForAdmin מחזיר חדש→ותיק; סדר המשבצות הוא ותיק→חדש
        .reverse()
        .sort(bySlotOrder);
}

/**
 * מזיזה מודעה משבצת אחת למעלה/למטה בטור. המיקום נשמר ב-slot_order בתוך
 * extra_fields — אין עמודה ייעודית ב-items, ואותה עמודת json כבר נושאת
 * את כל שאר שדות המודעה.
 * מחזירה null אם המודעה לא באוויר או שהיא כבר בקצה הטור.
 */
export async function moveApprovedAd(
    id: string,
    direction: MoveDirection,
): Promise<{ title: string; position: number; total: number } | null> {
    const list = await listActiveInSlotOrder();
    const from = list.findIndex((a) => a.id === id);
    if (from === -1) return null;
    const to = direction === 'up' ? from - 1 : from + 1;
    if (to < 0 || to >= list.length) return null;

    const reordered = [...list];
    [reordered[from], reordered[to]] = [reordered[to], reordered[from]];

    // כותבים רק את מי שהמשבצת שלו באמת השתנתה: בפעם הראשונה זה כל הטור
    // (לאף מודעה אין עדיין slot_order), ומכאן והלאה שתי המודעות שהוחלפו.
    for (const [i, ad] of reordered.entries()) {
        if (ad.slotOrder === i) continue;
        await mergeExtra(ad.id, { slot_order: i });
    }
    invalidateAdsCache();
    return { title: reordered[to].title, position: to + 1, total: reordered.length };
}
