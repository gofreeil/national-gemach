import type { PageServerLoad } from './$types';
import { getAllGemachim, getImportedSourceIds } from '$lib/server/db';
import { getCategories, getAdmins } from '$lib/server/adminStore';
import { staticGemachim } from '$lib/staticGemachim';

export const load: PageServerLoad = async () => {
	const [managed, categories, admins, importedIds] = await Promise.all([
		getAllGemachim(),
		getCategories(),
		getAdmins(),
		getImportedSourceIds()
	]);

	const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id)).length;

	return {
		stats: {
			managed: managed.length,
			featured: managed.filter(g => g.featured).length,
			staticTotal: staticGemachim.length,
			staticRemaining: remainingStatic,
			staticImported: staticGemachim.length - remainingStatic,
			categories: categories.length,
			admins: admins.length
		}
	};
};
