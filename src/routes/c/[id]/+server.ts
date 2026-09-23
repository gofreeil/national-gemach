import { redirect } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isGemachDocId, setInviteCookie } from '$lib/server/claimInvite';

// קישור ההזמנה הקצר מה-SMS: מסמן את הדפדפן כמוזמן לגמ"ח הזה ומעביר לכרטיס,
// ששם נפתחת תיבת קבלת הבעלות (אימות בקוד לנייד שבכרטיס).
export const GET: RequestHandler = ({ params, cookies }) => {
    if (!isGemachDocId(params.id)) throw redirect(303, '/');
    setInviteCookie(cookies, params.id);
    throw redirect(303, `/gemach/${params.id}`);
};
