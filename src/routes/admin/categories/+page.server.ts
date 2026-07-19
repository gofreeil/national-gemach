import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getCategories, saveCategories } from '$lib/server/adminStore';
import { categories as defaultCategories, type CategoryDef } from '$lib/gemachData';

export const load: PageServerLoad = async () => {
	return { categories: await getCategories() };
};

function slugify(s: string): string {
	return s.trim().replace(/\s+/g, '-').toLowerCase();
}

function normalizeList(raw: unknown): CategoryDef[] {
	if (!Array.isArray(raw)) throw new Error('bad');
	const seen = new Set<string>();
	const out: CategoryDef[] = [];
	for (const item of raw) {
		if (!item || typeof item !== 'object') continue;
		const o = item as Record<string, unknown>;
		const label = String(o.label ?? '').trim();
		if (!label) continue;
		let key = String(o.key ?? '').trim() || slugify(label);
		key = slugify(key);
		if (seen.has(key)) continue;
		seen.add(key);
		out.push({ key, label, icon: String(o.icon ?? '').trim() || '📦' });
	}
	return out;
}

export const actions: Actions = {
	save: async ({ request }) => {
		const raw = (await request.formData()).get('categories') as string;
		let list: CategoryDef[];
		try {
			list = normalizeList(JSON.parse(raw));
		} catch {
			return fail(400, { error: 'נתוני הקטגוריות אינם תקינים' });
		}
		if (list.length === 0) return fail(400, { error: 'חייבת להישאר לפחות קטגוריה אחת' });
		try {
			await saveCategories(list);
		} catch (e) {
			console.error('[admin] saveCategories failed:', e);
			return fail(500, { error: 'שמירת הקטגוריות נכשלה. נסה שוב.' });
		}
		throw redirect(303, '/admin/categories?flash=saved');
	},

	reset: async () => {
		try {
			await saveCategories(defaultCategories);
		} catch (e) {
			console.error('[admin] reset categories failed:', e);
			return fail(500, { error: 'האיפוס נכשל' });
		}
		throw redirect(303, '/admin/categories?flash=reset');
	}
};
