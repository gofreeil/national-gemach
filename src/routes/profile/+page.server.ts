import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { isOwner } from '$lib/server/admin';
import { getOwnerAssets } from '$lib/server/ownerAssets';
import { listPendingAdsPreview } from '$lib/server/adsStore';
import { findClaimableByPhone, countPendingClaims } from '$lib/server/claimsStore';
import { getMonthlyVisitorStats } from '$lib/server/visitorStats';

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
	// סטטיסטיקת הכניסות (GA) נטענת רק לאדמינים — מוצגת פרוסה בפאנל הניהול שבדף
	const [claimable, pendingClaims, gaMonthly] = await Promise.all([
		findClaimableByPhone(session.user),
		adminRole ? countPendingClaims() : Promise.resolve(0),
		adminRole ? getMonthlyVisitorStats().catch(() => null) : Promise.resolve(null)
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
		gaMonths: gaMonthly?.rows ?? null,
		gaUpdatedAt: gaMonthly?.updatedAt ?? null
	};
};
