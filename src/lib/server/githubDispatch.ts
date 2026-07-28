// ============================================================
// githubDispatch.ts — הפעלת סריקת הגילוי בענן מתוך הפאנל
// ============================================================
//
// אין סריקה מתוזמנת: סורקים רק כשאדמין מבקש. הלחיצה על "הפעל סריקה"
// יוצרת משימה בתור ואז מפעילה את ה-workflow ב-GitHub Actions, שמרוקן
// את התור. כך הסריקה מתבצעת גם כשכל המחשבים כבויים.
//
// אם GH_DISPATCH_TOKEN לא מוגדר — לא קורה כלום מלבד רישום בתור,
// והמשימה תתבצע ע"י עובד מקומי (npm run discovery:worker) כשיהיה זמין.

import { env } from '$env/dynamic/private';

const DEFAULT_REPO = 'gofreeil/national-gemach';
const WORKFLOW_FILE = 'discovery-scan.yml';
const DEFAULT_REF = 'main';

export type DispatchResult =
	| { ok: true }
	| { ok: false; reason: 'not_configured' | 'failed'; detail?: string };

/** מפעיל את ה-workflow. לא זורק — כישלון כאן לא אמור להפיל את יצירת המשימה. */
export async function triggerCloudScan(): Promise<DispatchResult> {
	const token = env.GH_DISPATCH_TOKEN?.trim();
	if (!token) return { ok: false, reason: 'not_configured' };

	const repo = env.GH_DISPATCH_REPO?.trim() || DEFAULT_REPO;
	const ref = env.GH_DISPATCH_REF?.trim() || DEFAULT_REF;

	try {
		const res = await fetch(
			`https://api.github.com/repos/${repo}/actions/workflows/${WORKFLOW_FILE}/dispatches`,
			{
				method: 'POST',
				headers: {
					Accept: 'application/vnd.github+json',
					Authorization: `Bearer ${token}`,
					'X-GitHub-Api-Version': '2022-11-28',
					'Content-Type': 'application/json',
				},
				// בלי inputs: הריצה רק מרוקנת את התור, לא סורקת מעבר למה שהוזמן
				body: JSON.stringify({ ref }),
				signal: AbortSignal.timeout(15_000),
			},
		);
		// GitHub מחזיר 204 בהצלחה
		if (res.status === 204) return { ok: true };
		const text = await res.text().catch(() => '');
		return { ok: false, reason: 'failed', detail: `${res.status}: ${text.slice(0, 200)}` };
	} catch (e) {
		return { ok: false, reason: 'failed', detail: e instanceof Error ? e.message : String(e) };
	}
}
