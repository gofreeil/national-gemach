import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getAd, withAdImageUrls } from '$lib/server/adsStore';
import { isAdmin, type SessionUserLike } from '$lib/server/admin';

// דף הנחיתה הציבורי של פרסומת מאושרת (נבנה בבילדר /advertise/builder).
export const load: PageServerLoad = async ({ params, setHeaders, url, locals }) => {
    const ad = await getAd(params.id);
    if (!ad) throw error(404, 'הפרסומת לא נמצאה');

    const live = ad.status === 'approved' && !(ad.expiresAt && Date.parse(ad.expiresAt) < Date.now());
    if (live) {
        setHeaders({ 'cache-control': 'public, s-maxage=60, stale-while-revalidate=600' });
    } else {
        // ?preview=1 — תצוגה מקדימה מתוך מסך הניהול: אדמין רואה גם
        // ממתינה/נדחית/פגה. לציבור הדף הזה לא קיים.
        if (url.searchParams.get('preview') !== '1') throw error(404, 'הפרסומת לא נמצאה');
        const session = await locals.auth();
        const su = session?.user as SessionUserLike | undefined;
        if (!(await isAdmin(su))) throw error(404, 'הפרסומת לא נמצאה');
        setHeaders({ 'cache-control': 'private, no-store' });
    }

    // התמונות ככתובת ולא מוטבעות: הדף שקל 1.1-1.4MB (97% base64) והוחזר
    // עם X-Vercel-Cache: MISS, כלומר יצא מה-origin בכל צפייה. ראה withAdImageUrls.
    return { ad: withAdImageUrls(ad) };
};
