// ============================================================
// myAdsActions.ts — קיצורי הניהול מ"הפרסומות שלי" (/profile, /advertise/manage)
// ------------------------------------------------------------
// לאדמין שגם מפרסם בעצמו, כדי לא לעבור למסך הניהול בשביל פרסומת אחת.
// אותן פונקציות בדיוק כמו ב-/admin/ads; ההרשאה נבדקת בתוך כל פעולה, לא
// רק ב-load. כל התוצאות באותה צורה: { message } בהצלחה, fail עם { error }
// בכישלון — שני הדפים מציגים אותה הודעה מעל הרשימה.
// ============================================================

import { fail, type RequestEvent } from '@sveltejs/kit';
import { resolveRole } from './admin';
import { approveAd, pauseAd, rejectAd, resumeAd, unapproveAd } from './adsStore';
import { normalizePlanDays, planLabel } from '$lib/adPlans';

type Prepared =
    | { id: string; form: FormData; decidedBy: string }
    | { error: string; status: number };

/** בדיקת ההרשאה + חילוץ מזהה הפרסומת מהטופס — משותף לכל הפעולות */
async function adAction(event: RequestEvent): Promise<Prepared> {
    const session = await event.locals.auth();
    const user = session?.user;
    if (!user || !(await resolveRole(user))) return { error: 'נדרשת הרשאת ניהול', status: 403 };
    const form = await event.request.formData();
    const id = String(form.get('id') ?? '');
    if (!id) return { error: 'חסר מזהה פרסומת', status: 400 };
    return { id, form, decidedBy: user.email || user.name || '' };
}

export const myAdsAdminActions = {
    // אישור (או חידוש של פרסומת שפג תוקפה — אותה פעולה, תוקף חדש מהיום).
    // המסלול = מה שהמפרסם בחר בשליחה (הבחירה המפורשת נשארת במסך הניהול).
    approve: async (event: RequestEvent) => {
        const a = await adAction(event);
        if ('error' in a) return fail(a.status, { error: a.error });
        const durationDays = normalizePlanDays(a.form.get('durationDays'));
        try {
            const { replacedTitle } = await approveAd(a.id, { durationDays, decidedBy: a.decidedBy });
            return {
                message: replacedTitle
                    ? `הפרסומת אושרה ל-${planLabel(durationDays)} ונכנסה במקום "${replacedTitle}" ✅`
                    : `הפרסומת אושרה ופורסמה ל-${planLabel(durationDays)} ✅`,
            };
        } catch (err) {
            console.error('[my-ads] approve failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'האישור נכשל - נסו שוב' });
        }
    },
    reject: async (event: RequestEvent) => {
        const a = await adAction(event);
        if ('error' in a) return fail(a.status, { error: a.error });
        try {
            await rejectAd(a.id, { reason: String(a.form.get('reason') ?? ''), decidedBy: a.decidedBy });
            return { message: 'הפרסומת נדחתה' };
        } catch (err) {
            console.error('[my-ads] reject failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'הדחייה נכשלה - נסו שוב' });
        }
    },
    // השהיה — יורדת מהאתר והימים שנותרו נשמרים לה
    pause: async (event: RequestEvent) => {
        const a = await adAction(event);
        if ('error' in a) return fail(a.status, { error: a.error });
        try {
            const r = await pauseAd(a.id);
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            return { message: `${r.title} הושהתה - ${r.daysLeft} ימים שמורים לה` };
        } catch (err) {
            console.error('[my-ads] pause failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'ההשהיה נכשלה - נסו שוב' });
        }
    },
    // המשך אחרי השהיה — הימים השמורים נספרים מהיום
    resume: async (event: RequestEvent) => {
        const a = await adAction(event);
        if ('error' in a) return fail(a.status, { error: a.error });
        try {
            const r = await resumeAd(a.id);
            if (!r) return fail(404, { error: 'הפרסומת לא נמצאה' });
            return { message: `${r.title} חזרה לאוויר - ${r.daysLeft} ימים` };
        } catch (err) {
            console.error('[my-ads] resume failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'ההפעלה מחדש נכשלה - נסו שוב' });
        }
    },
    // הורדה מהאתר בלי מחיקה — חוזרת לממתינות
    unapprove: async (event: RequestEvent) => {
        const a = await adAction(event);
        if ('error' in a) return fail(a.status, { error: a.error });
        try {
            await unapproveAd(a.id, a.decidedBy);
            return { message: 'הפרסומת הורדה מהאתר וחזרה לממתינות' };
        } catch (err) {
            console.error('[my-ads] unapprove failed:', err instanceof Error ? err.message : err);
            return fail(502, { error: 'ההורדה נכשלה - נסו שוב' });
        }
    },
};
