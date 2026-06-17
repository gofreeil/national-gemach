import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';
import { staticGemachim } from '$lib/staticGemachim';

export const load: PageServerLoad = async () => {
    const strapiGemachim = await getAllGemachim();
    const gemachim = [...strapiGemachim, ...staticGemachim];
    return { gemachim };
};
