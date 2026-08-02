import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGemach } from '$lib/server/db';
import { getPublicCategories } from '$lib/server/adminStore';
import { pinGemach } from '$lib/server/pinned';
import { parseGemachForm, saveErrorMessage } from '$lib/server/gemachForm';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async () => {
	return { categories: await getPublicCategories(), cities };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const { input, error } = parseGemachForm(form);
		if (error) return fail(400, { error, values: input });

		let created: { id: string };
		try {
			created = await createGemach(input);
		} catch (e) {
			console.error('[admin] createGemach failed:', e);
			return fail(500, { error: saveErrorMessage(e, 'יצירת'), values: input });
		}
		// סימון "נעץ" בטופס מוסיף גם לרשימת הנעוצים — היא מקור האמת לדף הבית
		if (input.featured) {
			await pinGemach(created.id).catch(e => console.error('[admin] pinGemach failed:', e));
		}
		throw redirect(303, '/admin/gemachim?flash=created');
	}
};
