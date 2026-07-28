// ============================================================
// browser.ts — הפעלת דפדפן Playwright בפרופיל ישראלי קבוע
// ============================================================
//
// הפרופיל נשמר על הדיסק (automation/state/browser-profile) ולא נמחק בין
// ריצות. זה קריטי: עוגיית ההסכמה של Google וכל אימות שנפתר ידנית פעם אחת
// נשמרים, ולכן הריצות הבאות עוברות בלי אימות חוזר.

import { chromium, type BrowserContext } from 'playwright';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { Logger } from './logger.ts';

const DEFAULT_PROFILE_DIR = join(
	dirname(fileURLToPath(import.meta.url)),
	'..',
	'..',
	'state',
	'browser-profile',
);

export class BrowserFactory {
	constructor(private readonly logger: Logger) {}

	async launch(opts: { headful?: boolean; profileDir?: string } = {}): Promise<{
		context: BrowserContext;
		close: () => Promise<void>;
	}> {
		const profileDir = opts.profileDir ?? DEFAULT_PROFILE_DIR;
		this.logger.info(`מפעיל Chromium (${opts.headful ? 'חלון גלוי' : 'headless'}), פרופיל: ${profileDir}`);
		try {
			const context = await chromium.launchPersistentContext(profileDir, {
				headless: !opts.headful,
				locale: 'he-IL',
				timezoneId: 'Asia/Jerusalem',
				viewport: { width: 1366, height: 850 },
				userAgent:
					'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
				args: ['--disable-blink-features=AutomationControlled'],
			});
			return {
				context,
				close: async () => {
					await context.close().catch(() => {});
				},
			};
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			// הפרופיל הקבוע נעול ע"י מופע אחר — קורה כששולחים סריקה ידנית
			// בזמן שה-worker כבר מריץ משימה (שניהם חולקים את אותו פרופיל).
			if (/ProcessSingleton|SingletonLock|already (in use|running)/i.test(msg)) {
				this.logger.error(
					`הפרופיל ${profileDir} תפוס ע"י ריצה אחרת. המתינו שה-worker יסיים את המשימה הנוכחית, ` +
					'או עצרו אותו (Ctrl+C) לפני הרצת סריקה ידנית.',
				);
			} else {
				this.logger.error('הפעלת הדפדפן נכשלה. אם Chromium לא מותקן הריצו: npx playwright install chromium');
			}
			throw e;
		}
	}
}
