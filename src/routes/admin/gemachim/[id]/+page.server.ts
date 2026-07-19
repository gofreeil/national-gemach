import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getGemachById, updateGemach, deleteGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { parseGemachForm } from '$lib/server/gemachForm';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async ({ params }) => {
	const [gemach, categories] = await Promise.all([getGemachById(params.id), getCategories()]);
	if (!gemach) throw error(404, 'הגמ"ח לא נמצא (ייתכן שנמחק או שאינו מנוהל ב-DB)');
	return { gemach, categories, cities };
};

export const actions: Actions = {
	update: async ({ request, params }) => {
		const form = await request.formData();
		const { input, error: err } = parseGemachForm(form);
		if (err) return fail(400, { error: err, values: input });

		try {
			await updateGemach(params.id, input);
		} catch (e) {
			console.error('[admin] updateGemach failed:', e);
			return fail(500, { error: 'עדכון הגמ"ח נכשל. נסה שוב.', values: input });
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
