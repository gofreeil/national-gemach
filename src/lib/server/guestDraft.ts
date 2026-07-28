// ============================================================
// guestDraft.ts — "טיוטת אורח": גמ"ח שמילא מבקר שאינו מחובר
//
// הזרימה: /gemach/add נפתח לכולם. אורח שממלא ושולח → הגמ"ח נשמר כטיוטה
// (status 'draft', בלי user_id — מוסתר מהאתר ולא שייך לאיש) עם אסימון אקראי
// ב-extra_fields.guest_claim, ואותו אסימון נשמר בעוגייה בדפדפן. אחרי
// ההתחברות /gemach/claim מצליב עוגייה↔אסימון, רושם את הגמ"ח על שם המשתמש
// ומפרסם אותו.
//
// האסימון (ולא מזהה הפריט) הוא מה שמונע אימוץ טיוטה של אחר: המזהה מופיע
// ב-URL אחרי הפרסום, האסימון לעולם לא יוצא מהעוגייה ומ-Strapi.
// ============================================================

import type { Cookies } from '@sveltejs/kit';

const COOKIE = 'ng_gemach_draft';

// 30 יום — מי שנטש באמצע ההתחברות יכול לחזור מאוחר יותר והטיוטה עדיין שלו
const MAX_AGE = 60 * 60 * 24 * 30;

export interface DraftTicket {
	/** documentId של הטיוטה ב-Strapi */
	id: string;
	/** האסימון שמוכיח שהטיוטה נוצרה בדפדפן הזה */
	token: string;
}

/** אסימון אקראי חד-פעמי (128 ביט) */
export function newDraftToken(): string {
	return crypto.randomUUID().replace(/-/g, '');
}

/**
 * שומר את הכרטיס בעוגייה.
 * sameSite=lax הוא קריטי: אחרי התחברות ב-Google/Facebook/SSO הדפדפן חוזר
 * לאתר בניווט GET עליון מדומיין אחר — עוגיית 'strict' לא הייתה נשלחת בו,
 * והטיוטה הייתה הולכת לאיבוד בדיוק ברגע שבו צריך אותה.
 * secure מושאר לברירת המחדל של SvelteKit (true, ו-false ב-http://localhost).
 */
export function setDraftTicket(cookies: Cookies, ticket: DraftTicket): void {
	cookies.set(COOKIE, `${ticket.id}.${ticket.token}`, {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		maxAge: MAX_AGE
	});
}

/** קורא את הכרטיס מהעוגייה (null אם אין/פגום) */
export function readDraftTicket(cookies: Cookies): DraftTicket | null {
	const raw = (cookies.get(COOKIE) ?? '').trim();
	if (!raw) return null;
	const dot = raw.indexOf('.');
	if (dot <= 0) return null;
	const id = raw.slice(0, dot);
	const token = raw.slice(dot + 1);
	return id && token ? { id, token } : null;
}

export function clearDraftTicket(cookies: Cookies): void {
	cookies.delete(COOKIE, { path: '/' });
}
