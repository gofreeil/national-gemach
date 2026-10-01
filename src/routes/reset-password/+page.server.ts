import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { confirmPasswordReset, RecoveryError, SHARED_COOKIE, sharedCookieOptions } from '$lib/server/recovery';

// אחרי שהסיסמה נקבעה המשתמש נכנס מיד: שותלים את העוגייה המשותפת gofreeil-auth
// (מחברת אותו גם בשאר אתרי הרשת) וממשיכים לגשר ה-SSO של האתר, שמקים את הסשן.
const AFTER_RESET = '/?welcome=back';

export const load: PageServerLoad = ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	return { code: (url.searchParams.get('code') || '').trim().slice(0, 400) };
};

const failReset = (status: number, error: string, expired = false) => fail(status, { error, expired });

export const actions: Actions = {
	default: async ({ request, url, cookies, fetch }) => {
		const form = await request.formData();
		const code = String(form.get('code') || '').trim();
		const password = String(form.get('password') || '');
		const confirm = String(form.get('confirm') || '');

		if (!code) return failReset(400, 'הקישור לא תקין.', true);
		if (password.length < 6) return failReset(400, 'הסיסמה צריכה להכיל לפחות 6 תווים.');
		if (password !== confirm) return failReset(400, 'שתי הסיסמאות לא זהות. נסו שוב.');

		let jwt: string;
		try {
			jwt = await confirmPasswordReset(code, password, fetch);
		} catch (err) {
			if (err instanceof RecoveryError && err.kind === 'invalid') {
				return failReset(400, 'הקישור כבר נוצל או שפג תוקפו (הוא תקף לשעתיים).', true);
			}
			if (err instanceof RecoveryError && err.kind === 'rate') {
				return failReset(429, 'יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.');
			}
			console.warn('reset-password failed:', err instanceof Error ? err.message : err);
			return failReset(503, 'תקלה זמנית בשרת. נסו שוב בעוד רגע.');
		}

		cookies.set(SHARED_COOKIE, jwt, sharedCookieOptions(url));
		throw redirect(303, `/auth/community-callback?returnTo=${encodeURIComponent(AFTER_RESET)}`);
	}
};
