import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { listApproved } from '$lib/server/adsStore';

// רשימת המודעות המאושרות לתצוגה הציבורית — הטור הימני בדסקטופ
// ופרסומת-הביניים בנייד טוענים אותה בצד-הלקוח (adSlots.ts).
// endpoint נפרד (ולא ה-layout) כדי שהמודעות יהיו שכבה עצמאית.
export const GET: RequestHandler = async ({ setHeaders }) => {
    const ads = await listApproved();
    setHeaders({ 'cache-control': 'public, s-maxage=120, stale-while-revalidate=600' });
    return json({ ads });
};
