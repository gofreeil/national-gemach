import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listPendingAds, listApproved } from '$lib/server/adsStore';
import { getAdminContext } from '$lib/server/admin';

/**
 * חתימה קלה על מצב הפרסומות, לרענון האוטומטי של מסך הניהול.
 *
 * הדף מושך מכאן חתימה של כמה עשרות בייטים כל 30 שניות, ומריץ
 * invalidateAll() (שמושך מחדש את כל הפרסומות) רק כשהיא השתנתה —
 * אחרת טאב אדמין פתוח היה שורף מגה-בייטים כל חצי דקה.
 * שתי הרשימות כאן יושבות ממילא ב-cache של adsStore.
 */
export const GET: RequestHandler = async ({ locals }) => {
    await getAdminContext(locals);

    const [pending, approved] = await Promise.all([listPendingAds(), listApproved()]);
    const newest = pending.reduce((max, a) => (a.submittedAt > max ? a.submittedAt : max), '');

    return json(
        { sig: `${pending.length}|${approved.length}|${newest}` },
        { headers: { 'cache-control': 'no-store' } },
    );
};
