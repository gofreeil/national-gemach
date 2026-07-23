import { fail, redirect, error } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getGemachById, updateGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { parseGemachForm, saveErrorMessage } from '$lib/server/gemachForm';
import { isGemachOwner } from '$lib/server/ownership';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async ({ params, locals, url }) => {
	const session = await locals.auth();
	if (!session?.user) throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);

	const [gemach, categories] = await Promise.all([getGemachById(params.id), getCategories()]);
	if (!gemach) throw error(404, 'הגמ"ח לא נמצא (ייתכן שנמחק או שאינו מנוהל ב-DB)');

	if (!isGemachOwner(session.user, gemach.ownerId)) {
		throw error(403, 'רק בעל הגמ"ח יכול לערוך אותו. אם זה הגמ"ח שלך — התחבר עם אותו חשבון שבו הוא נוצר.');
	}

	// לא לחשוף את מזהה-הבעלות ללקוח (עשוי להיות מייל)
	delete gemach.ownerId;
	return { gemach, categories, cities };
};

export const actions: Actions = {
	update: async ({ request, params, locals }) => {
		const session = await locals.auth();
		if (!session?.user) throw redirect(302, '/login');

		// אימות בעלות מחדש בצד-שרת — לא לסמוך על ה-load; ובמקביל שולף את הקיים
		// כדי לשמר שדות-אדמין (הצמדה/סידור) שאינם בטופס הבעלים.
		const existing = await getGemachById(params.id);
		if (!existing) throw error(404, 'הגמ"ח לא נמצא');
		if (!isGemachOwner(session.user, existing.ownerId)) {
			throw error(403, 'אין לך הרשאה לערוך גמ"ח זה');
		}

		const form = await request.formData();
		const { input, error: err } = parseGemachForm(form);
		if (err) return fail(400, { error: err, values: input });

		// הבעלים אינו שולט בהצמדה/סידור — משמרים את מה שהאדמין קבע
		input.featured = existing.featured ?? false;
		input.order = existing.order;

		try {
			await updateGemach(params.id, input);
		} catch (e) {
			console.error('[owner-edit] updateGemach failed:', e);
			return fail(500, { error: saveErrorMessage(e, 'עדכון'), values: input });
		}
		throw redirect(303, `/gemach/${params.id}?flash=updated`);
	}
};
