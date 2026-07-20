import { createHash } from 'crypto';

// ה-Strapi המשותף של יוצאים לחירות — רשימת המשתמשים המאוחדת לכל האתרים.
export const STRAPI_URL = 'https://api.gofreeil.com';

export interface StrapiUser {
	id: number;
	username: string;
	email: string;
	phone?: string | null;
	// שדות שם אפשריים — רק אם ה-Strapi המשותף שומר שם אמיתי (לא מובטחים)
	name?: string;
	displayName?: string;
	firstname?: string;
	lastname?: string;
}

/**
 * האם המחרוזת היא מזהה־מכונה של ספק OAuth (google_1164…, facebook_123…) ולא שם אמיתי.
 * ה-Strapi המשותף יוצר למשתמשי OAuth username בצורת "<provider>_<id>" — אסור להציג אותו.
 */
export function isMachineUsername(name: string): boolean {
	return /^[a-z][a-z0-9]*[_-]\d{5,}$/i.test(name.trim());
}

/** בוחר את השם האמיתי הטוב ביותר שקיים על רשומת ה-Strapi (username כברירת מחדל) */
export function bestStrapiName(u: Partial<StrapiUser>): string {
	const full = [u.firstname, u.lastname].filter(Boolean).join(' ').trim();
	return (u.name || u.displayName || full || u.username || '').trim();
}

/**
 * שם תצוגה ידידותי: שם אמיתי אם קיים; אחרת נגזר מהאימייל (החלק שלפני ה-@).
 * לעולם לא מחזיר מזהה־מכונה כמו google_1164… .
 */
export function friendlyName(rawName: string | null | undefined, email: string | null | undefined): string {
	const name = (rawName ?? '').trim();
	if (name && !name.includes('@') && !isMachineUsername(name)) return name;
	const local = (email ?? '').split('@')[0] ?? '';
	if (!local) return '';
	return local
		.split(/[._-]+/)
		.filter(Boolean)
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1))
		.join(' ');
}

/** קריאת ערך עוגייה מתוך כותרת Cookie גולמית */
export function readCookie(cookieHeader: string | null | undefined, name: string): string | null {
	if (!cookieHeader) return null;
	for (const part of cookieHeader.split(';')) {
		const idx = part.indexOf('=');
		if (idx === -1) continue;
		if (part.slice(0, idx).trim() === name) {
			return decodeURIComponent(part.slice(idx + 1).trim());
		}
	}
	return null;
}

/** לוגין מול ה-Strapi המשותף */
export async function strapiLogin(identifier: string, password: string): Promise<{ jwt: string; user: StrapiUser }> {
	const res = await fetch(STRAPI_URL + '/api/auth/local', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ identifier, password })
	});
	if (!res.ok) throw new Error('login failed');
	return res.json();
}

/** הרשמה ל-Strapi המשותף */
export async function strapiRegister(username: string, email: string, password: string): Promise<{ jwt: string; user: StrapiUser }> {
	const res = await fetch(STRAPI_URL + '/api/auth/local/register', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ username, email, password })
	});
	if (!res.ok) {
		const text = await res.text();
		throw new Error('register failed: ' + text);
	}
	return res.json();
}

/** אימות JWT מול ה-Strapi המשותף (משמש את כניסת ה-SSO) */
export async function getStrapiMe(jwt: string): Promise<StrapiUser | null> {
	if (!jwt) return null;
	try {
		const res = await fetch(STRAPI_URL + '/api/users/me', {
			headers: { Authorization: `Bearer ${jwt}` }
		});
		if (!res.ok) return null;
		return (await res.json()) as StrapiUser;
	} catch {
		return null;
	}
}

/**
 * מחזיר JWT של ה-Strapi המשותף למשתמש OAuth (Google/Facebook) — יוצר חשבון
 * דטרמיניסטי לפי stableId, כך שאותו משתמש יזוהה תמיד ברשימה המאוחדת.
 */
export async function getOrCreateStrapiJwt(email: string | null | undefined, stableId: string, secret: string): Promise<string | null> {
	if (!email) return null;
	const password = createHash('sha256').update(stableId + secret).digest('hex').slice(0, 32);
	const username = (email.split('@')[0] || stableId).replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 24) + '_' + stableId.slice(-4);
	try {
		const { jwt } = await strapiLogin(email, password);
		return jwt;
	} catch {
		try {
			const { jwt } = await strapiRegister(username, email, password);
			return jwt;
		} catch {
			return null;
		}
	}
}
