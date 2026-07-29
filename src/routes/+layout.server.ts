import type { LayoutServerLoad } from './$types';
import { env } from '$env/dynamic/private';
import { resolveRole } from '$lib/server/admin';
import { getVisitorCount } from '$lib/server/visitorStats';

// חושף את הסשן (אם יש) לכל הדפים — כדי שההאדר יציג מצב מחובר/כפתור התחברות,
// את תפקיד הניהול (adminRole) לפאנל שבאזור האישי ולתפריט האדמין שעל הכרטיסים,
// את מונה הגולשים (מ-config, מטמון — בלי קריאה ל-GA), ואת מזהה ה-GA להטענת gtag.
export const load: LayoutServerLoad = async ({ locals }) => {
	const session = await locals.auth();
	const u = session?.user;

	// מונה הגולשים ומזהה GA — משותפים לכל המשתמשים (כולל אנונימיים)
	const [visitors] = await Promise.all([getVisitorCount()]);
	const gaId = (env.GA_MEASUREMENT_ID ?? '').trim();

	if (!u) return { user: null, adminRole: null, visitors, gaId };

	const adminRole = await resolveRole({
		email: u.email,
		name: u.name,
		phone: (u as { phone?: string }).phone
	});

	return {
		user: { id: u.id, name: u.name ?? '', email: u.email ?? '' },
		adminRole,
		visitors,
		gaId
	};
};
