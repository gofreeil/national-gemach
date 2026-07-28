import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { claimGuestDraft, getGuestDraft } from '$lib/server/db';
import { ownerIdForSession } from '$lib/server/ownership';
import { readDraftTicket, clearDraftTicket } from '$lib/server/guestDraft';

/**
 * סוף הזרימה של "הוספת גמ"ח בלי התחברות" (ראה guestDraft.ts):
 * המבקר כבר מילא ושלח, הגמ"ח שמור כטיוטה — כאן הוא מתחבר, והטיוטה נרשמת
 * על שמו ומתפרסמת. האימוץ נעשה כאן ב-load ולא בכפתור נוסף, כדי שהחזרה
 * מ-Google/Facebook/SSO תסיים את התהליך מעצמה בלי עוד קליק.
 */
export const load: PageServerLoad = async ({ locals, cookies }) => {
	const ticket = readDraftTicket(cookies);
	if (!ticket) return { state: 'none' as const, draft: null };

	const session = await locals.auth();

	// עוד לא מחובר → מסך "הפרטים נשמרו, נשאר רק להתחבר"
	if (!session?.user) {
		const draft = await getGuestDraft(ticket.id, ticket.token);
		if (!draft) {
			// הטיוטה נמחקה/אומצה כבר — העוגייה מיותמת
			clearDraftTicket(cookies);
			return { state: 'none' as const, draft: null };
		}
		return { state: 'needs-login' as const, draft };
	}

	// מחובר → מאמצים ומפרסמים
	let claimed: boolean;
	try {
		claimed = await claimGuestDraft(ticket.id, ticket.token, ownerIdForSession(session.user));
	} catch (e) {
		// כשל כתיבה זמני — הטיוטה והעוגייה נשארות, אפשר לנסות שוב
		console.error('[guest-claim] claimGuestDraft failed:', e);
		return { state: 'error' as const, draft: null };
	}

	clearDraftTicket(cookies);
	if (!claimed) return { state: 'none' as const, draft: null };

	// flash=created → דף הגמ"ח מציג את אישור הפרסום, כמו ביצירה של משתמש מחובר
	throw redirect(303, `/gemach/${ticket.id}?flash=created`);
};
