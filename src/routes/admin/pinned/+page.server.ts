import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getMergedGemachim } from '$lib/server/gemachSource';
import { getPinnedGemachim, pinGemach, unpinGemach, movePinned } from '$lib/server/pinned';
import { getCategories } from '$lib/server/adminStore';

const MAX_RESULTS = 30;

export const load: PageServerLoad = async ({ url }) => {
	const rawQ = url.searchParams.get('q') ?? '';
	const q = rawQ.trim().toLowerCase();

	const [all, categories] = await Promise.all([getMergedGemachim(), getCategories()]);
	const pinned = await getPinnedGemachim(all);
	const pinnedSet = new Set(pinned.map(g => g.id));

	const matches = q
		? all.filter(g =>
			!pinnedSet.has(g.id) && (
				g.name.toLowerCase().includes(q) ||
				g.city.toLowerCase().includes(q) ||
				(g.neighborhood?.toLowerCase().includes(q) ?? false) ||
				(g.phone?.includes(q) ?? false) ||
				g.tags.some(t => t.toLowerCase().includes(q))))
		: [];

	return {
		pinned,
		categories,
		q: rawQ,
		results: matches.slice(0, MAX_RESULTS),
		resultsTotal: matches.length,
		total: all.length
	};
};

/** עוטף פעולת כתיבה — מחזיר שגיאה קריאה במקום להפיל את העמוד */
async function run(fn: () => Promise<void>, failMsg: string) {
	try {
		await fn();
		return { success: true };
	} catch (e) {
		console.error('[admin/pinned]', e);
		return fail(500, { error: e instanceof Error ? e.message : failMsg });
	}
}

function requireId(fd: FormData): string | null {
	const id = fd.get('id');
	return typeof id === 'string' && id.trim() ? id.trim() : null;
}

export const actions: Actions = {
	pin: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'חסר מזהה' });
		return run(() => pinGemach(id), 'הנעיצה נכשלה');
	},
	unpin: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'חסר מזהה' });
		return run(() => unpinGemach(id), 'ההסרה נכשלה');
	},
	moveUp: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'חסר מזהה' });
		return run(() => movePinned(id, 'up'), 'הסידור נכשל');
	},
	moveDown: async ({ request }) => {
		const id = requireId(await request.formData());
		if (!id) return fail(400, { error: 'חסר מזהה' });
		return run(() => movePinned(id, 'down'), 'הסידור נכשל');
	}
};
