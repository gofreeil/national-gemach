import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';

export const load: PageServerLoad = async () => {
    // קוראים תמיד מ-Strapi - אין fallback לדמו, כדי שיהיה ברור אם
    // אכן אין גמ"חים, או שיש בעיית חיבור.
    const gemachim = await getAllGemachim();
    return { gemachim };
};
