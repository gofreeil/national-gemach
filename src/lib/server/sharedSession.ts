import type { Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SHARED_COOKIE, sharedCookieOptions } from './recovery';

// ============================================================
// נרשם/התחבר פעם אחת → מזוהה בכל אתרי הרשת באותו מכשיר.
//
// Auth.js שומר את הסשן בעוגייה מקומית של האתר בלבד. כדי ששאר אתרי
// *.gofreeil.com יזהו את המשתמש, ה-JWT של Strapi שבסשן נכתב גם לעוגייה
// המשותפת gofreeil-auth (על .gofreeil.com) — בבקשה הראשונה אחרי התחברות
// רגילה / הרשמה / Google.
//
// עוגיית סימון host-only (SHARED_MARK) זוכרת "הסשן הזה משותף עם הרשת".
// סימון קיים + עוגייה משותפת נעלמה = המשתמש התנתק באתר אחר → מתנתקים גם
// כאן, ולא מחזירים את העוגייה בכוח (אחרת התנתקות ברשת לא הייתה אפשרית).
// ============================================================

export const SHARED_MARK = 'gf-shared';

const YEAR = 60 * 60 * 24 * 365;
const SESSION_NAME = /session-token/;

const markOptions = {
	path: '/',
	httpOnly: true,
	secure: !dev,
	sameSite: 'lax' as const,
	maxAge: YEAR
};

/** רץ אחרי ה-handle של Auth.js (צריך את locals.auth). */
export const shareSessionHandle: Handle = async ({ event, resolve }) => {
	// רק טעינות דף (HTML) — לא תמונות/API שנשמרים ב-CDN ואסור שיישאו Set-Cookie
	if (!(event.request.headers.get('accept') ?? '').includes('text/html')) return resolve(event);
	const { cookies } = event;
	const sessionCookies = cookies.getAll().filter((c) => SESSION_NAME.test(c.name));
	const shared = cookies.get(SHARED_COOKIE);
	const mark = cookies.get(SHARED_MARK);

	if (!sessionCookies.length) {
		// אין סשן מקומי — סימון ישן (מלפני התנתקות) לא רלוונטי יותר
		if (mark) cookies.delete(SHARED_MARK, { path: '/' });
		return resolve(event);
	}

	if (shared) {
		if (!mark) cookies.set(SHARED_MARK, '1', markOptions);
		return resolve(event);
	}

	if (mark) {
		// התנתקות באתר אחר ברשת → מתנתקים גם כאן
		for (const c of sessionCookies) cookies.delete(c.name, { path: '/' });
		cookies.delete(SHARED_MARK, { path: '/' });
		if (cookies.get('strapi_jwt')) cookies.delete('strapi_jwt', { path: '/' });
		event.locals.auth = async () => null;
		return resolve(event);
	}

	// מחובר רק כאן → משתפים עם שאר הרשת
	try {
		const session = await event.locals.auth();
		const jwt = (session?.user as { strapiJwt?: string } | undefined)?.strapiJwt;
		if (jwt) {
			cookies.set(SHARED_COOKIE, jwt, sharedCookieOptions(event.url));
			cookies.set(SHARED_MARK, '1', markOptions);
		}
	} catch {
		/* סשן לא קריא — ממשיכים בלי שיתוף */
	}
	return resolve(event);
};
