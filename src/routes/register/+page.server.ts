import { redirect, fail } from '@sveltejs/kit';
import { strapiRegister } from '$lib/server/strapiAuth';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	const redirectTo = url.searchParams.get('redirect') ?? '/';
	if (session?.user) throw redirect(302, redirectTo);
	return { redirectTo };
};

export const actions: Actions = {
	default: async ({ request }) => {
		const form = await request.formData();
		const name = (form.get('name') as string)?.trim();
		const email = (form.get('email') as string)?.trim().toLowerCase();
		const password = form.get('password') as string;

		if (!email || !password) return fail(400, { error: 'יש למלא אימייל וסיסמה' });
		if (password.length < 6) return fail(400, { error: 'הסיסמה חייבת להכיל לפחות 6 תווים' });

		const username = name || email.split('@')[0];
		try {
			await strapiRegister(username, email, password);
		} catch (err) {
			const msg = String((err as Error)?.message || '');
			if (msg.includes('taken') || msg.includes('already') || msg.includes('400'))
				return fail(400, { error: 'משתמש עם אימייל זה כבר קיים' });
			return fail(500, { error: 'ההרשמה נכשלה, נסו שוב' });
		}
		// הצלחה — הלקוח יבצע signIn('credentials') עם אותם פרטים
		return { success: true };
	}
};
