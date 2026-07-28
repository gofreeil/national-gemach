// ============================================================
// googleLocal.ts — מקור גילוי: תוצאות "מקומיות" של Google (tbm=lcl)
// ============================================================
//
// התוצאות המקומיות (לוח העסקים) מכילות בדרך כלל טלפון וכתובת ישירות
// ב-DOM — מידע עשיר יותר מתוצאה אורגנית, ולכן המקור הזה מצוין לגמ"חים
// שקיימים כ"עסק" במפות Google.

import { DiscoverySource, type SourceContext } from '../core/source.ts';
import type { RawResult } from '../core/types.ts';
import { acceptGoogleConsent, handleGoogleChallenge } from './googleCommon.ts';

interface LocalItem {
	title: string;
	details: string;
	website: string;
}

export class GoogleLocalSource extends DiscoverySource {
	readonly name = 'google-local';
	readonly label = 'Google מקומי (לוח עסקים)';

	async *discover(queries: string[], ctx: SourceContext): AsyncGenerator<RawResult> {
		const log = ctx.logger.child(this.name);
		const page = await this.openPage(ctx);
		try {
			for (const query of queries) {
				if (await ctx.shouldAbort()) {
					log.warn('ה-job בוטל — עוצר את המקור');
					return;
				}
				await ctx.limiter.wait();
				const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=iw&gl=il&tbm=lcl`;
				try {
					await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
				} catch (e) {
					log.warn(`ניווט נכשל לשאילתה "${query}" — מדלג`, e);
					continue;
				}
				await acceptGoogleConsent(page);
				if ((await handleGoogleChallenge(page, ctx)) === 'blocked') return;
				const items = await parseLocalResults(page);
				log.info(`"${query}" → ${items.length} תוצאות מקומיות`);
				for (const item of items) {
					if (!item.title) continue;
					yield {
						source: this.name,
						query,
						url: item.website,
						title: item.title,
						// הטלפון/כתובת נחלצים מהטקסט ע"י ה-normalizer (extractPhone וזיהוי עיר)
						snippet: item.details,
					};
				}
			}
		} finally {
			await page.close().catch(() => {});
		}
	}
}

/** כרטיסי התוצאות המקומיות: שם + שורות פרטים (כתובת/טלפון/שעות) + אתר אם יש */
async function parseLocalResults(page: import('playwright').Page): Promise<LocalItem[]> {
	return await page
		.evaluate(() => {
			const out: Array<{ title: string; details: string; website: string }> = [];
			// כרטיס תוצאה מקומית — הכותרת ב-div[role=heading] או .dbg0pd
			const cards = document.querySelectorAll('div[jscontroller] .VkpGBb, .rllt__details');
			for (const card of cards) {
				const root = card.closest('div[jscontroller]') ?? card;
				const heading = root.querySelector('[role="heading"], .dbg0pd, .OSrXXb');
				const title = (heading?.textContent ?? '').trim();
				if (!title) continue;
				const details = (root.textContent ?? '').replace(/\s+/g, ' ').trim().slice(0, 500);
				// קישור לאתר חיצוני (לא google) אם מופיע בכרטיס
				let website = '';
				for (const a of root.querySelectorAll('a[href^="http"]')) {
					const href = a.getAttribute('href') ?? '';
					if (href && !href.includes('google.')) {
						website = href;
						break;
					}
				}
				out.push({ title, details, website });
			}
			// הסרת כפילויות לפי כותרת (אותו כרטיס נתפס לעיתים פעמיים בסלקטורים)
			const seen = new Set<string>();
			return out.filter((i) => {
				if (seen.has(i.title)) return false;
				seen.add(i.title);
				return true;
			});
		})
		.catch(() => []);
}
