import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAllGemachim, deleteGemach, patchGemachOrder } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import type { Gemach } from '$lib/gemachData';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	const [all, categories] = await Promise.all([getAllGemachim(), getCategories()]);

	const filtered = q
		? all.filter(g =>
			g.name.toLowerCase().includes(q) ||
			g.city.toLowerCase().includes(q) ||
			(g.neighborhood?.toLowerCase().includes(q) ?? false) ||
			(g.phone?.includes(q) ?? false) ||
			g.tags.some(t => t.toLowerCase().includes(q)))
		: all;

	const total = filtered.length;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const safePage = Math.min(page, pages);
	const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

	return {
		items,
		categories,
		total,
		managedTotal: all.length,
		page: safePage,
		pages,
		pageSize: PAGE_SIZE,
		q: url.searchParams.get('q') ?? ''
	};
};

/** מיקום אפקטיבי לחישוב סידור — order מפורש, אחרת בסיס גדול לפי המיקום הנוכחי */
function effOrder(g: Gemach, idx: number): number {
	const BASE = 1_000_000;
	return typeof g.order === 'number' ? g.order : BASE + idx;
}

async function reorder(id: string, dir: 'up' | 'down') {
	const list = await getAllGemachim(); // כבר ממויין לפי התצוגה
	const i = list.findIndex(g => g.id === id);
	if (i < 0) return;

	let newOrder: number;
	if (dir === 'up') {
		if (i <= 0) return;
		const ob = effOrder(list[i - 1], i - 1);
		const oc = i - 2 >= 0 ? effOrder(list[i - 2], i - 2) : ob - 2;
		newOrder = (oc + ob) / 2;
	} else {
		if (i >= list.length - 1) return;
		const ob = effOrder(list[i + 1], i + 1);
		const od = i + 2 < list.length ? effOrder(list[i + 2], i + 2) : ob + 2;
		newOrder = (ob + od) / 2;
	}
	await patchGemachOrder(id, { order: newOrder });
}

export const actions: Actions = {
	moveUp: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await reorder(id, 'up'); } catch (e) { console.error(e); return fail(500, { error: 'הסידור נכשל' }); }
		return { success: true };
	},
	moveDown: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await reorder(id, 'down'); } catch (e) { console.error(e); return fail(500, { error: 'הסידור נכשל' }); }
		return { success: true };
	},
	toggleFeature: async ({ request }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		const featured = fd.get('featured') === 'true';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await patchGemachOrder(id, { featured }); } catch (e) { console.error(e); return fail(500, { error: 'העדכון נכשל' }); }
		return { success: true };
	},
	delete: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await deleteGemach(id); } catch (e) { console.error(e); return fail(500, { error: 'המחיקה נכשלה' }); }
		return { success: true, deleted: id };
	}
};
