import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { staticGemachim } from '$lib/staticGemachim';

export const load: PageServerLoad = async () => {
    const [strapiGemachim, categories] = await Promise.all([getAllGemachim(), getCategories()]);

    // גמ"חים סטטיים שכבר יובאו ל-DB מגיעים מ-Strapi — מסננים אותם מהרשימה הסטטית
    // כדי למנוע כפילות (התאמה לפי sourceId ↔ id הסטטי).
    const importedIds = new Set(strapiGemachim.map(g => g.sourceId).filter(Boolean));
    const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id));

    const gemachim = [...strapiGemachim, ...remainingStatic];
    return { gemachim, categories };
};
