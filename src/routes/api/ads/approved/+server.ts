import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listApproved } from '$lib/server/adsStore';

// רשימת המודעות המאושרות לתצוגה הציבורית — הטור הימני בדסקטופ
// ופרסומת-הביניים בנייד טוענים אותה בצד-הלקוח (adSlots.ts).
// endpoint נפרד (ולא ה-layout) כדי שהמודעות יהיו שכבה עצמאית.
export const GET: RequestHandler = async ({ setHeaders }) => {
    const ads = await listApproved();
    // קאש קצר בלבד: s-maxage גדול + stale-while-revalidate ארוך גרמו לכך
    // שתשובת "אין מודעות" שנשמרה לפני האישור הוגשה עוד דקות ארוכות אחריו,
    // ומודעה שאושרה במסך האדמין לא הופיעה בטור הימני.
    setHeaders({ 'cache-control': 'public, s-maxage=60, stale-while-revalidate=60' });
    return json({ ads });
};
