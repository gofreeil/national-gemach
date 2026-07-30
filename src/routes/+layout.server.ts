import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { resolveRole } from '$lib/server/admin';
import { getPinnedIds } from '$lib/server/adminStore';
import { getVisitorCount } from '$lib/server/visitorStats';
import { listPendingAds } from '$lib/server/adsStore';

// חושף את הסשן (אם יש) לכל הדפים — כדי שההאדר יציג מצב מחובר/כפתור התחברות,
// את תפקיד הניהול (adminRole) לפאנל שבאזור האישי ולתפריט האדמין שעל הכרטיסים,
// את מונה הגולשים (מ-config, מטמון — בלי קריאה ל-GA), ואת מזהה ה-GA להטענת gtag.
export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const u = session?.user;

	// מונה הגולשים ומזהה GA — משותפים לכל המשתמשים (כולל אנונימיים)
	const [visitors] = await Promise.all([getVisitorCount()]);
	const gaId = (env.GA_MEASUREMENT_ID ?? '').trim();

	if (!u) return { user: null, adminRole: null, pinnedIds: null, pendingAds: 0, visitors, gaId };

	const adminRole = await resolveRole({
		email: u.email,
		name: u.name,
		phone: (u as { phone?: string }).phone
	});

	// מזהי הנעוצים — רק לאדמין, כדי שתפריט הניהול שעל הכרטיס ידע להציג "נעץ"
	// או "הסר מהנעוצים". קריאה למטמון של config (20 שנ'), בלי סבב נוסף ל-Strapi.
	// null = הרשימה מעולם לא נשמרה; אז התפריט נופל חזרה לדגל featured, בדיוק
	// כמו getPinnedIdsResolved בשרת.
	// pendingAds — מונה הפרסומות שממתינות לאישור, לנקודה האדומה על כפתור
	// האזור האישי בהאדר. רק לאדמין, ומקאש של דקה (שאילתה רזה בלי תמונות).
	const [pinnedIds, pendingAds] = adminRole
		? await Promise.all([
				getPinnedIds().then((ids) => ids ?? null),
				listPendingAds().then((list) => list.length)
			])
		: [null, 0];

	return {
		user: { id: u.id, name: u.name ?? '', email: u.email ?? '' },
		adminRole,
		pinnedIds,
		pendingAds,
		visitors,
		gaId
	};
};
