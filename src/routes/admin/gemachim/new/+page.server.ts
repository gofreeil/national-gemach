import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { parseGemachForm } from '$lib/server/gemachForm';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async () => {
	return { categories: await getCategories(), cities };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const { input, error } = parseGemachForm(form);
		if (error) return fail(400, { error, values: input });

		try {
			await createGemach(input);
		} catch (e) {
			console.error('[admin] createGemach failed:', e);
			return fail(500, { error: 'שמירת הגמ"ח נכשלה. ודא שהשרת מחובר ונסה שוב.', values: input });
		}
		throw redirect(303, '/admin/gemachim?flash=created');
	}
};
