import type { PageServerLoad } from './$types';
import { getCategories, getAdmins } from '$lib/server/adminStore';
import { getMergedGemachim } from '$lib/server/gemachSource';
import { getPinnedGemachim } from '$lib/server/pinned';
import { hasValidCoords } from '$lib/server/geocode';
import { getMonthlyVisits } from '$lib/server/visitStats';

export const load: PageServerLoad = async () => {
	const [all, categories, admins, visits] = await Promise.all([
		getMergedGemachim(),
		getCategories(),
		getAdmins(),
		getMonthlyVisits(12)
	]);

	const managed = all.filter(g => g.managed);
	const mapReady = managed.filter(g => hasValidCoords(g.lat, g.lng)).length;
	const pinned = await getPinnedGemachim(all);

	return {
		visits,
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
