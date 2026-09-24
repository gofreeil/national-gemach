import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { parseInviteParam, recordInviteEvent, setInviteCookie } from '$lib/server/claimInvite';

// קישור ההזמנה הקצר מה-SMS: מסמן את הדפדפן כמוזמן לגמ"ח הזה ומעביר לכרטיס,
// ששם נפתחת תיבת קבלת הבעלות. קישור חתום (/c/<id>.<sig>) נשלח רק לנייד
// שבכרטיס — הוא עצמו ההוכחה, והבעלות עוברת בלחיצה. ישן (/c/<id>) — אימות בקוד.
export const GET: RequestHandler = async ({ params, cookies }) => {
    const inv = parseInviteParam(params.id);
    if (!inv) throw redirect(303, '/');
    setInviteCookie(cookies, inv.id, inv.proof);
    await recordInviteEvent(inv.id, 'open');
    throw redirect(303, `/gemach/${inv.id}`);
};
