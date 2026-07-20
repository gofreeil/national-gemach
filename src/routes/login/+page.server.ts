import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	// רק נתיב פנימי — הגנה מ-open-redirect
	const raw = url.searchParams.get('redirect') ?? '/';
	const redirectTo = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/';
	if (session?.user) throw redirect(302, redirectTo);
	return { redirectTo, error: url.searchParams.get('error') ?? null };
};
