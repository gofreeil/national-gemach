import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAd, withAdImageUrls } from '$lib/server/adsStore';

// דף הנחיתה הציבורי של פרסומת מאושרת (נבנה בבילדר /advertise/builder).
export const load: PageServerLoad = async ({ params, setHeaders }) => {
    const ad = await getAd(params.id);
    if (!ad || ad.status !== 'approved' || (ad.expiresAt && Date.parse(ad.expiresAt) < Date.now())) {
        throw error(404, 'הפרסומת לא נמצאה');
    }
    setHeaders({ 'cache-control': 'public, s-maxage=60, stale-while-revalidate=600' });
    // התמונות ככתובת ולא מוטבעות: הדף שקל 1.1-1.4MB (97% base64) והוחזר
    // עם X-Vercel-Cache: MISS, כלומר יצא מה-origin בכל צפייה. ראה withAdImageUrls.
    return { ad: withAdImageUrls(ad) };
};
