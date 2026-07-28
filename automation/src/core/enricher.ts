// ============================================================
// enricher.ts — העשרת מועמד: ביקור בעמוד המקור לחילוץ טלפון/עיר
// ============================================================
//
// אופציונלי (--enrich): כשלמועמד אין טלפון, ביקור קצר בעמוד שלו מציף
// לרוב טלפון וכתובת. מתוקצב (budget) כדי לא להאריך את הריצה.

import type { BrowserContext } from 'playwright';
import type { Candidate } from './types.ts';
import type { Logger } from './logger.ts';
import type { RateLimiter } from './rateLimiter.ts';
import { CityDetector, extractPhone } from './text.ts';
import { fingerprintsFor } from './fingerprint.ts';

export class PageEnricher {
	private budget: number;

	constructor(
		private readonly browser: BrowserContext,
		private readonly limiter: RateLimiter,
		private readonly cityDetector: CityDetector,
		private readonly logger: Logger,
		budget = 10,
	) {
		this.budget = budget;
	}

	/** מחזיר מועמד מועשר (או את המקורי אם אין מה/איך להעשיר) */
	async enrich(candidate: Candidate): Promise<Candidate> {
		if (candidate.phone || !candidate.link || this.budget <= 0) return candidate;
		this.budget--;
		await this.limiter.wait();
		const page = await this.browser.newPage();
		try {
			await page.goto(candidate.link, { waitUntil: 'domcontentloaded', timeout: 20_000 });
			const text = await page.evaluate(() => document.body?.innerText?.slice(0, 20_000) ?? '');
			const phone = extractPhone(text);
			const city = candidate.city || this.cityDetector.detect(text) || '';
			if (!phone && city === candidate.city) return candidate;
			const enriched: Candidate = { ...candidate, phone: phone ?? candidate.phone, city };
			enriched.fingerprints = fingerprintsFor(enriched);
			if (phone) enriched.confidence = Math.min(1, enriched.confidence + 0.2);
			this.logger.debug(`הועשר: ${candidate.name} → טלפון=${phone ?? '-'} עיר=${city || '-'}`);
			return enriched;
		} catch {
			return candidate;
		} finally {
			await page.close().catch(() => {});
		}
	}
}
