import { fail, redirect } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext, requireOwner } from '$lib/server/admin';
import { getCategories, saveCategories } from '$lib/server/adminStore';
import { categories as defaultCategories, type CategoryDef } from '$lib/gemachData';
import { MAX_CATEGORY_IMAGES_KB } from '$lib/imageCompress';

export const load: PageServerLoad = async ({ locals }) => {
	const { owner } = await getAdminContext(locals);
	requireOwner(owner);
	return { categories: await getCategories() };
};

function slugify(s: string): string {
	return s.trim().replace(/\s+/g, '-').toLowerCase();
}

/** תמונת אריח קבילה: קובץ שהועלה (data URI), כתובת https, או נתיב מקומי ב-static */
const SAFE_IMAGE = /^(data:image\/|https:\/\/|\/)/i;

/** משקל מקורב ב-KB של data URI. גרסת-שרת של dataUriWeightKb (שם — צד לקוח בלבד) */
function dataUriKb(src: string): number {
	if (!src.startsWith('data:')) return 0;
	return Math.round((src.slice(src.indexOf(',') + 1).length * 0.75) / 1024);
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
		// התמונה נשמרת ככל שדה אחר. בלי זה כל שמירה בפאנל הייתה מוחקת את
		// תמונות האריחים ומחזירה את הקטגוריות לאימוג'י.
		const image = String(o.image ?? '').trim();
		out.push({
			key,
			label,
			icon: String(o.icon ?? '').trim() || '📦',
			...(SAFE_IMAGE.test(image) ? { image } : {}),
		});
	}
	return out;
}

export const actions: Actions = {
	save: async ({ locals, request }) => {
		const { owner } = await getAdminContext(locals);
		requireOwner(owner);

		const raw = (await request.formData()).get('categories') as string;
		let list: CategoryDef[];
		try {
			list = normalizeList(JSON.parse(raw));
		} catch {
			return fail(400, { error: 'נתוני הקטגוריות אינם תקינים' });
		}
		if (list.length === 0) return fail(400, { error: 'חייבת להישאר לפחות קטגוריה אחת' });
		// כל התמונות יושבות באותה רשומת הגדרות — חריגה מהתקרה מוחזרת מ-Strapi
		// כ-413 בלי הסבר, ולכן חוסמים כאן עם הודעה שאומרת מה לעשות.
		const imagesKb = list.reduce((sum, c) => sum + dataUriKb(c.image ?? ''), 0);
		if (imagesKb > MAX_CATEGORY_IMAGES_KB) {
			return fail(400, {
				error: `תמונות הקטגוריות שוקלות ${imagesKb}KB, מעל התקרה של ${MAX_CATEGORY_IMAGES_KB}KB. הסר תמונה או שתיים ונסה שוב.`,
			});
		}
		try {
			await saveCategories(list);
		} catch (e) {
			console.error('[admin] saveCategories failed:', e);
			return fail(500, { error: 'שמירת הקטגוריות נכשלה. נסה שוב.' });
		}
		throw redirect(303, '/admin/categories?flash=saved');
	},

	reset: async ({ locals }) => {
		const { owner } = await getAdminContext(locals);
		requireOwner(owner);
		try {
			await saveCategories(defaultCategories);
		} catch (e) {
			console.error('[admin] reset categories failed:', e);
			return fail(500, { error: 'האיפוס נכשל' });
		}
		throw redirect(303, '/admin/categories?flash=reset');
	}
};
