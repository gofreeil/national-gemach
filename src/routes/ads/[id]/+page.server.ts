import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAd } from '$lib/server/adsStore';

// דף הנחיתה הציבורי של פרסומת מאושרת (נבנה בבילדר /advertise/builder).
export const load: PageServerLoad = async ({ params, setHeaders }) => {
    const ad = await getAd(params.id);
    if (!ad || ad.status !== 'approved' || (ad.expiresAt && Date.parse(ad.expiresAt) < Date.now())) {
        throw error(404, 'הפרסומת לא נמצאה');
    }
    setHeaders({ 'cache-control': 'public, s-maxage=60, stale-while-revalidate=600' });
    return { ad };
};
