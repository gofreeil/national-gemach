import { handle as authHandle } from './auth';
import { recordVisit } from '$lib/server/visitStats';
import type { Handle } from '@sveltejs/kit';

/**
 * עוטפים את ה-handle של Auth.js ב-try/catch: אם ה-JWT בעוגייה לא תקין
 * (למשל AUTH_SECRET שונה) @auth/sveltekit עלול לזרוק ולהפיל את כל הדפים.
 * הפתרון: אם זרק — ממשיכים כמשתמש אנונימי.
 */
export const handle: Handle = async ({ event, resolve }) => {
	// ספירת כניסות חודשיות לפאנל האדמין: עמודים ציבוריים בלבד.
	// נספרים גם מסמכי HTML (טעינה ראשונה) וגם בקשות data (ניווט צד-לקוח).
	const rid = event.route.id;
	if (
		rid &&
		event.request.method === 'GET' &&
		!rid.startsWith('/api') &&
		!rid.startsWith('/admin') &&
		(event.isDataRequest || (event.request.headers.get('accept') ?? '').includes('text/html'))
	) {
		try { recordVisit(); } catch { /* סטטיסטיקה לא מפילה דף */ }
	}

	try {
		return await authHandle({ event, resolve });
	} catch (err) {
		console.warn('[hooks] auth handle threw - continuing anonymously:', err);
		if (!event.locals.auth) {
			event.locals.auth = async () => null;
		}
		return await resolve(event);
	}
};
