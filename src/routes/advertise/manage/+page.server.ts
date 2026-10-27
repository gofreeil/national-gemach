import { redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getOwnerAssets } from '$lib/server/ownerAssets';
import { resolveRole } from '$lib/server/admin';
import { myAdsAdminActions } from '$lib/server/myAdsActions';

// "הנכסים שלי" — כל מה שהמשתמש המחובר מחזיק באתר: הפרסומות ששלח (עם המדדים
// שלהן) והגמ"חים שרשומים על שמו. הכניסה מחייבת התחברות; השליפה עצמה יושבת
// ב-ownerAssets, כדי שהאזור האישי (/profile) יציג בדיוק את אותם נכסים.
export const load: PageServerLoad = async ({ locals, url }) => {
    const session = await locals.auth();
    if (!session?.user) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    return {
        user: { name: session.user.name ?? '', email: session.user.email ?? '' },
        // קיצורי הניהול ברשימה — לכל אדמין (אותה הרשאה כמו /admin/ads)
        isAdmin: (await resolveRole(session.user)) !== null,
        ...(await getOwnerAssets(session.user)),
    };
};

// קיצורי הניהול מ"הפרסומות שלי" (approve/reject/pause/resume/unapprove) —
// ההרשאה נבדקת בתוך כל פעולה, ב-myAdsActions
export const actions: Actions = { ...myAdsAdminActions };
