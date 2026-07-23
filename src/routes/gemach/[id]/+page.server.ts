import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { findGemachById, getMergedGemachim } from '$lib/server/gemachSource';
import { getGemachOwnerId } from '$lib/server/db';
import { isGemachOwner } from '$lib/server/ownership';

export const load: PageServerLoad = async ({ params, locals }) => {
    const [gemach, categories] = await Promise.all([findGemachById(params.id), getCategories()]);
    if (!gemach) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');

    // "גמ"חים נוספים" — אותה קטגוריה, ואם אין מספיק אז אותה עיר
    const all = await getMergedGemachim();
    const others = all.filter(g => g.id !== gemach.id);
    const related = [
        ...others.filter(g => g.category === gemach.category),
        ...others.filter(g => g.category !== gemach.category && g.city === gemach.city),
    ].slice(0, 6);

    // כפתור "ערוך" מוצג רק לבעל הגמ"ח המחובר. רק פריטים מנוהלים (Strapi) הם בעלי
    // בעלים; לפריט סטטי אין user_id. שולפים את מזהה-הבעלים בנפרד כדי לא לדלוף מייל.
    let canEdit = false;
    if (gemach.managed) {
        const session = await locals.auth();
        if (session?.user) {
            const ownerId = await getGemachOwnerId(gemach.id);
            canEdit = isGemachOwner(session.user, ownerId);
        }
    }

    return { gemach, categories, related, canEdit };
};
