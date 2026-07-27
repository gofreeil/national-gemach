import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';
import { getPinnedGemachim } from '$lib/server/pinned';

export const load: PageServerLoad = async () => {
    const [gemachim, categories] = await Promise.all([getMergedGemachim(), getCategories()]);
    const pinned = await getPinnedGemachim(gemachim);
    return { gemachim, categories, pinned };
};
