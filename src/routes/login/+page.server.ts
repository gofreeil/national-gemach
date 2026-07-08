import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const session = await locals.auth();
	const redirectTo = url.searchParams.get('redirect') ?? '/';
	if (session?.user) throw redirect(302, redirectTo);
	return { redirectTo, error: url.searchParams.get('error') ?? null };
};
