import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { oauthEnabled } from '../../auth';
import { getStrapiMe, bestStrapiName, friendlyName } from '$lib/server/strapiAuth';

export const load: PageServerLoad = async ({ locals, url, cookies }) => {
	const session = await locals.auth();
	// רק נתיב פנימי — הגנה מ-open-redirect
	const raw = url.searchParams.get('redirect') ?? '/';
	const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	if (session?.user) throw redirect(302, redirectTo);

	// זיהוי מראש דרך העוגייה המשותפת gofreeil-auth (.gofreeil.com): מי שכבר מחובר
	// באתר אחר של יוצאים לחירות רואה "המשך כ-<שם>" בלחיצה אחת. עוגייה מתה או
	// חסרה → null, וכפתור ה-SSO מוצג כאפשרות משנית בלבד (לא כהבטחה שתיכשל).
	let ssoName: string | null = null;
	const sharedJwt = cookies.get('gofreeil-auth');
	if (sharedJwt) {
		try {
			const me = await getStrapiMe(sharedJwt);
			if (me?.email) ssoName = friendlyName(bestStrapiName(me), me.email) || 'חבר הקהילה';
		} catch {
			/* Strapi לא זמין — מציגים את הדף הרגיל */
		}
	}

	return {
		redirectTo,
		ssoName,
		error: url.searchParams.get('error') ?? null,
		// כפתור Google/Facebook מוצג רק אם הספק באמת מוגדר (מפתחות ב-env)
		oauth: oauthEnabled
	};
};
