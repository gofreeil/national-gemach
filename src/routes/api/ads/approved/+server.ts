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
    // ומודעה שאושרה במסך האדמין לא הופיעה בטור הימני. מיושר לקאש שבשרת
    // (TTL_MS ב-adsStore), כדי שרענון אחרי אישור יראה את המודעה החדשה.
    setHeaders({ 'cache-control': 'public, s-maxage=15, stale-while-revalidate=15' });
    return json({ ads });
};
