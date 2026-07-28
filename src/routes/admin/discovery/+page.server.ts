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
import { triggerCloudScan } from '$lib/server/githubDispatch';

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

/** מתרגם כשל כתיבה ל-Strapi להסבר מעשי. המסך הזה לאדמינים בלבד, ולכן
 *  עדיף להראות את הסיבה האמיתית מאשר "נסו שוב" שלא מוביל לשום מקום —
 *  הכשל הנפוץ הוא STRAPI_TOKEN חסר/placeholder בסביבה שממנה רץ האתר. */
function writeErrorMessage(err: unknown, action: string): string {
	const msg = err instanceof Error ? err.message : String(err);
	if (/\b(401|403|Forbidden|Unauthorized)\b/i.test(msg)) {
		return `${action} נדחה ע"י Strapi (אין הרשאת כתיבה). בדקו ש-STRAPI_TOKEN מוגדר בסביבה שממנה רץ האתר — בפיתוח מקומי זה קובץ .env בשורש הפרויקט.`;
	}
	if (/\b(404|Route not found)\b/i.test(msg)) {
		return `${action} נכשל: Strapi לא מכיר את הנתיב המבוקש (בדקו את כתובת ה-API).`;
	}
	return `${action} נכשל: ${msg.slice(0, 200)}`;
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
			// מפעיל מיד את הריצה בענן, כך שאין צורך שמחשב כלשהו יהיה דלוק
			const cloud = await triggerCloudScan();
			if (cloud.ok) {
				return { success: true, message: 'הסריקה הופעלה בענן 🛰️ — הטיוטות יופיעו כאן בעוד כמה דקות' };
			}
			if (cloud.reason === 'failed') console.error('הפעלת הסריקה בענן נכשלה:', cloud.detail);
			return {
				success: true,
				message:
					cloud.reason === 'not_configured'
						? 'הסריקה נוספה לתור 🛰️ — תתבצע ע"י עובד הגילוי ברגע שיהיה זמין'
						: 'הסריקה נוספה לתור 🛰️ — הפעלת הענן נכשלה, היא תתבצע ע"י עובד מקומי',
			};
		} catch (err) {
			console.error('discovery scan enqueue failed:', err);
			return fail(502, { error: writeErrorMessage(err, 'יצירת הסריקה') });
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
			return fail(502, { error: writeErrorMessage(err, 'ביטול הסריקה') });
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
			return fail(502, { error: writeErrorMessage(err, 'אישור הגמ"ח') });
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
			return fail(502, { error: writeErrorMessage(err, 'דחיית הטיוטה') });
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
			return fail(502, { error: writeErrorMessage(err, 'החזרת הפריט') });
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
			return fail(502, { error: writeErrorMessage(err, 'מחיקת הטיוטה') });
		}
	},
};
