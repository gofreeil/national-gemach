// ============================================================
// source.ts — מחלקת הבסיס לכל מקורות הגילוי
// ============================================================
//
// מקור גילוי חדש = מחלקה שיורשת מ-DiscoverySource ומממשת discover().
// הצינור (pipeline.ts) לא מכיר מקורות ספציפיים — רק את החוזה הזה,
// כך שהוספת מקור (מדריך גמ"חים, אתר עירייה...) לא נוגעת בשאר הקוד.

import type { BrowserContext, Page } from 'playwright';
import type { RawResult } from './types.ts';
import type { Logger } from './logger.ts';
import type { RateLimiter } from './rateLimiter.ts';

export interface SourceContext {
	/** דפדפן לפי דרישה. מקור מבוסס-fetch (כמו duckduckgo) לא קורא לזה כלל,
	 *  ואז Chromium בכלל לא עולה — ריצה מהירה יותר ובלי שטח-פנים לאימות. */
	getBrowser: () => Promise<BrowserContext>;
	logger: Logger;
	/** השהיה מנומסת משותפת בין כל הבקשות של הריצה */
	limiter: RateLimiter;
	/** חלון גלוי — מאפשר למקור לבקש התערבות אנושית (פתרון אימות) */
	headful: boolean;
	/** בדיקת ביטול — true אם האדמין ביטל את ה-job והמקור צריך לעצור */
	shouldAbort: () => Promise<boolean>;
	/** דיווח שהמקור נקטע לפני שסיים (אימות/חסימה) — מגיע לסטטיסטיקות הריצה
	 *  ומוצג לאדמין בפאנל, כדי ש"הסתיימה" לא ייראה כמו סריקה מלאה */
	markBlocked: (reason: string) => void;
}

export abstract class DiscoverySource {
	/** מזהה טכני (ל-spec.sources ולרשומות) */
	abstract readonly name: string;
	/** שם תצוגה בעברית */
	abstract readonly label: string;

	/** מריץ את השאילתות ומניב תוצאות גולמיות. generator — הצינור מעבד
	 *  תוצאה-תוצאה בלי לצבור הכל בזיכרון. */
	abstract discover(queries: string[], ctx: SourceContext): AsyncGenerator<RawResult>;

	protected async openPage(ctx: SourceContext): Promise<Page> {
		const browser = await ctx.getBrowser();
		const page = await browser.newPage();
		page.setDefaultTimeout(30_000);
		return page;
	}
}
