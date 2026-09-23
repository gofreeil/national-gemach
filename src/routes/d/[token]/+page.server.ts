import type { PageServerLoad } from './$types';
import { recordInviteDeclined, verifyDeclineToken } from '$lib/server/claimInvite';

// "לא שלי / לא מעוניין" מהודעת ההזמנה — בלי התחברות. האסימון חתום, כך
// שאי אפשר לחסום הזמנות של גמ"ח אחר בניחוש מזהים.
export const load: PageServerLoad = async ({ params }) => {
    const id = verifyDeclineToken(params.token);
    if (!id) return { state: 'invalid' as const };
    try {
        await recordInviteDeclined(id);
        return { state: 'ok' as const, id };
    } catch (e) {
        console.error('[claim-invite] decline failed:', e);
        return { state: 'error' as const };
    }
};
