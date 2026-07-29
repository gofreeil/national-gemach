import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';

// דף המידע מציג את מצב המאגר בפועל (גמ"חים · ערים · נושאים) ולא מספרים קשיחים.
// תקלה במקור הנתונים לא תפיל את הדף — הטקסט הוא העיקר, והמונים פשוט לא יוצגו.
export const load: PageServerLoad = async () => {
    const [gemachim, categories] = await Promise.all([
        getMergedGemachim().catch(() => []),
        getCategories().catch(() => []),
    ]);

    return {
        gemachCount: gemachim.length,
        cityCount: new Set(gemachim.map((g) => g.city)).size,
        categoryCount: categories.length,
    };
};
