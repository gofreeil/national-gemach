import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getInviteLog, recordInviteDeclined, verifyDeclineToken, type DeclineReason } from '$lib/server/claimInvite';
import { getGemachById } from '$lib/server/db';

// "לא שלי / לא מעוניין" מהודעת ההזמנה — בלי התחברות. האסימון חתום, כך
// שאי אפשר לחסום הזמנות של גמ"ח אחר בניחוש מזהים. הפתיחה עצמה לא רושמת
// כלום (תצוגה-מקדימה של קישור באפליקציית ההודעות "פותחת" אותו) — רק
// לחיצה על אחת משתי הבחירות.
export const load: PageServerLoad = async ({ params }) => {
    const id = verifyDeclineToken(params.token);
    if (!id) return { state: 'invalid' as const };
    const [g, log] = await Promise.all([getGemachById(id), getInviteLog().catch(() => ({}))]);
    const done = (log as Record<string, { declineReason?: DeclineReason }>)[id]?.declineReason;
    return { state: 'ask' as const, id, name: g?.name ?? '', done };
};

export const actions: Actions = {
    default: async ({ params, request }) => {
        const id = verifyDeclineToken(params.token);
        if (!id) return fail(400, { error: 'הקישור אינו תקין' });
        const reason = String((await request.formData()).get('reason'));
        if (reason !== 'not_mine' && reason !== 'opt_out') return fail(400, { error: 'בחרו אחת מהאפשרויות' });
        try {
            await recordInviteDeclined(id, reason);
            return { saved: reason as DeclineReason };
        } catch (e) {
            console.error('[claim-invite] decline failed:', e);
            return fail(502, { error: 'לא הצלחנו לשמור — נסו שוב בעוד רגע' });
        }
    },
};
