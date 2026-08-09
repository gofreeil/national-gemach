import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import {
    listAllForAdmin,
    approveAd,
    rejectAd,
    unapproveAd,
    moveApprovedAd,
    setAdSlot,
    computeAdSlots,
    setAdDuration,
    normalizeDurationDays,
    pauseAd,
    resumeAd,
} from '$lib/server/adsStore';
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
    // המספר הקבוע של כל מודעה מאושרת בלוח (1..12) — חישוב בזיכרון בלבד,
    // בלי כתיבה ל-Strapi; ההצמדה נעשית בפעולות הניהול עצמן.
    const slotMap = computeAdSlots(raw.filter((a) => a.status === 'approved'));
    // סדר הלוח בין המודעות *שבאוויר* — לחצי ההחלפה (מי שכנה של מי, והקצוות)
    const liveOrder = raw
        .filter((a) => a.status === 'approved')
        .filter((a) => !a.expiresAt || Date.parse(a.expiresAt) > now)
        .filter((a) => !a.paused)
        .slice()
        .sort((x, y) => (slotMap.get(x.id) ?? 0) - (slotMap.get(y.id) ?? 0))
        .map((a) => a.id);

    const ads = raw.map((a) => {
        const st = stats[a.id];
        const expiresTs = a.expiresAt ? Date.parse(a.expiresAt) : NaN;
        const daysLeft = Number.isNaN(expiresTs) ? null : Math.ceil((expiresTs - now) / DAY_MS);
        // אושרה ופג תוקפה — כבר לא תופסת משבצת (הרשומה נשארת לארכיון)
        const isExpired = a.status === 'approved' && daysLeft !== null && daysLeft <= 0;
        // מושהית: אושרה, לא פגה, אבל ירדה מהאתר עד להפעלה מחדש
        const isPaused = a.status === 'approved' && !isExpired && !!a.paused;
        const isActive = a.status === 'approved' && !isExpired && !isPaused;
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
            isPaused,
            // מספר המקום הקבוע בלוח (1..12) — מה שהבורר "⇄ העבר" משנה
            slot: slotMap.get(a.id) ?? null,
            slotIndex: liveOrder.indexOf(a.id),
            slotTotal: liveOrder.length,
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
        // ברירת המחדל לגרסה מעודכנת היא החלפה. keepPrevious הוא המקרה ההפוך:
        // מפרסם שבאמת רוצה שתי מודעות במקביל ולא שדרג את הקיימת.
        const keepPrevious = String(form.get('keepPrevious') ?? '') === '1';
        try {
            const { replacedTitle } = await approveAd(id, {
                durationDays,
                decidedBy: user.email ?? user.name ?? '',
                keepPrevious,
            });
            return {
                success: true,
                message: replacedTitle
                    ? `הפרסומת אושרה ונכנסה במקום "${replacedTitle}", שירדה מהאתר ✅`
                    : `הפרסומת אושרה ופורסמה ל-${planLabel(durationDays)} ✅`,
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
    // קציבת תקופת פרסום — נספרת מיום האישור
    setDuration: async ({ request, locals }) => {
        await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        const days = normalizeDurationDays(form.get('days'));
        try {
            const r = await setAdDuration(id, days);
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            const suffix = r.daysLeft < 0 ? ' — התקופה כבר חלפה, הפרסומת ירדה מהאתר' : '';
            return { success: true, message: `${r.title}: ${days} ימים${suffix}` };
        } catch (err) {
            console.error('setDuration failed:', err);
            return fail(502, { error: 'קציבת התקופה נכשלה — נסו שוב' });
        }
    },
    // השהיה — יורדת מהאתר ושומרת את הימים שנותרו
    pause: async ({ request, locals }) => {
        await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            const r = await pauseAd(id);
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            return { success: true, message: `${r.title} הושהתה — ${r.daysLeft} ימים שמורים לה` };
        } catch (err) {
            console.error('pause failed:', err);
            return fail(502, { error: 'ההשהיה נכשלה — נסו שוב' });
        }
    },
    // המשך אחרי השהיה — הימים השמורים נספרים מהיום
    resume: async ({ request, locals }) => {
        await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            const r = await resumeAd(id);
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            return { success: true, message: `${r.title} חזרה לאוויר — ${r.daysLeft} ימים` };
        } catch (err) {
            console.error('resume failed:', err);
            return fail(502, { error: 'ההפעלה מחדש נכשלה — נסו שוב' });
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
    // הצבת מודעה במקום מספרי בלוח (1..12); מקום תפוס — השתיים מתחלפות
    setSlot: async ({ request, locals }) => {
        await getAdminContext(locals);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        try {
            const r = await setAdSlot(id, Number(form.get('slot')));
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            return {
                success: true,
                message: r.swappedTitle
                    ? `"${r.title}" עברה למקום ${r.slot}, ו"${r.swappedTitle}" עברה למקום ${r.swappedSlot}`
                    : `"${r.title}" עברה למקום ${r.slot}`,
            };
        } catch (err) {
            console.error('setSlot failed:', err);
            return fail(502, { error: 'העברת המקום נכשלה — נסו שוב' });
        }
    },
};
