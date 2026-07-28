import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isOwner } from '$lib/server/admin';

export const load: PageServerLoad = async ({ locals, parent }) => {
	const session = await locals.auth();
	if (!session?.user) throw redirect(302, '/login?redirect=/profile');

	// התפקיד כבר חושב ב-+layout.server (resolveRole) — משתמשים בו ולא קוראים שוב ל-DB.
	// owner הוא בדיקה מקומית מול משתני הסביבה, בלי עלות.
	const { adminRole } = await parent();

	return {
		user: { name: session.user.name ?? '', email: session.user.email ?? '' },
		isOwner: adminRole ? isOwner(session.user) : false
	};
};
