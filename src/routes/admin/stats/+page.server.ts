import type { PageServerLoad } from './$types';
import type { Gemach } from '$lib/gemachData';
import { getAdminContext } from '$lib/server/admin';
import { getMonthlyVisitorStats, getYearlyInsights } from '$lib/server/visitorStats';
import { getMergedGemachim } from '$lib/server/gemachSource';

// חודש בפורמט YYYYMM לפי שעון ישראל — כדי שגמ"ח שנוסף בליל ראשון-לחודש
// לא ייספר בחודש הקודם (createdAt נשמר ב-UTC).
const YM_FMT = new Intl.DateTimeFormat('en-CA', {
	timeZone: 'Asia/Jerusalem', year: 'numeric', month: '2-digit'
});
function toYm(date: Date): string {
	return YM_FMT.format(date).replace('-', '');
}

// גידול המאגר: כמה גמ"חים חדשים נוספו בכל אחד מ-12 החודשים האחרונים
// (ישן→חדש, האחרון = החודש הנוכחי). נספרות רק רשומות שנוצרו בטופס/בפאנל;
// ייבוא מהרשימה הסטטית (sourceId) אינו גמ"ח חדש — הוא היה באתר עוד קודם.
function gemachGrowth(all: Gemach[]): { yearMonth: string; added: number }[] {
	const nowYm = toYm(new Date());
	const y = Number(nowYm.slice(0, 4));
	const m = Number(nowYm.slice(4, 6));
	const rows = Array.from({ length: 12 }, (_, i) => {
		const d = new Date(y, m - 12 + i, 1);
		return { yearMonth: `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`, added: 0 };
	});
	const byYm = new Map(rows.map((r) => [r.yearMonth, r]));
	for (const g of all) {
		if (!g.createdAt || g.sourceId) continue;
		const row = byYm.get(toYm(new Date(g.createdAt)));
		if (row) row.added++;
	}
	return rows;
}

// דף הסטטיסטיקה המלא — פתוח לכל אדמין. הנתונים מ-GA עם מטמון של שעה:
// גרף חודשי + גידול המאגר, הגמ"חים הנצפים ביותר, ערי הגולשים, מכשירים ומקורות תנועה.
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
		growth: gemachGrowth(all),
		totalGemachim: all.length,
		cities: insights?.data.cities ?? [],
		devices: insights?.data.devices ?? [],
		channels: insights?.data.channels ?? []
	};
};
