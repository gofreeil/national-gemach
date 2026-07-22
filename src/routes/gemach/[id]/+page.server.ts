import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { getCategories } from '$lib/server/adminStore';
import { findGemachById, getMergedGemachim } from '$lib/server/gemachSource';

export const load: PageServerLoad = async ({ params }) => {
    const [gemach, categories] = await Promise.all([findGemachById(params.id), getCategories()]);
    if (!gemach) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');

    // "גמ"חים נוספים" — אותה קטגוריה, ואם אין מספיק אז אותה עיר
    const all = await getMergedGemachim();
    const others = all.filter(g => g.id !== gemach.id);
    const related = [
        ...others.filter(g => g.category === gemach.category),
        ...others.filter(g => g.category !== gemach.category && g.city === gemach.city),
    ].slice(0, 6);

    return { gemach, categories, related };
};
