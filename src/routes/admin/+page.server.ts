import type { PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { getCategories, getAdmins } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';
import { getPinnedGemachim } from '$lib/server/pinned';
import { hasValidCoords } from '$lib/server/geocode';
import { getMonthlyVisits } from '$lib/server/visitStats';
import { listAllForAdmin } from '$lib/server/adsStore';
import { countDraftGemachim } from '$lib/server/discoveryStore';
import { rightAds } from '$lib/rightAdsData';

/** תמצית מצב הפרסומות לדשבורד — הפירוט המלא במסך /admin/ads */
interface AdsSummary {
	totalSlots: number;
	occupied: number;
	freeNow: number;
	pending: number;
	/** ההתפנות הקרובה (ISO) — ריק כשיש משבצות פנויות או שאין מודעות */
	nextFreeAt: string;
}

async function buildAdsSummary(): Promise<AdsSummary | null> {
	try {
		const ads = await listAllForAdmin();
		const now = Date.now();
		const active = ads.filter(
			(a) => a.status === 'approved' && (!a.expiresAt || Date.parse(a.expiresAt) > now),
		);
		const nextFreeAt = active.map((a) => a.expiresAt).filter(Boolean).sort()[0] ?? '';
		return {
			totalSlots: rightAds.length,
			occupied: Math.min(active.length, rightAds.length),
			freeNow: Math.max(0, rightAds.length - active.length),
			pending: ads.filter((a) => a.status === 'pending').length,
			nextFreeAt,
		};
	} catch (e) {
		console.error('[admin] adsSummary failed:', e);
		return null;
	}
}

export const load: PageServerLoad = async ({ locals }) => {
	await getAdminContext(locals);

	const [all, categories, admins, visits, adsSummary, discoveryDrafts] = await Promise.all([
		getMergedGemachim(),
		getCategories(),
		getAdmins(),
		getMonthlyVisits(12),
		// תמצית הפרסומות — לשני התפקידים; מסך /admin/ads פתוח לכל אדמין
		buildAdsSummary(),
		// טיוטות שאוטומציית הגילוי ייבאה וממתינות לאישור (לשני התפקידים)
		countDraftGemachim().catch(() => 0)
	]);

	const managed = all.filter(g => g.managed);
	const mapReady = managed.filter(g => hasValidCoords(g.lat, g.lng)).length;
	const pinned = await getPinnedGemachim(all);

	return {
		visits,
		adsSummary,
		discoveryDrafts,
		stats: {
			managed: managed.length,
			pinned: pinned.length,
			categories: categories.length,
			admins: admins.length,
			mapReady,
			mapMissing: managed.length - mapReady
		}
	};
};
