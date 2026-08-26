import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext, requireSuperAdmin } from '$lib/server/admin';
import {
    listAllForAdmin,
    approveAd,
    rejectAd,
    unrejectAd,
    unapproveAd,
    removeAd,
    updateAdFields,
    computeAdsStats,
    computeSchedules,
    computeAdvertisers,
    computeAdSlots,
    setAdDuration,
    normalizeDurationDays,
    pauseAd,
    resumeAd,
    moveApprovedAd,
    setAdSlot,
    getAd,
    withAdImageUrls,
} from '$lib/server/adsStore';

// ============================================================
// מסך ניהול הפרסומות — אותו פאנל כמו ב"קהילה בשכונה" (ads-review),
// מחובר לשכבת האחסון המקומית (adsStore על אוסף ה-items).
// פתוח לכל אדמין; מחיקה לצמיתות שמורה לסופר-אדמין.
// ============================================================

const fmtDay = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });

export const load: PageServerLoad = async ({ locals }) => {
    const { role } = await getAdminContext(locals);

    let all: Awaited<ReturnType<typeof listAllForAdmin>> = [];
    let backendUnavailable = false;
    try {
        all = await listAllForAdmin();
    } catch (err) {
        console.error('[admin/ads] load failed:', err instanceof Error ? err.message : err);
        backendUnavailable = true;
    }

    // שליפה אחת — הכל נגזר ממנה בזיכרון (אין cache פר-סטטוס כמו בקהילה)
    const pending = all.filter((a) => a.status !== 'approved');
    const approvedRaw = all.filter((a) => a.status === 'approved');
    // מספר המקום של כל מאושרת בטור (1..16) - לכותרת הכרטיס בטאב "פורסמו";
    // הרשימה ממוינת לפי המקום = "סדר התצוגה באתר" שחצי ההחלפה עובדים מולו
    const slotMap = computeAdSlots(approvedRaw);
    const approved = approvedRaw
        .map((a) => ({ ...withAdImageUrls(a), slot: slotMap.get(a.id) }))
        .sort((x, y) => (x.slot ?? Number.MAX_SAFE_INTEGER) - (y.slot ?? Number.MAX_SAFE_INTEGER));

    return {
        pending,
        approved,
        stats: computeAdsStats(all),
        schedules: computeSchedules(approvedRaw),
        advertisers: computeAdvertisers(all),
        // אין מערכת הודעות פנימית בגמ"ח — אין תזכורות אוטומטיות למפרסמים
        reminderRun: { sent: 0, checked: 0 },
        backendUnavailable,
        role,
    };
};

function parseIds(formData: FormData): string[] {
    const raw = formData.getAll('id');
    const single = raw.map((v) => String(v)).filter(Boolean);
    if (single.length > 0) return Array.from(new Set(single));
    const csv = formData.get('ids')?.toString() ?? '';
    return Array.from(new Set(csv.split(',').map((s) => s.trim()).filter(Boolean)));
}

