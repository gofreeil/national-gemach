import { redirect, isRedirect } from '@sveltejs/kit';
import { signIn } from '../../../auth';
import type { PageServerLoad, Actions } from './$types';

export const load: PageServerLoad = async ({ url }) => {
	const raw = url.searchParams.get('returnTo') ?? '/';
	const returnTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	return { returnTo, error: url.searchParams.get('error') };
};

// כניסת ה-SSO חייבת לרוץ בצד שרת: ה-signIn של @auth/sveltekit/client שולח
// ספק credentials עם id מותאם (gofreeil-sso) לנקודת הקצה של OAuth במקום
// ל-callback, ולכן authorize() לא רץ כלל והמשתמש הוחזר ל-/login בלי שגיאה.
// ה-signIn השרתי מזהה את סוג הספק ומנתב נכון.
export const actions: Actions = {
	default: async (event) => {
		try {
			await signIn(event);
		} catch (err) {
			// הצלחה נזרקת כ-redirect של SvelteKit — מעבירים הלאה
			if (isRedirect(err)) throw err;
			// כישלון אימות (עוגייה חסרה/פגה) — חוזרים ל-login עם הודעה גלויה
			throw redirect(303, '/login?error=sso_failed');
		}
	}
};
