import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPublicCategories } from '$lib/server/adminStore';
import { findGemachById, getMergedGemachim, toListItem, withImageUrls } from '$lib/server/gemachSource';
import { getPinnedIdsResolved } from '$lib/server/pinned';
import { getGemachOwnerId } from '$lib/server/db';
import { isGemachOwner } from '$lib/server/ownership';
import { resolveRole } from '$lib/server/admin';
import { submitClaim, userPendingClaimGemachIds } from '$lib/server/claimsStore';
import { categoryKeys } from '$lib/gemachData';

export const load: PageServerLoad = async ({ params, locals }) => {
    const [gemach, categories] = await Promise.all([findGemachById(params.id), getPublicCategories()]);
    if (!gemach) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');

    // טיוטה גלויה רק לאדמין (שרואה אותה עם באנר "טיוטה") — לכל השאר 404,
    // כאילו הגמ"ח לא קיים, כדי שהחזרה-לטיוטה באמת תוריד אותו מהאוויר.
    if (gemach.status === 'draft') {
        const session = await locals.auth();
        const role = await resolveRole(session?.user);
        if (!role) throw error(404, 'הגמ"ח המבוקש לא נמצא במאגר');
    }

    // "גמ"חים נוספים" — נושא משותף (די באחד מהנושאים), ואם אין מספיק אז אותה עיר
    const all = await getMergedGemachim();
    const pinned = (await getPinnedIdsResolved(all)).includes(gemach.id);
    const others = all.filter(g => g.id !== gemach.id);
    const myKeys = new Set(categoryKeys(gemach));
    const sharesTopic = (g: typeof others[number]) => categoryKeys(g).some(k => myKeys.has(k));
    const related = [
        ...others.filter(sharesTopic),
        ...others.filter(g => !sharesTopic(g) && g.city === gemach.city),
    ].slice(0, 6).map(toListItem);   // בלי טלפונים — כרטיסי "נוספים" לא מציגים אותם

    // כפתור "ערוך" מוצג רק לבעל הגמ"ח המחובר. רק פריטים מנוהלים (Strapi) הם בעלי
    // בעלים; לפריט סטטי אין user_id. שולפים את מזהה-הבעלים בנפרד כדי לא לדלוף מייל.
    // claimable = משתמש מחובר שאינו הבעלים, וגמ"ח שעדיין אינו בבעלות משתמש
    // אמיתי (ריק, או "sheet:" של פריט מיובא, או שהאדמין העלה בלי בעלים) — אז
    // הוא יכול לבקש עליו בעלות. claimPending = כבר שלח בקשה שממתינה לאישור.
    let canEdit = false;
    let claimable = false;
    let claimPending = false;
    if (gemach.managed) {
        const session = await locals.auth();
        if (session?.user) {
            const ownerId = await getGemachOwnerId(gemach.id);
            canEdit = isGemachOwner(session.user, ownerId);
            const oid = (ownerId ?? '').trim();
            const unowned = !oid || oid.startsWith('sheet:');
            if (!canEdit && unowned) {
                const pending = await userPendingClaimGemachIds(session.user);
                claimPending = pending.has(gemach.id);
                claimable = !claimPending;
            }
        }
    }

    // התמונות נשלחות ככתובות endpoint ולא כ-data URI מוטמע — העמוד נטען מיד
    // והתמונות מגיעות בנפרד עם מטמון (ראה withImageUrls ב-gemachSource)
    return { gemach: withImageUrls(gemach), categories, related, canEdit, claimable, claimPending, pinned };
};

export const actions: Actions = {
    // "זה הגמ"ח שלי" — יוצר בקשת בעלות ממתינה לאישור אדמין
    claim: async ({ params, locals }) => {
        const session = await locals.auth();
        if (!session?.user) return fail(401, { claimError: 'צריך להתחבר כדי לבקש בעלות' });
        const gemach = await findGemachById(params.id);
        if (!gemach) return fail(404, { claimError: 'הגמ"ח לא נמצא' });
        try {
            const { created } = await submitClaim({
                gemachId: gemach.id,
                gemachName: gemach.name,
                user: session.user,
            });
            return { claimed: true, already: !created };
        } catch (e) {
            console.error('[gemach] claim failed:', e);
            return fail(502, { claimError: 'שליחת הבקשה נכשלה — נסו שוב' });
        }
    },
};
