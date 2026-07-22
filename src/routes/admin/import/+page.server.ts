import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getImportedSourceIds, importStaticBatch, type CreateGemachInput } from '$lib/server/db';
import { staticGemachim } from '$lib/staticGemachim';

// גודל אצווה — מספיק קטן כדי לא לחרוג ממגבלת זמן הריצה (serverless), והלקוח ממשיך אוטומטית.
const BATCH = 20;

export const load: PageServerLoad = async () => {
	const imported = await getImportedSourceIds();
	const remaining = staticGemachim.filter(g => !imported.has(g.id)).length;
	return {
		total: staticGemachim.length,
		imported: staticGemachim.length - remaining,
		remaining,
		batchSize: BATCH
	};
};

export const actions: Actions = {
	batch: async () => {
		const importedIds = await getImportedSourceIds();
		const pending = staticGemachim.filter(g => !importedIds.has(g.id));
		if (pending.length === 0) {
			return { success: true, imported: 0, failed: 0, remaining: 0, done: true };
		}

		const slice = pending.slice(0, BATCH);
		const inputs: CreateGemachInput[] = slice.map(g => ({
			name:         g.name,
			category:     g.category,
			city:         g.city,
			neighborhood: g.neighborhood,
			phone:        g.phone,
			description:  g.description,
			tags:         g.tags,
			contact:      g.contact,
			link:         g.link,
			notes:        g.notes,
			image:        g.image,
			sourceId:     g.id
		}));

		let result;
		try {
			result = await importStaticBatch(inputs);
		} catch (e) {
			console.error('[admin] importStaticBatch failed:', e);
			return fail(500, { error: 'הייבוא נכשל. ודא שהשרת מחובר ונסה שוב.' });
		}

		const remaining = pending.length - result.imported;
		return {
			success: true,
			imported: result.imported,
			failed: result.failed,
			remaining,
			done: remaining <= 0
		};
	}
};
