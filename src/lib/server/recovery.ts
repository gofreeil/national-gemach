// שחזור גישה לחשבון מול ה-Strapi המשותף של רשת האתרים (api.gofreeil.com).
// ה-Strapi שולח את המייל; כאן רק מבקשים ממנו, ומוסרים לו את כתובת דף האיפוס
// של האתר הזה כדי שהקישור במייל יחזיר את המשתמש לכאן ולא לאתר אחר ברשת.
import { env } from '$env/dynamic/private';

const STRAPI_URL = (env.STRAPI_URL || 'https://api.gofreeil.com').replace(/\/$/, '');
const TIMEOUT_MS = 8000;

/** העוגייה המשותפת לכל אתרי הרשת (.gofreeil.com) - אחרי איפוס היא מכניסה את המשתמש לכולם. */
export const SHARED_COOKIE = 'gofreeil-auth';

export type RecoveryErrorKind = 'rate' | 'invalid' | 'server';

export class RecoveryError extends Error {
	kind: RecoveryErrorKind;
	constructor(kind: RecoveryErrorKind, message: string = kind) {
		super(message);
		this.kind = kind;
	}
}

async function post(path: string, body: unknown, f: typeof fetch): Promise<Response> {
	try {
		return await f(`${STRAPI_URL}/api/${path}`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(TIMEOUT_MS)
		});
	} catch {
		throw new RecoveryError('server', 'Strapi לא זמין');
	}
}

/**
 * שולח מייל שחזור. תשובת השרת זהה גם כשהאימייל לא רשום (אין דליפת "מי רשום"),
 * ולכן הצלחה כאן אומרת רק "הבקשה התקבלה".
 */
export async function requestPasswordReset(email: string, origin: string, f: typeof fetch = fetch): Promise<void> {
	let res = await post('auth/forgot-password', { email, resetUrl: `${origin}/reset-password` }, f);
	// שרת ישן (לפני התמיכה ב-resetUrl) דוחה שדה לא מוכר ב-400 - מנסים בלעדיו.
	if (res.status === 400) res = await post('auth/forgot-password', { email }, f);
	if (res.status === 429) throw new RecoveryError('rate');
	if (!res.ok) throw new RecoveryError(res.status >= 500 ? 'server' : 'invalid');
}

/** קובע סיסמה חדשה עם הקוד מהמייל ומחזיר JWT - המשתמש נכנס מיד. */
export async function confirmPasswordReset(code: string, password: string, f: typeof fetch = fetch): Promise<string> {
	const res = await post('auth/reset-password', { code, password, passwordConfirmation: password }, f);
	if (res.status === 429) throw new RecoveryError('rate');
	if (res.status >= 500) throw new RecoveryError('server');
	if (!res.ok) throw new RecoveryError('invalid');
	const data = await res.json().catch(() => ({}));
	if (!data?.jwt) throw new RecoveryError('server', 'Strapi לא החזיר JWT');
	return data.jwt as string;
}

/** אפשרויות העוגייה המשותפת. מחוץ ל-gofreeil.com (localhost, תצוגות מקדימות) - עוגייה מקומית בלבד. */
export function sharedCookieOptions(url: URL) {
	const onNetwork = url.hostname === 'gofreeil.com' || url.hostname.endsWith('.gofreeil.com');
	const local = url.hostname === 'localhost' || url.hostname === '127.0.0.1';
	return {
		path: '/',
		httpOnly: true,
		sameSite: 'lax' as const,
		secure: !local,
		maxAge: 60 * 60 * 24 * 90,
		...(onNetwork ? { domain: '.gofreeil.com' } : {})
	};
}
