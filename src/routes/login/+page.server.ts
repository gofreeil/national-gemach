import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { oauthEnabled } from '../../auth';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	// רק נתיב פנימי — הגנה מ-open-redirect
	const raw = url.searchParams.get('redirect') ?? '/';
	const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	if (session?.user) throw redirect(302, redirectTo);
	return {
		redirectTo,
		error: url.searchParams.get('error') ?? null,
		// כפתור Google/Facebook מוצג רק אם הספק באמת מוגדר (מפתחות ב-env)
		oauth: oauthEnabled
	};
};