export const actions: Actions = {
    approve: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        // ברירת המחדל לגרסה מעודכנת היא החלפה. keepPrevious הוא המקרה ההפוך:
        // מפרסם שבאמת רוצה שתי פרסומות במקביל ולא שדרג את הקיימת.
        const keepPrevious = formData.get('keepPrevious') === '1';
        try {
            const { title, replacedTitle } = await approveAd(id, {
                decidedBy: user.email || user.name || '',
                keepPrevious,
            });
            return {
                success: true,
                message: replacedTitle
                    ? `אושרה ופורסמה: ${title} - נכנסה במקום "${replacedTitle}", שירדה מהאתר`
                    : `אושרה ופורסמה: ${title}`,
            };
        } catch (err) {
            console.error('[admin/ads] approve failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'האישור נכשל - נסה שוב בעוד רגע' });
        }
    },

    reject: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const reason = (formData.get('reason') as string) || '';
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const ad = await getAd(id);
        if (!ad) return fail(404, { error: 'הפרסומת לא נמצאה' });
        try {
            await rejectAd(id, { reason, decidedBy: user.email || user.name || '' });
            return { success: true, message: `נדחתה: ${ad.title}` };
        } catch (err) {
            console.error('[admin/ads] reject failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'הדחייה נכשלה - נסה שוב בעוד רגע' });
        }
    },

    bulkApprove: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const ids = parseIds(await request.formData());
        if (ids.length === 0) return fail(400, { error: 'לא נבחרו פרסומות' });
        let ok = 0;
        let replaced = 0;
        for (const id of ids) {
            try {
                const r = await approveAd(id, { decidedBy: user.email || user.name || '' });
                ok++;
                if (r.replacedTitle) replaced++;
            } catch (err) {
                console.warn('[admin/ads] bulkApprove item failed:', err instanceof Error ? err.message : err);
            }
        }
        return {
            success: true,
            message: `אושרו ופורסמו ${ok} פרסומות` +
                (replaced > 0 ? ` (${replaced} החליפו גרסה קודמת שירדה מהאתר)` : ''),
        };
    },

    bulkReject: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const formData = await request.formData();
        const ids = parseIds(formData);
        const reason = (formData.get('reason') as string) || '';
        if (ids.length === 0) return fail(400, { error: 'לא נבחרו פרסומות' });
        let ok = 0;
        for (const id of ids) {
            try {
                await rejectAd(id, { reason, decidedBy: user.email || user.name || '' });
                ok++;
            } catch (err) {
                console.warn('[admin/ads] bulkReject item failed:', err instanceof Error ? err.message : err);
            }
        }
        return { success: true, message: `נדחו ${ok} פרסומות` };
    },

    unreject: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const r = await unrejectAd(id);
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        return { success: true, message: `הוחזרה לממתינות: ${r.title}` };
    },

    unapprove: async ({ request, locals }) => {
        const { user } = await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const ad = await getAd(id);
        if (!ad) return fail(404, { error: 'הפרסומת לא נמצאה' });
        try {
            await unapproveAd(id, user.email || user.name || '');
            return { success: true, message: `הורדה מהאתר: ${ad.title}` };
        } catch (err) {
            console.error('[admin/ads] unapprove failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'ההורדה נכשלה - נסה שוב בעוד רגע' });
        }
    },

    // קציבת תקופת פרסום - התקופה נספרת מיום הפרסום
    setDuration: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const days = normalizeDurationDays(formData.get('days'));
        let r;
        try {
            r = await setAdDuration(id, days);
        } catch (e) {
            console.warn('[admin/ads] setDuration failed:', e instanceof Error ? e.message : e);
            return fail(502, { error: 'קציבת התקופה נכשלה - נסה שוב בעוד רגע' });
        }
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        const suffix = r.daysLeft < 0 ? ' - התקופה כבר חלפה, הפרסומת ירדה מהאתר' : '';
        return { success: true, message: `${r.title}: ${days} ימים, עד ${fmtDay(r.expiresAt)}${suffix}` };
    },

    // השהיה - יורדת מהאתר ושומרת את הימים שנותרו
    pause: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        let r;
        try {
            r = await pauseAd(id);
        } catch (e) {
            console.warn('[admin/ads] pause failed:', e instanceof Error ? e.message : e);
            return fail(502, { error: 'ההשהיה נכשלה - נסה שוב בעוד רגע' });
        }
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        return { success: true, message: `${r.title} הושהתה - ${r.daysLeft} ימים שמורים לה` };
    },

    // המשך אחרי השהיה - הימים השמורים נספרים מהיום
    resume: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        let r;
        try {
            r = await resumeAd(id);
        } catch (e) {
            console.warn('[admin/ads] resume failed:', e instanceof Error ? e.message : e);
            return fail(502, { error: 'ההפעלה מחדש נכשלה - נסה שוב בעוד רגע' });
        }
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        return { success: true, message: `${r.title} חזרה לאוויר - ${r.daysLeft} ימים, עד ${fmtDay(r.expiresAt)}` };
    },

    // החלפת מקום בסדר התצוגה באתר
    move: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        const dir = formData.get('dir') === 'down' ? 'down' : 'up';
        if (!id) return fail(400, { error: 'חסר מזהה' });
        let r;
        try {
            r = await moveApprovedAd(id, dir);
        } catch (e) {
            console.warn('[admin/ads] move failed:', e instanceof Error ? e.message : e);
            return fail(502, { error: 'החלפת המקום נכשלה - נסה שוב בעוד רגע' });
        }
        if (!r) return fail(400, { error: 'הפרסומת כבר בקצה הרשימה' });
        return { success: true, message: `${r.title} - מקום ${r.position} מתוך ${r.total}` };
    },

    // הצבת פרסומת במקום מספרי בטור (1..16); מקום תפוס - השתיים מתחלפות
    setSlot: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        let r;
        try {
            r = await setAdSlot(id, Number(formData.get('slot')));
        } catch (e) {
            console.warn('[admin/ads] setSlot failed:', e instanceof Error ? e.message : e);
            return fail(502, { error: 'העברת המקום נכשלה - נסה שוב בעוד רגע' });
        }
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        return {
            success: true,
            message: r.swappedTitle
                ? `"${r.title}" עברה למקום ${r.slot}, ו"${r.swappedTitle}" עברה למקום ${r.swappedSlot}`
                : `"${r.title}" עברה למקום ${r.slot}`,
        };
    },

    // מחיקה לצמיתות שמורה לסופר-אדמין; אדמין שמונה מוריד מהאתר ולא מוחק
    remove: async ({ request, locals }) => {
        const { role } = await getAdminContext(locals);
        requireSuperAdmin(role);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const ad = await getAd(id);
        if (!ad) return fail(404, { error: 'הפרסומת לא נמצאה' });
        try {
            await removeAd(id);
            return { success: true, message: 'נמחקה לצמיתות' };
        } catch (err) {
            console.error('[admin/ads] remove failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'המחיקה נכשלה - נסה שוב בעוד רגע' });
        }
    },

    update: async ({ request, locals }) => {
        await getAdminContext(locals);
        const formData = await request.formData();
        const id = formData.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const r = await updateAdFields(id, {
            title:     (formData.get('title')     as string | null) ?? undefined,
            subtitle:  (formData.get('subtitle')  as string | null) ?? undefined,
            cta:       (formData.get('cta')       as string | null) ?? undefined,
            hoverText: (formData.get('hoverText') as string | null) ?? undefined,
        });
        if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
        return { success: true, message: `עודכנה: ${r.title}` };
    },
};
