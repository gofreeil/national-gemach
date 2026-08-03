import type { PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { getMonthlyVisitorStats, getYearlyInsights } from '$lib/server/visitorStats';
import { getMergedGemachim } from '$lib/server/gemachSource';

// דף הסטטיסטיקה המלא — פתוח לכל אדמין. הנתונים מ-GA עם מטמון של שעה:
// גרף חודשי + הגמ"חים הנצפים ביותר, ערי הגולשים, מכשירים ומקורות תנועה.
export const load: PageServerLoad = async ({ locals }) => {
	await getAdminContext(locals);

	const [monthly, insights, all] = await Promise.all([
		getMonthlyVisitorStats(),
		getYearlyInsights(),
		getMergedGemachim().catch(() => [])
	]);

	// נתיבי /gemach/{id} → גמ"חים: איחוד כפילויות (עם/בלי לוכסן סופי) וסינון
	// נתיבים שאינם דף גמ"ח (add/claim/edit) או גמ"חים שכבר נמחקו.
	const byId = new Map(all.map((g) => [String(g.id), g]));
	const viewsById = new Map<string, number>();
	for (const r of insights?.data.gemachPages ?? []) {
		const m = r.key.match(/^\/gemach\/([^/?#]+)\/?$/);
		if (!m) continue;
		const id = decodeURIComponent(m[1]);
		if (!byId.has(id)) continue;
		viewsById.set(id, (viewsById.get(id) ?? 0) + r.count);
	}
	const topGemachim = [...viewsById.entries()]
		.sort((a, b) => b[1] - a[1])
		.slice(0, 10)
		.map(([id, count]) => {
			const g = byId.get(id)!;
			return { id, name: g.name, icon: g.icon || '🤝', city: g.city ?? '', count };
		});

	return {
		// null = GA לא זמין (לא מוגדר / נכשל ואין מטמון); [] = מוגדר אך אין עדיין נתונים
		months: monthly?.rows ?? null,
		updatedAt: monthly?.updatedAt ?? null,
		insightsAvailable: insights !== null,
		topGemachim,
		cities: insights?.data.cities ?? [],
		devices: insights?.data.devices ?? [],
		channels: insights?.data.channels ?? []
	};
};
