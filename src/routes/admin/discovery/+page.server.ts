import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import {
	listGemachimForReview,
	listDiscoveryJobs,
	hasActiveJob,
	enqueueScan,
	cancelJob,
	approveDraft,
	rejectDraft,
	restoreDraft,
} from '$lib/server/discoveryStore';
import { deleteGemach } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';

// מסך "גילוי חכם" — אדמין וסופר-אדמין (שניהם): הפעלת סריקת גילוי,
// מעקב אחרי תור המשימות, ואישור/דחייה של טיוטות שהאוטומציה ייבאה.
// (ראו automation/README.md לזרימה המלאה.)

export const load: PageServerLoad = async ({ locals }) => {
	await getAdminContext(locals); // שני התפקידים מורשים

	const [drafts, rejected, jobs, categories] = await Promise.all([
		listGemachimForReview('draft'),
		listGemachimForReview('rejected'),
		listDiscoveryJobs(12),
		getCategories(),
	]);

	return { drafts, rejected, jobs, categories, queueBusy: hasActiveJob(jobs) };
};

/** מי מבצע את הפעולה — לתיעוד ב-extra_fields.discovery */
async function actor(locals: App.Locals): Promise<string> {
	const { user } = await getAdminContext(locals);
	return user.email || user.name || '';
}

export const actions: Actions = {
	scan: async ({ request, locals }) => {
		const by = await actor(locals);
		const form = await request.formData();
		const maxQueries = Number(form.get('maxQueries'));
		try {
			const jobs = await listDiscoveryJobs(12);
			if (hasActiveJob(jobs)) return fail(400, { error: 'כבר יש סריקה בתור או בריצה — המתינו שתסתיים או בטלו אותה' });
			await enqueueScan({
				requestedBy: by,
				maxQueries: Number.isFinite(maxQueries) && maxQueries > 0 ? Math.min(maxQueries, 80) : undefined,
			});
			return { success: true, message: 'הסריקה נוספה לתור 🛰️ — ה-worker יתחיל אותה ברגע שיהיה זמין' };
		} catch (err) {
			console.error('discovery scan enqueue failed:', err);
			return fail(502, { error: 'יצירת הסריקה נכשלה — נסו שוב' });
		}
	},

	cancel: async ({ request, locals }) => {
		const by = await actor(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה משימה' });
		try {
			const ok = await cancelJob(id, by);
			return ok
				? { success: true, message: 'הסריקה בוטלה' }
				: fail(400, { error: 'המשימה כבר הסתיימה — אין מה לבטל' });
		} catch (err) {
			console.error('discovery cancel failed:', err);
			return fail(502, { error: 'הביטול נכשל — נסו שוב' });
		}
	},

	approve: async ({ request, locals }) => {
		const by = await actor(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה גמ"ח' });
		try {
			await approveDraft(id, by);
			return { success: true, message: 'הגמ"ח אושר ופורסם באתר ✅' };
		} catch (err) {
			console.error('discovery approve failed:', err);
			return fail(502, { error: 'האישור נכשל — נסו שוב' });
		}
	},

	reject: async ({ request, locals }) => {
		const by = await actor(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		const reason = String(form.get('reason') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה גמ"ח' });
		try {
			await rejectDraft(id, by, reason);
			return { success: true, message: 'הטיוטה נדחתה — לא תיובא שוב' };
		} catch (err) {
			console.error('discovery reject failed:', err);
			return fail(502, { error: 'הדחייה נכשלה — נסו שוב' });
		}
	},

	restore: async ({ request, locals }) => {
		const by = await actor(locals);
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה גמ"ח' });
		try {
			await restoreDraft(id, by);
			return { success: true, message: 'הפריט הוחזר לטיוטות' };
		} catch (err) {
			console.error('discovery restore failed:', err);
			return fail(502, { error: 'ההחזרה נכשלה — נסו שוב' });
		}
	},

	remove: async ({ request, locals }) => {
		await actor(locals); // אימות הרשאה בלבד
		const form = await request.formData();
		const id = String(form.get('id') ?? '');
		if (!id) return fail(400, { error: 'חסר מזהה גמ"ח' });
		try {
			await deleteGemach(id);
			return { success: true, message: 'הטיוטה נמחקה (זיכרון האוטומציה ימנע ייבוא חוזר)' };
		} catch (err) {
			console.error('discovery remove failed:', err);
			return fail(502, { error: 'המחיקה נכשלה — נסו שוב' });
		}
	},
};
