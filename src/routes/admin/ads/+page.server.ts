import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { listAllForAdmin, approveAd, rejectAd, unapproveAd, moveApprovedAd } from '$lib/server/adsStore';
import { getAdStats, type AdStats, type AdCounters } from '$lib/server/adStats';
import { normalizePlanDays, planLabel } from '$lib/adPlans';
import { rightAds } from '$lib/rightAdsData';

// מסך ניהול הפרסומות — פתוח לכל אדמין (לא רק סופר-אדמין), כדי שכל
// חבר צוות יוכל לאשר/לדחות; decidedBy מתעד מי החליט.
// בנוסף לאישור/דחייה, המסך מציג את לוח התפוסה (כמה משבצות תפוסות,
// עד מתי, ומה פנוי) ואת הנתונים של כל מפרסם — אותם מדדים שהמפרסם
// רואה בדשבורד שלו (/advertise/manage).

const DAY_MS = 24 * 60 * 60 * 1000;
const EMPTY: AdCounters = { impressions: 0, clicks: 0, landing: 0, leads: 0 };

function sumDays(st: AdStats | undefined): AdCounters {
    return (st?.days ?? []).reduce(
        (acc, d) => ({
            impressions: acc.impressions + d.impressions,
            clicks: acc.clicks + d.clicks,
            landing: acc.landing + d.landing,
            leads: acc.leads + d.leads,
        }),
        { ...EMPTY },
    );
}

export const load: PageServerLoad = async ({ locals }) => {
    await getAdminContext(locals);

    let raw: Awaited<ReturnType<typeof listAllForAdmin>> = [];
    let backendUnavailable = false;
    try {
        raw = await listAllForAdmin();
    } catch (err) {
        console.error('admin/ads load failed:', err);
        backendUnavailable = true;
    }

    // המדדים של כל המודעות + סכום 7 הימים האחרונים (למגמה)
    const stats = await getAdStats(raw.map((a) => a.id), 7)
        .catch((): Record<string, AdStats> => ({}));

    const now = Date.now();
    // סדר המשבצות בטור — זהה לסדר שהאתר מציג בו (מיקום ידני, ואחריו ותיק→חדש).
    // ממנו נגזר מספר המשבצת שמוצג ליד כל מודעה וכפתורי ההחלפה.
    const slotOrder = raw
        .filter((a) => a.status === 'approved')
        .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now)
        .slice()
        .reverse()
        .sort((x, y) => (x.slotOrder ?? Number.MAX_SAFE_INTEGER) - (y.slotOrder ?? Number.MAX_SAFE_INTEGER))
        .map((a) => a.id);

    const ads = raw.map((a) => {
        const st = stats[a.id];
        const expiresTs = a.expiresAt ? Date.parse(a.expiresAt) : NaN;
        const daysLeft = Number.isNaN(expiresTs) ? null : Math.ceil((expiresTs - now) / DAY_MS);
        // אושרה ופג תוקפה — כבר לא תופסת משבצת (הרשומה נשארת לארכיון)
        const isExpired = a.status === 'approved' && daysLeft !== null && daysLeft <= 0;
        const isActive = a.status === 'approved' && !isExpired;
        const totalDays = a.durationDays || null;
        // כמה מהתקופה נוצל — לפס ההתקדמות בלוח התפוסה
        const usedPct = isExpired
            ? 100
            : isActive && totalDays && daysLeft !== null
              ? Math.min(100, Math.max(0, Math.round((1 - daysLeft / totalDays) * 100)))
              : 0;
        return {
            ...a,
            totals: st?.totals ?? { ...EMPTY },
            week: sumDays(st),
            daysLeft,
            totalDays,
            usedPct,
            isActive,
            isExpired,
            slotIndex: slotOrder.indexOf(a.id),
            slotTotal: slotOrder.length,
        };
    });

    const activeCount = ads.filter((a) => a.isActive).length;
    const inventory = {
        totalSlots: rightAds.length,
        occupied: Math.min(activeCount, rightAds.length),
        freeNow: Math.max(0, rightAds.length - activeCount),
        pending: ads.filter((a) => a.status === 'pending').length,
        expired: ads.filter((a) => a.isExpired).length,
    };

    return { ads, inventory, backendUnavailable };
};

export const actions: Actions = {
    approve: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        // משך הפרסום נקבע כאן ולא ע"י המפרסם — לפי מה ששולם בפועל.
        const durationDays = normalizePlanDays(form.get('durationDays'));
        try {
            await approveAd(id, { durationDays, decidedBy: user.email ?? user.name ?? '' });
            return {
                success: true,
                message: `הפרסומת אושרה ופורסמה ל-${planLabel(durationDays)} ✅`,
            };
        } catch (err) {
            console.error('approve failed:', err);
            return fail(502, { error: 'האישור נכשל — נסו שוב' });
        }
    },
    reject: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        const reason = String(form.get('reason') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            await rejectAd(id, { reason, decidedBy: user.email ?? user.name ?? '' });
            return { success: true, message: 'הפרסומת נדחתה' };
        } catch (err) {
            console.error('reject failed:', err);
            return fail(502, { error: 'הדחייה נכשלה — נסו שוב' });
        }
    },
    // הורדת פרסומת שכבר באוויר — חוזרת לממתינות, המשבצת מתפנה מיד
    unapprove: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            await unapproveAd(id, user.email ?? user.name ?? '');
            return { success: true, message: 'הפרסומת הורדה מהאתר וחזרה לממתינות' };
        } catch (err) {
            console.error('unapprove failed:', err);
            return fail(502, { error: 'ההורדה נכשלה — נסו שוב' });
        }
    },
    // החלפת מקום בטור הפרסומות
    move: async ({ request, locals }) => {
        await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        const dir = form.get('dir') === 'down' ? 'down' : 'up';
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            const r = await moveApprovedAd(id, dir);
            if (!r) return fail(400, { error: 'הפרסומת כבר בקצה הטור' });
            return { success: true, message: `${r.title} — משבצת ${r.position} מתוך ${r.total}` };
        } catch (err) {
            console.error('move failed:', err);
            return fail(502, { error: 'החלפת המקום נכשלה — נסו שוב' });
        }
    },
};
