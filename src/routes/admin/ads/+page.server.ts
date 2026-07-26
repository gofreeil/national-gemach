import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext, requireSuperAdmin } from '$lib/server/admin';
import { listAllForAdmin, approveAd, rejectAd } from '$lib/server/adsStore';

// מסך אישור פרסומות — סופר-אדמין בלבד (כמו במקור בקבוצות רכישה):
// התשלום ידני, ולכן מי שמקבל את הכסף הוא שמאשר ואת משך הפרסום.

export const load: PageServerLoad = async ({ locals }) => {
    const { role } = await getAdminContext(locals);
    requireSuperAdmin(role);

    let ads: Awaited<ReturnType<typeof listAllForAdmin>> = [];
    let backendUnavailable = false;
    try {
        ads = await listAllForAdmin();
    } catch (err) {
        console.error('admin/ads load failed:', err);
        backendUnavailable = true;
    }
    return { ads, backendUnavailable };
};

export const actions: Actions = {
    approve: async ({ request, locals }) => {
        const { user, role } = await getAdminContext(locals);
        requireSuperAdmin(role);
        const form = await request.formData();
        const id = String(form.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה פרסומת' });
        // משך הפרסום נקבע כאן ולא ע"י המפרסם — לפי מה ששולם בפועל.
        const durationDays = Number(form.get('durationDays')) === 180 ? 180 : 30;
        try {
            await approveAd(id, { durationDays, decidedBy: user.email ?? user.name ?? '' });
            return {
                success: true,
                message: `הפרסומת אושרה ופורסמה ל-${durationDays === 180 ? 'חצי שנה' : 'חודש'} ✅`,
            };
        } catch (err) {
            console.error('approve failed:', err);
            return fail(502, { error: 'האישור נכשל — נסו שוב' });
        }
    },
    reject: async ({ request, locals }) => {
        const { user, role } = await getAdminContext(locals);
        requireSuperAdmin(role);
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
};
