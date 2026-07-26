import type { PageServerLoad } from './$types';
import { resolveRole } from '$lib/server/admin';

// הבילדר נפתח למי ששילם (localStorage בצד הלקוח) או לאדמין של האתר
// (אדמין/סופר-אדמין — בדיקת שרת): אדמין מפרסם כאן בלי דף התשלום.
export const load: PageServerLoad = async ({ locals }) => {
    const session = await locals.auth();
    const role = await resolveRole(session?.user ?? null);
    return {
        isAdmin: role !== null,
        layoutUser: session?.user
            ? { email: session.user.email ?? null, name: session.user.name ?? null }
            : null,
    };
};
