import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';
import { gemachim as fallbackGemachim } from '$lib/gemachData';

export const load: PageServerLoad = async () => {
    const fromStrapi = await getAllGemachim();

    // אם Strapi עדיין לא זמין / ריק — נופל לדמו לוקאלי כדי שהדף לא יישאר ריק.
    // ברגע שיש לפחות גמ"ח אחד אמיתי — מציגים רק את האמיתיים.
    const gemachim = fromStrapi.length > 0 ? fromStrapi : fallbackGemachim;

    return { gemachim, isLive: fromStrapi.length > 0 };
};
