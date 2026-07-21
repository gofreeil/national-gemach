import type { PageServerLoad } from './$types';
import { getAllGemachim, getImportedSourceIds } from '$lib/server/db';
import { getCategories, getAdmins } from '$lib/server/adminStore';
import { hasValidCoords } from '$lib/server/geocode';
import { getMonthlyVisits } from '$lib/server/visitStats';
import { staticGemachim } from '$lib/staticGemachim';

export const load: PageServerLoad = async () => {
	const [managed, categories, admins, importedIds, visits] = await Promise.all([
		getAllGemachim(),
		getCategories(),
		getAdmins(),
		getImportedSourceIds(),
		getMonthlyVisits(12)
	]);

	const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id)).length;
	const mapReady = managed.filter(g => hasValidCoords(g.lat, g.lng)).length;

	return {
		visits,
		stats: {
			managed: managed.length,
			featured: managed.filter(g => g.featured).length,
			staticTotal: staticGemachim.length,
			staticRemaining: remainingStatic,
			staticImported: staticGemachim.length - remainingStatic,
			categories: categories.length,
			admins: admins.length,
			mapReady,
			mapMissing: managed.length - mapReady
		}
	};
};
