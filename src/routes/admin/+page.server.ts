import type { PageServerLoad } from './$types';
import { getAllGemachim } from '$lib/server/db';
import { getCategories, getAdmins } from '$lib/server/adminStore';
import { hasValidCoords } from '$lib/server/geocode';
import { getMonthlyVisits } from '$lib/server/visitStats';

export const load: PageServerLoad = async () => {
	const [managed, categories, admins, visits] = await Promise.all([
		getAllGemachim(),
		getCategories(),
		getAdmins(),
		getMonthlyVisits(12)
	]);

	const mapReady = managed.filter(g => hasValidCoords(g.lat, g.lng)).length;

	return {
		visits,
		stats: {
			managed: managed.length,
			featured: managed.filter(g => g.featured).length,
			categories: categories.length,
			admins: admins.length,
			mapReady,
			mapMissing: managed.length - mapReady
		}
	};
};
