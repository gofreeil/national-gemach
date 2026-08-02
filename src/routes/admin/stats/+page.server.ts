import type { PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { getMonthlyVisitorStats } from '$lib/server/visitorStats';

// דף סטטיסטיקה חודשית — פתוח לכל אדמין. הנתונים מ-GA עם מטמון של שעה.
export const load: PageServerLoad = async ({ locals }) => {
	await getAdminContext(locals);
	const monthly = await getMonthlyVisitorStats();
	return {
		// null = GA לא זמין (לא מוגדר / נכשל ואין מטמון); [] = מוגדר אך אין עדיין נתונים
		months: monthly?.rows ?? null,
		updatedAt: monthly?.updatedAt ?? null
	};
};
