import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { listAllClaims, approveClaim, rejectClaim } from '$lib/server/claimsStore';

// מסך אישור תביעות-בעלות — פתוח לכל אדמין (כמו אישור פרסומות).
// אישור מעביר את ה-user_id של הגמ"ח למבקש, כך שיוכל לערוך אותו.
export const load: PageServerLoad = async ({ locals }) => {
	await getAdminContext(locals);
	let claims: Awaited<ReturnType<typeof listAllClaims>> = [];
	let backendUnavailable = false;
	try {
		claims = await listAllClaims();
	} catch (e) {
		console.error('admin/claims load failed:', e);
		backendUnavailable = true;
	}
	return { claims, backendUnavailable };
};

export const actions: Actions = {
	approve: async ({ request, locals }) => {
		const { user } = await getAdminContext(locals);
		const id = String((await request.formData()).get('id') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה בקשה' });
		try {
			await approveClaim(id, { decidedBy: user.email ?? user.name ?? '' });
			return { success: true, message: 'הבקשה אושרה — הבעלות הועברה למבקש ✅' };
		} catch (e) {
			console.error('approve claim failed:', e);
			return fail(502, { error: 'האישור נכשל — נסו שוב' });
		}
	},
	reject: async ({ request, locals }) => {
		const { user } = await getAdminContext(locals);
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		const reason = String(fd.get('reason') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה בקשה' });
		try {
			await rejectClaim(id, { reason, decidedBy: user.email ?? user.name ?? '' });
			return { success: true, message: 'הבקשה נדחתה' };
		} catch (e) {
			console.error('reject claim failed:', e);
			return fail(502, { error: 'הדחייה נכשלה — נסו שוב' });
		}
	},
};
