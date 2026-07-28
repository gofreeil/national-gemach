import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { resolveRole } from '$lib/server/admin';
import { setGemachStatus, setGemachVerified, deleteGemach, getGemachById } from '$lib/server/db';

// פעולות תפריט הניהול המהיר שמופיע על כל גמ"ח באתר (כרטיסים + דף הגמ"ח)
// כשהגולש הוא אדמין: פרסום/החזרה לטיוטה, חותמת "מאושר" ומחיקה — בלי
// להיכנס לפאנל. עריכה היא קישור רגיל ל-/admin/gemachim/[id].
const ACTIONS = new Set(['publish', 'draft', 'verify', 'unverify', 'delete']);

export const POST: RequestHandler = async ({ params, request, locals }) => {
    const session = await locals.auth();
    const role = await resolveRole(session?.user);
    if (!role) throw error(403, 'פעולה זו מותרת לאדמין בלבד');

    let payload: { action?: string };
    try {
        payload = await request.json();
    } catch {
        throw error(400, 'גוף הבקשה חייב להיות JSON תקין');
    }
    const action = payload.action ?? '';
    if (!ACTIONS.has(action)) throw error(400, `פעולה לא מוכרת: ${action}`);

    // רק פריטים מנוהלים ב-Strapi ניתנים לפעולה — לפריט סטטי אין את מי לעדכן
    const gemach = await getGemachById(params.id);
    if (!gemach) throw error(404, 'הגמ"ח לא נמצא (ייתכן שאינו מנוהל ב-DB)');

    const actor = session?.user?.email || session?.user?.name || 'admin';

    try {
        switch (action) {
            case 'publish':
                await setGemachStatus(params.id, 'active', {
                    approved_at: new Date().toISOString(),
                    approved_by: actor,
                    rejection_reason: '',
                });
                break;
            case 'draft':
                await setGemachStatus(params.id, 'draft', {
                    drafted_at: new Date().toISOString(),
                    drafted_by: actor,
                });
                break;
            case 'verify':
                await setGemachVerified(params.id, true);
                break;
            case 'unverify':
                await setGemachVerified(params.id, false);
                break;
            case 'delete':
                await deleteGemach(params.id);
                break;
        }
    } catch (e) {
        console.error(`[admin-menu] ${action} failed for ${params.id}:`, e);
        throw error(502, 'הפעולה נכשלה — נסו שוב בעוד רגע');
    }

    return json({ ok: true, id: params.id, action });
};
