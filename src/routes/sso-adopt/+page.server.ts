import { redirect, isRedirect } from '@sveltejs/kit';
import { signIn } from '../../auth';
import type { PageServerLoad, Actions } from './$types';

/**
 * דף ביניים לזיהוי אוטומטי (ראו $lib/server/ssoAdopt.ts). ה-hook הפנה לכאן כי
 * קיימת עוגיית gofreeil-auth ואין סשן מקומי. ההתחברות רצה בשרת (action) כמו
 * ב-/auth/community-callback; כל כישלון — חזרה ליעד המקורי כאורח.
 */
export const load: PageServerLoad = async ({ url }) => {
	const raw = url.searchParams.get('redirect') ?? '/';
	// רק נתיב פנימי (מונע open-redirect; חוסם גם '/\' שהדפדפן הופך ל-//)
	const redirectTo = /^\/(?![/\\])/.test(raw) ? raw : '/';
	return { redirectTo };
};

export const actions: Actions = {
	default: async (event) => {
		const form = await event.request.clone().formData().catch(() => null);
		const raw = String(form?.get('redirectTo') ?? '/');
		const back = /^\/(?![/\\])/.test(raw) ? raw : '/';
		try {
			await signIn(event);
		} catch (err) {
			// הצלחה נזרקת כ-redirect של SvelteKit — מעבירים הלאה
			if (isRedirect(err)) throw err;
			// עוגייה מתה/חסרה — נשארים אורחים ביעד המקורי (sso_adopt_tried מונעת לולאה)
			throw redirect(303, back);
		}
	}
};
