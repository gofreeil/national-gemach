import { error, fail } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { getPublicCategories } from '$lib/server/adminStore';
import { findGemachById, getMergedGemachim, toListItem, withImageUrls } from '$lib/server/gemachSource';
import { getPinnedIdsResolved } from '$lib/server/pinned';
import { getGemachOwnerId } from '$lib/server/db';
import { isGemachOwner, isClaimMatch, ownerIdForSession, type ClaimMatchUser } from '$lib/server/ownership';
import { resolveRole } from '$lib/server/admin';
import { submitClaim, userPendingClaimGemachIds } from '$lib/server/claimsStore';
import { getFastClaimState, requestOwnerCode, verifyOwnerCode } from '$lib/server/ownerOtp';
import { getVerifiedPhone } from '$lib/server/userPhone';
import { categoryKeys } from '$lib/gemachData';

/** המשתמש מהסשן + הנייד המאומת שלו (משתמשי Google מגיעים בלי טלפון בסשן,
 *  אבל ייתכן שאימתו נייד בפרופיל) — כך isClaimMatch מזהה גם אותם. */
async function userWithPhone(user: unknown): Promise<ClaimMatchUser> {
    const u = user as ClaimMatchUser;
    const phone = await getVerifiedPhone(u);
    return { ...u, phone };
}

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
    // claimable = משתמש מחובר שאינו הבעלים, גמ"ח שעדיין אינו בבעלות משתמש
    // אמיתי (ריק, או "sheet:" של פריט מיובא, או שהאדמין העלה בלי בעלים),
    // **ופרטי המשתמש תואמים לפרטי הגמ"ח** (טלפון/מייל/שם — isClaimMatch) —
    // לא כל מחובר רואה את ההצעה. claimPending = כבר שלח בקשה שממתינה לאישור.
    let canEdit = false;
    let claimable = false;
    let claimPending = false;
    // המסלול המהיר: כל גמ"ח ללא בעלים שיש בו נייד תקין מקבל אימות בקוד
    // SMS לטלפון של הגמ"ח — בעלות מיידית בלי אישור אדמין. גמ"ח בלי נייד
    // (או כש-SMS לא מוגדר) נשאר בזרימת התביעה הרגילה (fastClaim=false).
    let fastClaim = false;
    let fastPhoneTail = '';
    if (gemach.managed) {
        const session = await locals.auth();
        if (session?.user) {
            const ownerId = await getGemachOwnerId(gemach.id);
            canEdit = isGemachOwner(session.user, ownerId);
            const oid = (ownerId ?? '').trim();
            const unowned = !oid || oid.startsWith('sheet:');
            if (!canEdit && unowned && isClaimMatch(await userWithPhone(session.user), gemach)) {
                const pending = await userPendingClaimGemachIds(session.user);
                claimPending = pending.has(gemach.id);
                claimable = !claimPending;
                if (claimable) {
                    const fast = await getFastClaimState(gemach.id);
                    fastClaim = fast.available;
                    fastPhoneTail = fast.phoneTail;
                }
            }
        }
    }

    // התמונות נשלחות ככתובות endpoint ולא כ-data URI מוטמע — העמוד נטען מיד
    // והתמונות מגיעות בנפרד עם מטמון (ראה withImageUrls ב-gemachSource)
    return { gemach: withImageUrls(gemach), categories, related, canEdit, claimable, claimPending, fastClaim, fastPhoneTail, pinned };
};

export const actions: Actions = {
    // "זה הגמ"ח שלי" — יוצר בקשת בעלות ממתינה לאישור אדמין
    claim: async ({ params, locals }) => {
        const session = await locals.auth();
        if (!session?.user) return fail(401, { claimError: 'צריך להתחבר כדי לבקש בעלות' });
        const gemach = await findGemachById(params.id);
        if (!gemach) return fail(404, { claimError: 'הגמ"ח לא נמצא' });
        // אכיפה שרתית של אותם תנאים שמציגים את ההצעה — גמ"ח ללא בעלים אמיתי
        // ופרטי משתמש תואמים; אחרת אפשר היה לשלוח בקשה ב-POST ישיר.
        const ownerId = await getGemachOwnerId(gemach.id);
        const oid = (ownerId ?? '').trim();
        if (oid && !oid.startsWith('sheet:'))
            return fail(403, { claimError: 'לגמ"ח הזה כבר יש בעלים' });
        const claimUser = await userWithPhone(session.user);
        if (!isClaimMatch(claimUser, gemach))
            return fail(403, { claimError: 'הפרטים בחשבון שלך לא תואמים לפרטי הגמ"ח' });
        try {
            const { created } = await submitClaim({
                gemachId: gemach.id,
                gemachName: gemach.name,
                user: { ...session.user, phone: claimUser.phone },
            });
            return { claimed: true, already: !created };
        } catch (e) {
            console.error('[gemach] claim failed:', e);
            return fail(502, { claimError: 'שליחת הבקשה נכשלה — נסו שוב' });
        }
    },

    // המסלול המהיר: שליחת קוד אימות לטלפון של הגמ"ח (כל גמ"ח ללא בעלים עם נייד)
    claimCode: async ({ params, locals }) => {
        const session = await locals.auth();
        if (!session?.user) return fail(401, { claimError: 'צריך להתחבר כדי לאמת בעלות' });
        const gemach = await findGemachById(params.id);
        if (!gemach) return fail(404, { claimError: 'הגמ"ח לא נמצא' });
        // אותו שער כמו התביעה הרגילה — ההצעה מוצגת רק כשהפרטים תואמים
        if (!isClaimMatch(await userWithPhone(session.user), gemach))
            return fail(403, { claimError: 'הפרטים בחשבון שלך לא תואמים לפרטי הגמ"ח' });
        try {
            const r = await requestOwnerCode(params.id);
            if (!r.ok) return fail(400, { fastError: r.error });
            return { codeSent: true };
        } catch (e) {
            console.error('[gemach] claimCode failed:', e);
            return fail(502, { fastError: 'שליחת הקוד נכשלה — נסו שוב' });
        }
    },

    // אימות הקוד → העברת בעלות מיידית (בלי אישור אדמין)
    claimVerify: async ({ params, request, locals }) => {
        const session = await locals.auth();
        if (!session?.user) return fail(401, { claimError: 'צריך להתחבר כדי לאמת בעלות' });
        const code = ((await request.formData()).get('code') as string) ?? '';
        try {
            const r = await verifyOwnerCode(params.id, code, ownerIdForSession(session.user));
            if (!r.ok) return fail(400, { fastError: r.error, codeSent: true });
            return { verified: true };
        } catch (e) {
            console.error('[gemach] claimVerify failed:', e);
            return fail(502, { fastError: 'האימות נכשל — נסו שוב', codeSent: true });
        }
    },
};
