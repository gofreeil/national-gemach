import { json, error } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import { refreshVisitorStatsIfStale, getVisitorCount } from '$lib/server/visitorStats';
import type { RequestHandler } from './$types';

// נקרא ע"י Vercel Cron כל 15 דקות — ראה vercel.json.
// קורא את מספר הגולשים מ-GA ושומר ב-config. אם GA לא מוגדר, לא עושה כלום.
// אבטחה: אם הוגדר CRON_SECRET, נדרש Authorization: Bearer <secret>
// (Vercel שולח אותו אוטומטית כשמגדירים את משתנה הסביבה CRON_SECRET).
export const GET: RequestHandler = async ({ request }) => {
	const secret = (env.CRON_SECRET ?? '').trim();
	if (secret) {
		const auth = request.headers.get('authorization') ?? '';
		if (auth !== `Bearer ${secret}`) throw error(401, 'unauthorized');
	}

	await refreshVisitorStatsIfStale(true).catch((e) => {
		console.error('[cron/visitors] refresh failed:', e);
	});

	// מחזיר את הערך שנשמר — כך שפנייה ידנית לכתובת משמשת גם כבדיקת-חיבור:
	// visitors=null → הקריאה ל-GA נכשלה (הרשאה/הגדרה); visitors.count → עובד.
	const visitors = await getVisitorCount();
	return json({ ok: true, visitors });
};
