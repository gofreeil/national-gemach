import type { Cookies, Handle } from '@sveltejs/kit';
import { dev } from '$app/environment';
import { SHARED_COOKIE } from './recovery';

// ============================================================
// זיהוי אוטומטי בלי לחיצה: מי שהתחבר/נרשם באחד מאתרי *.gofreeil.com נושא
// את העוגייה המשותפת gofreeil-auth. כשהוא מגיע לאתר הזה בלי סשן מקומי,
// ההפניה היחידה ל-/sso-adopt מקימה לו סשן דרך הספק gofreeil-sso — בלי
// מסך התחברות, בלי כפתור "המשך כ-…".
//
// כניסה אוטומטית מחייבת גם יציאה אמיתית: בלי מחיקת העוגייה המשותפת
// בהתנתקות, המשתמש היה נכנס מחדש מיד. לכן ההתנתקות (POST /auth/signout)
// מוחקת גם אותה, והאתרים האחרים מתנתקים בביקור הבא (ראו sharedSession.ts).
//
// sso_adopt_tried (שעה) מונעת לולאה כשהעוגייה מתה או Strapi לא זמין.
// ============================================================

const TRIED_COOKIE = 'sso_adopt_tried';
// עוגיית הסשן של Auth.js (גם __Secure-, וגם כשהיא מפוצלת ל-.0/.1)
const SESSION_COOKIE = /(?:^|;\s*)[^=;\s]*session-token[^=;]*=/;
// נתיבי התחברות/אימות/API — לעולם לא מפנים מהם (ולא מפרקים את התהליך עצמו)
const SKIP_PATH =
	/^\/(?:api|auth|login|register|logout|reset-password|forgot-password|sso|sso-adopt|banned)(?:\/|$)/;

function clearSharedCookie(cookies: Cookies, hostname: string): void {
	cookies.delete(SHARED_COOKIE, { path: '/' });
	if (hostname === 'gofreeil.com' || hostname.endsWith('.gofreeil.com')) {
		cookies.delete(SHARED_COOKIE, { path: '/', domain: '.gofreeil.com' });
	}
}

export const ssoAutoAdopt: Handle = async ({ event, resolve }) => {
	const { request, url, cookies } = event;

	// התנתקות כאן = התנתקות בכל הרשת
	if (request.method === 'POST' && url.pathname === '/auth/signout') {
		clearSharedCookie(cookies, url.hostname);
		cookies.delete(TRIED_COOKIE, { path: '/' });
		return resolve(event);
	}

	// רק ניווט HTML רגיל (לא תמונות/API/בקשות נתונים של הקליינט)
	if (request.method !== 'GET' || !(request.headers.get('accept') ?? '').includes('text/html')) {
		return resolve(event);
	}
	if (SKIP_PATH.test(url.pathname)) return resolve(event);
	if (!cookies.get(SHARED_COOKIE) || cookies.get(TRIED_COOKIE)) return resolve(event);
	// כבר יש סשן מקומי — אין מה לאמץ
	if (SESSION_COOKIE.test(request.headers.get('cookie') ?? '')) return resolve(event);

	cookies.set(TRIED_COOKIE, '1', {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: !dev,
		maxAge: 60 * 60
	});
	return new Response(null, {
		status: 302,
		headers: { location: `/sso-adopt?redirect=${encodeURIComponent(url.pathname + url.search)}` }
	});
};
