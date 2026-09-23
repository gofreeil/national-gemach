import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { runGeoJob } from '$lib/server/geoJob';
import type { RequestHandler } from './$types';

// נקרא ע"י Vercel Cron פעם ביום — ראה vercel.json (תוכנית Hobby מתירה רק יומי).
// מציב על המפה גמ"חים חסרי מיקום, ושולח לבעלים בקשת אישור/דיוק (ראה geoJob.ts).
// אבטחה: אם הוגדר CRON_SECRET, נדרש Authorization: Bearer <secret>. גם בלעדיו
// ריצה חוזרת לא מזיקה — כל גמ"ח מקבל לכל היותר בקשה אחת.
export const config = { maxDuration: 60 };

export const GET: RequestHandler = async ({ request }) => {
	const secret = (env.CRON_SECRET ?? '').trim();
	if (secret) {
		const auth = request.headers.get('authorization') ?? '';
		if (auth !== `Bearer ${secret}`) throw error(401, 'unauthorized');
	}
	const result = await runGeoJob({ budgetMs: 40_000 });
	return json({ ok: true, ...result });
};
