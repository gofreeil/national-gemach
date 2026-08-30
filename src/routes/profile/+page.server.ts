import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isOwner } from '$lib/server/admin';
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

	// זיהוי אוטומטי: גמ"חים שהטלפון שלהם תואם לטלפון של המשתמש — "האם זה שלך?".
	// ריק כשאין למשתמש טלפון בסשן (נפוץ). pendingClaims — מונה בקשות הבעלות
	// שממתינות לאישור, להתראה לאדמינים (בדומה ל-pendingAds).
	// סטטיסטיקת הכניסות (GA) נטענת רק לאדמינים — מוצגת פרוסה בפאנל הניהול שבדף.
	// tileStats — מוני האריחים; כשל בשליפה לא מפיל את הדף (null = בלי מונים).
	// pendingDrafts — גמ"חים חדשים מהטופס הציבורי (needs_review) + טיוטות-אורח
	// ישנות שממתינות לפרסום, לבועה האדומה על אריח "ניהול גמ"חים" (אותו מונה
	// שנספר בבועת ההאדר).
	const [claimable, pendingClaims, pendingDrafts, gaMonthly, tileStats] = await Promise.all([
		findClaimableByPhone(session.user),
		adminRole ? countPendingClaims() : Promise.resolve(0),
		adminRole ? countGemachAttention().catch(() => 0) : Promise.resolve(0),
		adminRole ? getMonthlyVisitorStats().catch(() => null) : Promise.resolve(null),
		adminRole ? loadTileStats().catch(() => null) : Promise.resolve(null)
	]);

	return {
		user: { name: session.user.name ?? '', email: session.user.email ?? '' },
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
