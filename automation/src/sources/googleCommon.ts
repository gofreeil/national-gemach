// ============================================================
// googleCommon.ts — טיפול משותף במסכי ההסכמה והאימות של Google
// ============================================================

import type { Page } from 'playwright';
import type { SourceContext } from '../core/source.ts';

/** כמה זמן ממתינים שאדם יפתור אימות בחלון גלוי */
const MANUAL_SOLVE_TIMEOUT_MS = 3 * 60 * 1000;
const POLL_MS = 2_000;

/** מסך ההסכמה (עוגיות) — מופיע בהרצה ראשונה של פרופיל נקי */
export async function acceptGoogleConsent(page: Page): Promise<void> {
	try {
		const btn = page
			.locator('#L2AGLb, button:has-text("קבל הכול"), button:has-text("אני מסכים"), button:has-text("Accept all")')
			.first();
		await btn.click({ timeout: 3_000 });
		await page.waitForLoadState('domcontentloaded', { timeout: 10_000 });
	} catch {
		/* אין מסך הסכמה — ממשיכים */
	}
}

/** האם העמוד הנוכחי הוא מסך אימות (ולא תוצאות) */
export async function isGoogleBlocked(page: Page): Promise<boolean> {
	const url = page.url();
	if (url.includes('/sorry/') || url.includes('ipv4.google.com')) return true;
	return await page
		.evaluate(() => !!document.querySelector('form#captcha-form, iframe[src*="recaptcha"]'))
		.catch(() => false);
}

/**
 * מטפל באימות של Google. אנחנו לא מנסים לעקוף אותו — בחלון גלוי פשוט
 * ממתינים שהמשתמש יפתור אותו בעצמו, והפתרון נשמר בפרופיל הקבוע כך
 * שהריצות הבאות (כולל headless) עוברות בלעדיו.
 *
 * מחזיר 'ok' אם אפשר להמשיך, או 'blocked' אם צריך לעצור את המקור.
 */
export async function handleGoogleChallenge(page: Page, ctx: SourceContext): Promise<'ok' | 'blocked'> {
	if (!(await isGoogleBlocked(page))) return 'ok';

	if (!ctx.headful) {
		ctx.logger.warn(
			'Google מציג אימות. הריצו פעם אחת עם --headful ופתרו אותו ידנית — ' +
			'הפתרון נשמר בפרופיל (automation/state/browser-profile) והריצות הבאות יעברו בלעדיו.',
		);
		ctx.markBlocked('Google ביקש אימות. הריצו פעם אחת `npm run discovery:scan -- --headful` ופתרו אותו ידנית — הפתרון נשמר לריצות הבאות.');
		return 'blocked';
	}

	ctx.logger.warn(`Google מציג אימות — פתרו אותו בחלון שנפתח. ממתין עד ${MANUAL_SOLVE_TIMEOUT_MS / 60000} דקות...`);
	const deadline = Date.now() + MANUAL_SOLVE_TIMEOUT_MS;
	while (Date.now() < deadline) {
		await page.waitForTimeout(POLL_MS);
		if (await ctx.shouldAbort()) return 'blocked';
		if (!(await isGoogleBlocked(page))) {
			ctx.logger.info('האימות נפתר — ממשיכים (הפתרון נשמר בפרופיל).');
			return 'ok';
		}
	}
	ctx.logger.warn('האימות לא נפתר בזמן — עוצר את המקור.');
	ctx.markBlocked('אימות Google לא נפתר בזמן — הסריקה נעצרה באמצע.');
	return 'blocked';
}
