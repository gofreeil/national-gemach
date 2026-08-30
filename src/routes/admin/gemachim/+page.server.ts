import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAllGemachimWithDrafts, deleteGemach, patchGemachOrder, setGemachStatus, setGemachVerified, clearGemachReview } from '$lib/server/db';
import { getPublicCategories } from '$lib/server/adminStore';
import { getPinnedIdsResolved, pinGemach, unpinGemach } from '$lib/server/pinned';
import { withImageUrls } from '$lib/server/gemachSource';
import type { Gemach } from '$lib/gemachData';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	// כולל טיוטות — מוצגות עם תג "טיוטה" וכפתור פרסום
	const [all, categories] = await Promise.all([getAllGemachimWithDrafts(), getPublicCategories()]);
	// מצב הנעיצה מגיע מרשימת הנעוצים (/admin/pinned) — היא מקור האמת
	const pinnedIds = await getPinnedIdsResolved(all);

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
	// תמונות ככתובות endpoint ולא כ-data URI מוטמע — הרשימה נטענת מהר
	const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(withImageUrls);

	return {
		items,
		categories,
		pinnedIds,
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
	const list = await getAllGemachimWithDrafts(); // כבר ממויין לפי התצוגה
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
	togglePin: async ({ request }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		const pin = fd.get('pinned') === 'true';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await (pin ? pinGemach(id) : unpinGemach(id)); } catch (e) { console.error(e); return fail(500, { error: 'העדכון נכשל' }); }
		return { success: true };
	},
	delete: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await deleteGemach(id); } catch (e) { console.error(e); return fail(500, { error: 'המחיקה נכשלה' }); }
		return { success: true, deleted: id };
	},
	/** פרסום / החזרה לטיוטה — לפי הערך בשדה status */
	setStatus: async ({ request, locals }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		const status = fd.get('status') as string;
		if (!id || !['active', 'draft'].includes(status)) return fail(400, { error: 'קלט לא תקין' });
		const session = await locals.auth();
		const actor = session?.user?.email || session?.user?.name || 'admin';
		try {
			await setGemachStatus(id, status, status === 'active'
				? { approved_at: new Date().toISOString(), approved_by: actor, rejection_reason: '' }
				: { drafted_at: new Date().toISOString(), drafted_by: actor });
		} catch (e) { console.error(e); return fail(500, { error: 'עדכון הסטטוס נכשל' }); }
		return { success: true };
	},
	/** "נבדק" — מכבה את התראת "חדש לבדיקה" של גמ"ח שהגיע מהטופס הציבורי */
	markReviewed: async ({ request }) => {
		const id = (await request.formData()).get('id') as string;
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await clearGemachReview(id); } catch (e) { console.error(e); return fail(500, { error: 'העדכון נכשל' }); }
		return { success: true };
	},
	/** הענקה/הסרה של חותמת "מאושר" (בדיקת מערכת) */
	toggleVerified: async ({ request }) => {
		const fd = await request.formData();
		const id = fd.get('id') as string;
		const verified = fd.get('verified') === 'true';
		if (!id) return fail(400, { error: 'חסר מזהה' });
		try { await setGemachVerified(id, verified); } catch (e) { console.error(e); return fail(500, { error: 'עדכון החותמת נכשל' }); }
		return { success: true };
	}
};
