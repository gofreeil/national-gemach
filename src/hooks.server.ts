import { handle as authHandle } from './auth';
import { classifyAgent, recordVisit } from '$lib/server/visitStats';
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle } from '@sveltejs/kit';

// נתיבי סריקה של בוטים (וורדפרס/PHP/קבצי סודות) — לאתר הזה אין אף אחד מהם. בלי הקיצור כל
// ניסיון כזה מרנדר את דף ה-404 המלא (כולל ה-layout) ועולה זמן CPU; עונים בשורה אחת, ו-s-maxage
// נותן ל-CDN של Vercel לזכור את התשובה כך שחזרה על אותו נתיב לא מגיעה לפונקציה.
const JUNK_PATH =
	/\.(?:php\d*|aspx?|jsp|cgi)$|^\/(?:wp-[^/]*|wordpress|phpmyadmin|cgi-bin|\.env[^/]*|\.git|\.aws|\.ssh)(?:\/|$)/i;

// עוגיית הסשן של Auth.js (גם בגרסה המאובטחת __Secure-, וגם כשהיא מפוצלת ל-.0/.1)
const SESSION_COOKIE = /(?:^|;\s*)[^=;\s]*session-token[^=;]*=/;

/**
 * מבקר בלי עוגיית סשן הוא אנונימי בהכרח, ו-Auth.js היה מחזיר לו null בכל מקרה — אבל רק אחרי
 * שבנה את כל ההגדרות מחדש (וזה קורה בכל בקשה, גם של בוטים). בלי עוגייה — null מיד.
 * רץ אחרי authHandle, כך שנתיבי /auth/* (התחברות) ממשיכים להיות מטופלים כרגיל.
 */
const skipAuthWhenAnonymous: Handle = async ({ event, resolve }) => {
	if (!SESSION_COOKIE.test(event.request.headers.get('cookie') ?? '')) {
		event.locals.auth = async () => null;
	}
	return resolve(event);
};

/**
 * נתיב תמונות הפרסומות - ציבורי לחלוטין ולא תלוי-משתמש, ולכן עוקף את
 * שרשרת ה-auth: @auth/sveltekit מוסיף Set-Cookie לכל תשובה, ו-Vercel לעולם
 * לא שומר בקאש הקצה תשובה שנושאת עוגייה. בלי העקיפה ה-CDN היה מחזיר MISS
 * בכל בקשת תמונה, והבייטים היו יוצאים מה-origin מחדש בכל פעם - כלומר כל
 * התועלת שבמעבר לכתובות הייתה אובדת (נמדד ואומת באתר "קהילה בשכונה").
 */
const PUBLIC_IMAGE_PATH = /^\/api\/ad-image\/[^/]+\/[^/]+$/;

/**
 * עוטפים את ה-handle של Auth.js ב-try/catch: אם ה-JWT בעוגייה לא תקין
 * (למשל AUTH_SECRET שונה) @auth/sveltekit עלול לזרוק ולהפיל את כל הדפים.
 * הפתרון: אם זרק — ממשיכים כמשתמש אנונימי.
 */
export const handle: Handle = async ({ event, resolve }) => {
	if (event.request.method === 'GET' && JUNK_PATH.test(event.url.pathname)) {
		return new Response('Not found', {
			status: 404,
			headers: {
				'content-type': 'text/plain; charset=utf-8',
				'cache-control': 'public, s-maxage=86400'
			}
		});
	}
	if (PUBLIC_IMAGE_PATH.test(event.url.pathname)) {
		event.locals.auth = async () => null;
		return await resolve(event);
	}

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
		return await sequence(authHandle, skipAuthWhenAnonymous)({ event, resolve });
	} catch (err) {
		console.warn('[hooks] auth handle threw - continuing anonymously:', err);
		if (!event.locals.auth) {
			event.locals.auth = async () => null;
		}
		return await resolve(event);
	}
};
