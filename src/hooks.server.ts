import { handle as authHandle } from './auth';
import { classifyAgent, recordVisit } from '$lib/server/visitStats';
import type { Handle } from '@sveltejs/kit';

/**
 * עוטפים את ה-handle של Auth.js ב-try/catch: אם ה-JWT בעוגייה לא תקין
 * (למשל AUTH_SECRET שונה) @auth/sveltekit עלול לזרוק ולהפיל את כל הדפים.
 * הפתרון: אם זרק — ממשיכים כמשתמש אנונימי.
 */
export const handle: Handle = async ({ event, resolve }) => {
	// ספירת פניות חודשיות לפאנל האדמין: עמודים ציבוריים בלבד.
	// נספרים גם מסמכי HTML (טעינה ראשונה) וגם בקשות data (ניווט צד-לקוח).
	// סורקים (מנועי חיפוש ובוטים של AI) נספרים גם כשהם שולחים Accept: */*
	// ולא text/html — אחרת דווקא הם, שרק המונה הזה רואה, היו נופלים בחוץ.
	const rid = event.route.id;
	if (
		rid &&
		event.request.method === 'GET' &&
		!rid.startsWith('/api') &&
		!rid.startsWith('/admin')
	) {
		const ua = event.request.headers.get('user-agent') ?? '';
		const wantsPage =
			event.isDataRequest || (event.request.headers.get('accept') ?? '').includes('text/html');
		if (wantsPage || classifyAgent(ua)) {
			try { recordVisit(ua); } catch { /* סטטיסטיקה לא מפילה דף */ }
		}
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
