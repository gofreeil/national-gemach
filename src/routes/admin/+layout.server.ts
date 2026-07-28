import type { LayoutServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { refreshVisitorStatsIfStale } from '$lib/server/visitorStats';

// שומר על כל המסלולים תחת /admin — רק אדמין/סופר-אדמין נכנס.
// getAdminContext זורק redirect ל-login אם לא מחובר, או 403 אם מחובר ואינו מורשה.
export const load: LayoutServerLoad = async ({ locals }) => {
	const { user, role, owner } = await getAdminContext(locals);

	// רענון מונה הגולשים מ-GA — רק כאן (כניסת אדמין) ורק אם עברו ~24 שעות.
	// כך אף גולש רגיל לא יוצר קריאה ל-GA. לא חוסם ולא מפיל אם GA לא מוגדר.
	await refreshVisitorStatsIfStale().catch(() => {});

	return { admin: { user, role, owner } };
};
