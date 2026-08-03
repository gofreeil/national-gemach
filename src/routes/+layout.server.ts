import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { resolveRole } from '$lib/server/admin';
import { getPinnedIds } from '$lib/server/adminStore';
import { getVisitorCount, refreshVisitorStatsIfStale } from '$lib/server/visitorStats';
import { listPendingAds } from '$lib/server/adsStore';
import { countPendingClaims } from '$lib/server/claimsStore';

// חושף את הסשן (אם יש) לכל הדפים — כדי שההאדר יציג מצב מחובר/כפתור התחברות,
// את תפקיד הניהול (adminRole) לפאנל שבאזור האישי ולתפריט האדמין שעל הכרטיסים,
// את מונה הגולשים (מ-config, מטמון — בלי קריאה ל-GA), ואת מזהה ה-GA להטענת gtag.
export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const u = session?.user;

	// רענון מונה הגולשים מ-GA — מוגבל ל-15 דק' (חותמת-זמן ב-config), כך שבפועל
	// יש קריאה אחת ל-GA לכל היותר כל רבע שעה, לא משנה כמה גולשים. הבדיקה עצמה
	// זולה (מטמון config, בלי סבב GA). לא חוסם ולא מפיל אם GA לא מוגדר.
	await refreshVisitorStatsIfStale().catch(() => {});
	const visitors = await getVisitorCount();
	const gaId = (env.GA_MEASUREMENT_ID ?? '').trim();

	if (!u) return { user: null, adminRole: null, pinnedIds: null, pendingCount: 0, visitors, gaId };

	const adminRole = await resolveRole({
		email: u.email,
		name: u.name,
		phone: (u as { phone?: string }).phone
	});

	// מזהי הנעוצים — רק לאדמין, כדי שתפריט הניהול שעל הכרטיס ידע להציג "נעץ"
	// או "הסר מהנעוצים". קריאה למטמון של config (20 שנ'), בלי סבב נוסף ל-Strapi.
	// null = הרשימה מעולם לא נשמרה; אז התפריט נופל חזרה לדגל featured, בדיוק
	// כמו getPinnedIdsResolved בשרת.
	// pendingCount — הפריטים שממתינים לטיפול אדמין (פרסומות לאישור + תביעות
	// בעלות), לבועה האדומה על כפתור האזור האישי בהאדר ועל תמונת הפרופיל.
	// טיוטות הגילוי החכם הוחרגו בכוונה — הן לא דחופות; המונה שלהן מוצג רק
	// בשורת התיאור של אריח הגילוי בפאנל.
	// רק לאדמין, וכולו ממטמונים קצרים (דקה) — בלי סבבים כבדים ל-Strapi.
	const [pinnedIds, pendingCount] = adminRole
		? await Promise.all([
				getPinnedIds().then((ids) => ids ?? null),
				Promise.all([
					listPendingAds().then((list) => list.length).catch(() => 0),
					countPendingClaims().catch(() => 0)
				]).then(([ads, claims]) => ads + claims)
			])
		: [null, 0];

	return {
		user: { id: u.id, name: u.name ?? '', email: u.email ?? '' },
		adminRole,
		pinnedIds,
		pendingCount,
		visitors,
		gaId
	};
};
