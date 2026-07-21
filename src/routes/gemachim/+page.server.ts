import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { staticGemachim } from '$lib/staticGemachim';

/** 20 גמ"חים בכל עמוד — לפי בקשת המשתמש */
const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
    const [strapiGemachim, categories] = await Promise.all([getAllGemachim(), getCategories()]);

    // אותה לוגיקת מיזוג כמו דף הבית: Strapi + סטטי (בניכוי כפילויות לפי sourceId).
    const importedIds = new Set(strapiGemachim.map(g => g.sourceId).filter(Boolean));
    const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id));
    const all = [...strapiGemachim, ...remainingStatic];

    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(
        Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1),
        pages,
    );
    const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return { items, categories, total, page, pages, pageSize: PAGE_SIZE };
};
