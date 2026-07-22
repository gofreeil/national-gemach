import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';

export const load: PageServerLoad = async () => {
    const [gemachim, categories] = await Promise.all([getMergedGemachim(), getCategories()]);
    return { gemachim, categories };
};
