import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { createGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { parseGemachForm, saveErrorMessage } from '$lib/server/gemachForm';
import { ownerIdForSession } from '$lib/server/ownership';
import { newDraftToken, setDraftTicket } from '$lib/server/guestDraft';
import { cities } from '$lib/gemachData';

export const load: PageServerLoad = async ({ locals, url }) => {
	// הטופס פתוח גם למי שאינו מחובר — לא לחסום מתנדב שרוצה לתרום גמ"ח בגלל
	// מסך התחברות. אורח שישלח יקבל טיוטה שמורה, וההתחברות בסוף (/gemach/claim)
	// היא זו שרושמת את הגמ"ח על שמו ומפרסמת אותו.
	const session = await locals.auth();
	const categories = await getCategories();

	// ?category=<key> — מי שהגיע מסינון קטגוריה בדף הבית מקבל אותה בחורה מראש.
	// מאומת מול הרשימה, כדי שערך מומצא בכתובת לא יזרע את הטופס.
	const wanted = url.searchParams.get('category');
	const presetCategory = categories.some((c) => c.key === wanted) ? wanted : null;

	return { loggedIn: !!session?.user, categories, cities, presetCategory };
};

export const actions: Actions = {
	create: async ({ request, locals, cookies }) => {
		const session = await locals.auth();

		const form = await request.formData();
		const { input, error } = parseGemachForm(form);
		if (error) return fail(400, { error, values: input });

		// ----- אורח: שומרים כטיוטה מוסתרת ושולחים להתחברות -----
		if (!session?.user) {
			const token = newDraftToken();
			input.status = 'draft';   // מוסתר מהאתר עד שיאומץ ויפורסם
			let draftId: string;
			try {
				// בלי ownerId — הטיוטה עדיין לא שייכת לאיש; רק מחזיק האסימון יאמץ אותה
				({ id: draftId } = await createGemach(input, { guestToken: token }));
			} catch (e) {
				console.error('[guest-create] createGemach failed:', e);
				return fail(500, { error: saveErrorMessage(e, 'יצירת'), values: input });
			}
			setDraftTicket(cookies, { id: draftId, token });
			throw redirect(303, '/gemach/claim');
		}

		// ----- מחובר: נוצר מיד כגמ"ח מפורסם על שמו -----
		const ownerId = ownerIdForSession(session.user);

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
