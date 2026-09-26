import { json } from '@sveltejs/kit';
import type { RequestHandler } from '@sveltejs/kit';
import { getMonthlyVisitorStats } from '$lib/server/visitorStats';

// סך הצפיות בדפי האתר (GA, מטמון שעה) — לתיבת "פרסמו מוצר" שמוצגת אחרי
// הוספת גמ"ח. נשלף בדפדפן ולא בטעינת הדף, כדי ש-GA איטי לא יעכב אותו.
export const GET: RequestHandler = async () => {
	const s = await getMonthlyVisitorStats().catch(() => null);
	const rows = s?.rows ?? [];
	const total = rows.reduce((n, r) => n + r.pageViews, 0);
	return json(total > 0 ? { total, since: rows[0].yearMonth } : null, {
		headers: { 'cache-control': 'public, max-age=600' }
	});
};
