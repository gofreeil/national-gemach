import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAllGemachimWithDrafts, deleteGemach, patchGemachOrder, setGemachStatus, setGemachVerified, clearGemachReview, ensureGemachCoords } from '$lib/server/db';
import { getPublicCategories } from '$lib/server/adminStore';
import { getPinnedIdsResolved, pinGemach, unpinGemach } from '$lib/server/pinned';
import { withImageUrls } from '$lib/server/gemachSource';
import type { Gemach } from '$lib/gemachData';
import { staticGemachim } from '$lib/staticGemachim';
import { getHiddenStaticIds, setStaticHidden } from '$lib/server/hiddenStatic';

const PAGE_SIZE = 50;

export const load: PageServerLoad = async ({ url }) => {
	const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
	const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

	// כולל טיוטות — מוצגות עם תג "טיוטה" וכפתור פרסום
	const [all, categories] = await Promise.all([getAllGemachimWithDrafts(), getPublicCategories()]);
	// מצב הנעיצה מגיע מרשימת הנעוצים (/admin/pinned) — היא מקור האמת
	const pinnedIds = await getPinnedIdsResolved(all);

	// טלפון: משווים ספרות בלבד, ו-972 בהתחלה = 0 — כך 0523003153, 052-3003153
	// ו-+972523003153 מוצאים את אותו גמ"ח
	const digits = (s: string) => s.replace(/\D/g, '').replace(/^972/, '0');
	const qDigits = digits(q);
	const phoneHit = (p?: string) => qDigits.length >= 4 && !!p && digits(p).includes(qDigits);
	const matches = (g: Gemach) =>
		g.name.toLowerCase().includes(q) ||
		g.city.toLowerCase().includes(q) ||
		(g.neighborhood?.toLowerCase().includes(q) ?? false) ||
		phoneHit(g.phone) || phoneHit(g.phone2) ||
		g.tags.some(t => t.toLowerCase().includes(q));
	const filtered = q ? all.filter(matches) : all;

	// הרשימה הקבועה (לא ב-DB) — מוצגת רק בחיפוש, עם כפתור הסתרה/החזרה.
	// פריט שכבר יובא ל-DB מופיע למעלה כפריט רגיל, ולכן לא כאן.
	const importedIds = new Set(all.map(g => g.sourceId).filter(Boolean));
	const hiddenStatic = await getHiddenStaticIds();
	const staticHits = q
		? staticGemachim.filter(g => !importedIds.has(g.id) && matches(g))
			.map(g => ({ id: g.id, name: g.name, city: g.city, phone: g.phone ?? '', hidden: hiddenStatic.has(g.id) }))
		: [];

	// הפריטים שבועת ההתראה בהאדר סופרת — גמ"ח חדש לבדיקה (needs_review)
	// וטיוטת-אורח שממתינה לפרסום/דחייה (guest_claim) — קופצים לראש הרשימה;
	// בלעדי זה הם קבורים בסידור הידני אי-שם בין העמודים, בלי דרך למצוא אותם.
	// המיון יציב, לתצוגה בלבד — order האמיתי (ולכן האתר) לא משתנה.
	const attention = (g: Gemach) => !!g.needsReview || !!g.wrongPhone || (g.status === 'draft' && !!g.guestClaim);
	const reviewCount = filtered.filter(attention).length;
	const sorted = reviewCount
		? [...filtered.filter(attention), ...filtered.filter((g) => !attention(g))]
		: filtered;

	const total = sorted.length;
	const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
	const safePage = Math.min(page, pages);
	// תמונות ככתובות endpoint ולא כ-data URI מוטמע — הרשימה נטענת מהר
	const items = sorted.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(withImageUrls);

	return {
		reviewCount,
		items,
		staticHits,
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
	/** הסתרה/החזרה של גמ"ח מהרשימה הקבועה (שאינו ב-DB) */
	hideStatic: async ({ request }) => {
		const fd = await request.formData();
		const id = String(fd.get('id') ?? '');
		if (!staticGemachim.some(g => g.id === id)) return fail(400, { error: 'גמ"ח לא נמצא ברשימה הקבועה' });
		try { await setStaticHidden(id, fd.get('hidden') === 'true'); }
		catch (e) { console.error(e); return fail(500, { error: 'העדכון נכשל' }); }
		return { success: true };
	},
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
			// פרסום טיוטה שאין לה פין במפה — משלימים geocoding (best-effort)
			if (status === 'active') await ensureGemachCoords(id);
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
