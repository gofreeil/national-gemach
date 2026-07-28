import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { findGemachById, getMergedGemachim, toListItem } from '$lib/server/gemachSource';
import { getPinnedIdsResolved } from '$lib/server/pinned';
import { getGemachOwnerId } from '$lib/server/db';
import { isGemachOwner } from '$lib/server/ownership';
import { resolveRole } from '$lib/server/admin';

export const load: PageServerLoad = async ({ params, locals }) => {
    const [gemach, categories] = await Promise.all([findGemachById(params.id), getCategories()]);
    if (!gemach) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');

    // טיוטה גלויה רק לאדמין (שרואה אותה עם באנר "טיוטה") — לכל השאר 404,
    // כאילו הגמ"ח לא קיים, כדי שהחזרה-לטיוטה באמת תוריד אותו מהאוויר.
    if (gemach.status === 'draft') {
        const session = await locals.auth();
        const role = await resolveRole(session?.user);
        if (!role) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');
    }

    // "גמ"חים נוספים" — אותה קטגוריה, ואם אין מספיק אז אותה עיר
    const all = await getMergedGemachim();
    const pinned = (await getPinnedIdsResolved(all)).includes(gemach.id);
    const others = all.filter(g => g.id !== gemach.id);
    const related = [
        ...others.filter(g => g.category === gemach.category),
        ...others.filter(g => g.category !== gemach.category && g.city === gemach.city),
    ].slice(0, 6).map(toListItem);   // בלי טלפונים — כרטיסי "נוספים" לא מציגים אותם

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

    return { gemach, categories, related, canEdit, pinned };
};
