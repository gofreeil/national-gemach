import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { requestPasswordReset, RecoveryError } from '$lib/server/recovery';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** מילוי מראש כשמגיעים מדף ההתחברות עם האימייל שכבר הוקלד שם. */
export const load: PageServerLoad = ({ url, setHeaders }) => {
	setHeaders({ 'cache-control': 'private, no-store' });
	const email = (url.searchParams.get('email') || '').trim().slice(0, 254);
	return { email: EMAIL_RE.test(email) ? email : '' };
};

// מבנה אחיד לכל התשובות - כך הדף קורא sent/error/email בלי ענפים.
const reply = (sent: boolean, email: string, error = '') => ({ sent, email, error, at: sent ? Date.now() : 0 });

export const actions: Actions = {
	send: async ({ request, url, fetch }) => {
		const form = await request.formData();
		const email = String(form.get('email') || '').trim();
		if (!EMAIL_RE.test(email)) {
			return fail(400, reply(false, email, 'כתובת האימייל לא נראית תקינה. בדקו שהקלדתם אותה נכון.'));
		}
		try {
			await requestPasswordReset(email, url.origin, fetch);
		} catch (err) {
			if (err instanceof RecoveryError && err.kind === 'rate') {
				return fail(429, reply(false, email, 'ביקשתם יותר מדי פעמים. נסו שוב בעוד כמה דקות.'));
			}
			console.warn('forgot-password failed:', err instanceof Error ? err.message : err);
			return fail(503, reply(false, email, 'תקלה זמנית בשליחת המייל. נסו שוב בעוד רגע.'));
		}
		return reply(true, email);
	}
};
