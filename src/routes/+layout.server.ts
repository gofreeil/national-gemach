import type { LayoutServerLoad } from './$types';
import { resolveRole } from '$lib/server/admin';

// חושף את הסשן (אם יש) לכל הדפים — כדי שההאדר יציג מצב מחובר/כפתור התחברות,
// וכן את תפקיד הניהול (adminRole) כדי להציג את הקישור לפאנל למורשים בלבד.
export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const u = session?.user;
	if (!u) return { user: null, adminRole: null };

	const adminRole = await resolveRole({
		email: u.email,
		name: u.name,
		phone: (u as { phone?: string }).phone
	});

	return {
		user: { id: u.id, name: u.name ?? '', email: u.email ?? '' },
		adminRole
	};
};
