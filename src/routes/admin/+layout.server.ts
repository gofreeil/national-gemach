import type { LayoutServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';

// שומר על כל המסלולים תחת /admin — רק אדמין/סופר-אדמין נכנס.
// getAdminContext זורק redirect ל-login אם לא מחובר, או 403 אם מחובר ואינו מורשה.
export const load: LayoutServerLoad = async ({ locals }) => {
	const { user, role } = await getAdminContext(locals);
	return { admin: { user, role } };
};
