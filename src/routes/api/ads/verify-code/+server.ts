import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { isOwnerCode } from '$lib/server/adsCode';

// אימות קוד הבעלים בצד השרת — הקוד עצמו לא קיים בקוד הלקוח.
export const POST: RequestHandler = async ({ request }) => {
    let payload: any;
    try {
        payload = await request.json();
    } catch {
        throw error(400, 'גוף הבקשה חייב להיות JSON תקין');
    }
    return json({ ok: isOwnerCode(payload?.code) });
};
