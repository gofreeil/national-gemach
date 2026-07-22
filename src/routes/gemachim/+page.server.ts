import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';

/** 20 גמ"חים בכל עמוד — לפי בקשת המשתמש */
const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ url }) => {
    const [all, categories] = await Promise.all([getMergedGemachim(), getCategories()]);

    const total = all.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const page = Math.min(
        Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1),
        pages,
    );
    const items = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

    return { items, categories, total, page, pages, pageSize: PAGE_SIZE };
};
