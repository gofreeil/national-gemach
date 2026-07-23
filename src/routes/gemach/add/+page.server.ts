import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { parseGemachForm, saveErrorMessage } from '$lib/server/gemachForm';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async ({ locals, url }) => {
	// הוספת גמ"ח מחייבת התחברות — הגמ"ח נרשם על שם המשתמש כדי שיוכל לערוך אותו אח"כ
	const session = await locals.auth();
	if (!session?.user) throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);

	return { categories: await getCategories(), cities };
};

export const actions: Actions = {
	create: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user) throw redirect(302, '/login');

		const form = await request.formData();
		const { input, error } = parseGemachForm(form);
		if (error) return fail(400, { error, values: input });

		// מזהה-בעלים בפורמט שבו "קהילה בשכונה" כותבת ומזהה בעלות (credentials_<email>) —
		// כך אותו משתמש יכול לערוך את הגמ"ח בשני האתרים. נפילה-אחורה למזהה המספרי
		// של Strapi אם משום-מה אין מייל בסשן.
		const email = (session.user.email ?? '').trim().toLowerCase();
		const ownerId = email ? `credentials_${email}` : String(session.user.id ?? '').trim();

		let id: string;
		try {
			({ id } = await createGemach(input, { ownerId: ownerId || undefined }));
		} catch (e) {
			console.error('[owner-create] createGemach failed:', e);
			return fail(500, { error: saveErrorMessage(e, 'יצירת'), values: input });
		}
		// flash=created → דף הגמ"ח מציג אישור + קישור לאתר המקביל "קהילה בשכונה"
		throw redirect(303, `/gemach/${id}?flash=created`);
	}
};
