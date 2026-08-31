import { fail, redirect } from '@sveltejs/kit';
import type { PageServerLoad, Actions } from './$types';
import { isOwner } from '$lib/server/admin';
import { getVerifiedPhone, requestPhoneCode, verifyPhoneCode } from '$lib/server/userPhone';
import { smsEnabled } from '$lib/server/sms';
import { getOwnerAssets } from '$lib/server/ownerAssets';
import { listApproved, listPendingAdsPreview } from '$lib/server/adsStore';
import { findClaimableByPhone, countPendingClaims } from '$lib/server/claimsStore';
import { getMonthlyVisitorStats } from '$lib/server/visitorStats';
import { getAllGemachimWithDrafts, countGemachAttention } from '$lib/server/db';
import { getMergedGemachim } from '$lib/server/gemachSource';
import { getPinnedGemachim } from '$lib/server/pinned';
import { getAdmins, getPublicCategories } from '$lib/server/adminStore';
import { hasValidCoords } from '$lib/server/geocode';

/**
 * מוני האריחים בפאנל הניהול — "כמה נתונים יש" בכל מסך. המספר מוצג בתוך
 * שורת התיאור של האריח (באותו פונט וצבע), ולא כהתראה.
 * הכול נשען על מטמונים קיימים (רשימת הגמ"חים 60 שנ', config 20 שנ',
 * פרסומות 15-60 שנ') — אין כאן סבב Strapi חדש מעבר למה שהדף ממילא טוען.
 */
async function loadTileStats() {
	const [withDrafts, merged, admins, categories, liveAds] = await Promise.all([
		getAllGemachimWithDrafts(),
		getMergedGemachim(),
		getAdmins().catch(() => []),
		getPublicCategories().catch(() => []),
		listApproved().catch(() => [])
	]);
	const pinned = await getPinnedGemachim(merged).catch(() => []);
	const managedActive = withDrafts.filter((g) => g.status !== 'draft');
	// אותו קריטריון כמו מסך "גמ"חים לא מלאים" (missingFields): עיר, רחוב/שכונה, קואורדינטות
	const incomplete = managedActive.filter(
		(g) => !g.city || (!g.address && !g.neighborhood) || !hasValidCoords(g.lat, g.lng)
	).length;
	return {
		gemachim: merged.length,
		incomplete,
		pinned: pinned.length,
		drafts: withDrafts.length - managedActive.length,
		adsLive: liveAds.length,
		admins: admins.length,
		categories: categories.length
	};
}

export const load: PageServerLoad = async ({ locals, parent }) => {
	const session = await locals.auth();
	if (!session?.user) throw redirect(302, '/login?redirect=/profile');

	// התפקיד כבר חושב ב-+layout.server (resolveRole) — משתמשים בו ולא קוראים שוב ל-DB.
	// owner הוא בדיקה מקומית מול משתני הסביבה, בלי עלות.
	const { adminRole } = await parent();

	// הפרסומות והגמ"חים נטענים כאן ומוצגים פרוסים בדף — האזור האישי מראה
	// מה יש למשתמש בלי מסע לדף אחר. אותה שליפה בדיוק כמו /advertise/manage.
	const assets = await getOwnerAssets(session.user);

	// התראת האדמינים: פרסומות שממתינות לאישור. מחושבת מהמצב עצמו ולא נשמרת
	// כ"התראה שנקראה" — לכן היא מופיעה אצל כל האדמינים ונעלמת מעצמה מהרגע
	// שמישהו אישר או דחה. הגרסה המלאה (עם תמונה) — הבאנר מציג את הפרסומת עצמה.
	const pendingAds = adminRole ? await listPendingAdsPreview() : [];

	// הנייד של המשתמש: מהסשן (credentials/SSO) או זה שאומת כאן בקוד SMS.
	// משתמשי Google מגיעים בלי — ואז מוצג באנר "הוסיפו נייד" (needPhone),
	// כי בלעדיו הזיהוי האוטומטי שלמטה לא יכול לעבוד עבורם.
	const phone = await getVerifiedPhone(session.user);
	const userWithPhone = { ...session.user, phone };

	// זיהוי אוטומטי: גמ"חים שהטלפון שלהם תואם לטלפון של המשתמש — "האם זה שלך?".
	// ריק כשאין למשתמש טלפון (נפוץ). pendingClaims — מונה בקשות הבעלות
	// שממתינות לאישור, להתראה לאדמינים (בדומה ל-pendingAds).
	// סטטיסטיקת הכניסות (GA) נטענת רק לאדמינים — מוצגת פרוסה בפאנל הניהול שבדף.
	// tileStats — מוני האריחים; כשל בשליפה לא מפיל את הדף (null = בלי מונים).
	// pendingDrafts — גמ"חים חדשים מהטופס הציבורי (needs_review) + טיוטות-אורח
	// ישנות שממתינות לפרסום, לבועה האדומה על אריח "ניהול גמ"חים" (אותו מונה
	// שנספר בבועת ההאדר).
	const [claimable, pendingClaims, pendingDrafts, gaMonthly, tileStats] = await Promise.all([
		findClaimableByPhone(userWithPhone),
		adminRole ? countPendingClaims() : Promise.resolve(0),
		adminRole ? countGemachAttention().catch(() => 0) : Promise.resolve(0),
		adminRole ? getMonthlyVisitorStats().catch(() => null) : Promise.resolve(null),
		adminRole ? loadTileStats().catch(() => null) : Promise.resolve(null)
	]);

	return {
		user: { name: session.user.name ?? '', email: session.user.email ?? '' },
		needPhone: !phone && smsEnabled(),
		isOwner: adminRole ? isOwner(session.user) : false,
		loadFailed: assets.loadFailed,
		ads: assets.ads,
		gemachim: assets.gemachim,
		pendingAds,
		claimable,
		pendingClaims,
		pendingDrafts,
		tileStats,
		gaMonths: gaMonthly?.rows ?? null,
		gaUpdatedAt: gaMonthly?.updatedAt ?? null
	};
};

// באנר "הוסיפו נייד" — שני צעדים: שליחת קוד לנייד שהוקלד, ואימותו.
// אחרי אימות ה-load רץ מחדש והזיהוי האוטומטי ("אולי שלך?") נדלק מעצמו.
export const actions: Actions = {
	sendPhoneCode: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user) return fail(401, { phoneError: 'צריך להתחבר' });
		const phone = String((await request.formData()).get('phone') ?? '').trim();
		try {
			const r = await requestPhoneCode(session.user, phone);
			if (!r.ok) return fail(400, { phoneError: r.error, phoneValue: phone });
			return { phoneCodeSent: true, phoneValue: phone };
		} catch (e) {
			console.error('[profile] sendPhoneCode failed:', e);
			return fail(502, { phoneError: 'שליחת הקוד נכשלה — נסו שוב', phoneValue: phone });
		}
	},

	verifyPhone: async ({ request, locals }) => {
		const session = await locals.auth();
		if (!session?.user) return fail(401, { phoneError: 'צריך להתחבר' });
		const form = await request.formData();
		const code = String(form.get('code') ?? '');
		const phoneValue = String(form.get('phone') ?? '');
		try {
			const r = await verifyPhoneCode(session.user, code);
			if (!r.ok) return fail(400, { phoneError: r.error, phoneCodeSent: true, phoneValue });
			return { phoneVerified: true };
		} catch (e) {
			console.error('[profile] verifyPhone failed:', e);
			return fail(502, { phoneError: 'האימות נכשל — נסו שוב', phoneCodeSent: true, phoneValue });
		}
	}
};
