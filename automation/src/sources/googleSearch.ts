// ============================================================
// googleSearch.ts — מקור גילוי: תוצאות החיפוש האורגניות של Google
// ============================================================

import type { Page } from 'playwright';
import { DiscoverySource, type SourceContext } from '../core/source.ts';
import type { RawResult } from '../core/types.ts';
import { acceptGoogleConsent, handleGoogleChallenge } from './googleCommon.ts';

/** דומיינים שאין טעם לייבא מהם כרשומת גמ"ח (מנועי חיפוש, האתרים שלנו) */
const SKIP_HOSTS = ['google.', 'gofreeil.com', 'youtube.com', 'wikipedia.org'];

interface SerpItem {
	url: string;
	title: string;
	snippet: string;
}

export class GoogleSearchSource extends DiscoverySource {
	readonly name = 'google-search';
	readonly label = 'חיפוש Google';

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
				const url = `https://www.google.com/search?q=${encodeURIComponent(query)}&hl=iw&gl=il&num=20`;
				try {
					await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 });
				} catch (e) {
					log.warn(`ניווט נכשל לשאילתה "${query}" — מדלג`, e);
					continue;
				}
				await acceptGoogleConsent(page);
				if ((await handleGoogleChallenge(page, ctx)) === 'blocked') return;
				const items = await parseSerp(page);
				log.info(`"${query}" → ${items.length} תוצאות`);
				for (const item of items) {
					if (SKIP_HOSTS.some((h) => item.url.includes(h))) continue;
					yield {
						source: this.name,
						query,
						url: item.url,
						title: item.title,
						snippet: item.snippet,
					};
				}
			}
		} finally {
			await page.close().catch(() => {});
		}
	}
}

/** חילוץ התוצאות האורגניות מה-DOM של עמוד התוצאות */
async function parseSerp(page: Page): Promise<SerpItem[]> {
	return await page
		.evaluate(() => {
			const out: Array<{ url: string; title: string; snippet: string }> = [];
			const seen = new Set<string>();
			const headings = document.querySelectorAll('#search h3, #rso h3');
			for (const h3 of headings) {
				const a = h3.closest('a');
				if (!a) continue;
				let href = a.getAttribute('href') ?? '';
				// קישורי הפניה ישנים: /url?q=<היעד>
				if (href.startsWith('/url?')) {
					const q = new URLSearchParams(href.slice(5)).get('q');
					href = q ?? '';
				}
				if (!href.startsWith('http') || seen.has(href)) continue;
				seen.add(href);
				const container =
					a.closest('div[data-hveid]') ?? a.closest('div.g') ?? a.parentElement?.parentElement ?? a;
				let snippet = '';
				const snipEl = container.querySelector(
					'div[data-sncf], div[style*="line-clamp"], .VwiC3b, [data-content-feature="1"]',
				);
				if (snipEl) snippet = snipEl.textContent ?? '';
				else {
					// נפילה לאחור: הטקסט של הבלוק בלי הכותרת
					const text = (container.textContent ?? '').replace(h3.textContent ?? '', ' ');
					snippet = text;
				}
				out.push({
					url: href,
					title: (h3.textContent ?? '').trim(),
					snippet: snippet.replace(/\s+/g, ' ').trim().slice(0, 500),
				});
			}
			return out;
		})
		.catch(() => []);
}
