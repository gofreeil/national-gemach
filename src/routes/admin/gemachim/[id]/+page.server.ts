import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getGemachById, updateGemach, deleteGemach } from '$lib/server/db';
import { getPublicCategories } from '$lib/server/adminStore';
import { parseGemachForm, saveErrorMessage } from '$lib/server/gemachForm';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async ({ params }) => {
	const [gemach, categories] = await Promise.all([getGemachById(params.id), getPublicCategories()]);
	if (!gemach) throw error(404, 'הגמ"ח לא נמצא (ייתכן שנמחק או שאינו מנוהל ב-DB)');
	return { gemach, categories, cities };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const { input, error: err } = parseGemachForm(form, { admin: true });
		if (err) return fail(400, { error: err, values: input });

		// הצמדה/סידור אינם בטופס — משמרים את מה שנקבע ברשימה/ב"נעוצים"
		const existing = await getGemachById(params.id);
		input.featured = existing?.featured ?? false;
		input.order = existing?.order;

		try {
			// clearReview — עריכת אדמין נחשבת "נבדק": מכבה את התראת "חדש לבדיקה"
			await updateGemach(params.id, input, { clearReview: true });
		} catch (e) {
			console.error('[admin] updateGemach failed:', e);
			return fail(500, { error: saveErrorMessage(e, 'עדכון'), values: input });
		}
		throw redirect(303, '/admin/gemachim?flash=updated');
	},

	delete: async ({ params }) => {
		try {
			await deleteGemach(params.id);
		} catch (e) {
			console.error('[admin] deleteGemach failed:', e);
			return fail(500, { error: 'מחיקת הגמ"ח נכשלה. נסה שוב.' });
		}
		throw redirect(303, '/admin/gemachim?flash=deleted');
	}
};
