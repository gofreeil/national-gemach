import type { PageServerLoad } from './$types';
import { getPublicCategories } from '$lib/server/adminStore';
import { getMergedGemachim, toListItem } from '$lib/server/gemachSource';
import { getPinnedGemachim } from '$lib/server/pinned';

export const load: PageServerLoad = async () => {
    const [gemachim, categories] = await Promise.all([getMergedGemachim(), getPublicCategories()]);
    const pinned = await getPinnedGemachim(gemachim);
    // הרשימות נשלחות בלי טלפונים — הכרטיסים לא מציגים אותם, והחשיפה
    // היא רק בעמוד הגמ"ח אחרי "גלה טלפון"
    return {
        gemachim: gemachim.map(toListItem),
        categories,
        pinned: pinned.map(toListItem),
    };
};
