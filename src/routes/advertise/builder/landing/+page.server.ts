import type { PageServerLoad } from './$types';
import { resolveRole } from '$lib/server/admin';

// אותה שערת גישה כמו בבילדר הראשי.
export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.auth();
    const role = await resolveRole(session?.user ?? null);
    return {
        isSuperAdmin: role === 'super_admin',
        layoutUser: session?.user
            ? { email: session.user.email ?? null, name: session.user.name ?? null }
            : null,
    };
};
