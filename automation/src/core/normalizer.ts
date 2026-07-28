// ============================================================
// normalizer.ts — תוצאה גולמית ← מועמד מנורמל עם ניקוד ביטחון
// ============================================================

import type { Candidate, RawResult } from './types.ts';
import { fingerprintsFor } from './fingerprint.ts';
import {
	CityDetector,
	cleanTitle,
	containsGemach,
	extractPhone,
	guessCategory,
	hasIdentityBeyondGemach,
	normalizePhone,
} from './text.ts';

export type NormalizeOutcome =
	| { ok: true; candidate: Candidate }
	| { ok: false; reason: string };

export class CandidateNormalizer {
	private readonly cityDetector: CityDetector;

	constructor(cities: string[]) {
		this.cityDetector = new CityDetector(cities);
	}

	normalize(raw: RawResult): NormalizeOutcome {
		const fullText = `${raw.title} ${raw.snippet}`;
		if (!containsGemach(fullText)) return { ok: false, reason: 'לא מוזכר גמ"ח' };

		const name = cleanTitle(raw.title);
		if (!name || name.length < 3) return { ok: false, reason: 'שם לא תקין' };
		// כותרת שהיא רק המילה "גמח" (עמודי אינדקס) — אין בה זיהוי
		if (!hasIdentityBeyondGemach(name)) return { ok: false, reason: 'שם כללי מדי' };

		const phone = raw.phone ? normalizePhone(raw.phone) : extractPhone(fullText);
		const city = raw.city ?? this.cityDetector.detect(fullText) ?? '';

		// בלי עיר ובלי טלפון אין במה לאחוז — גם לא לזיהוי כפילויות אמין
		if (!city && !phone) return { ok: false, reason: 'אין עיר ואין טלפון' };

		const category = guessCategory(fullText);
		const link = raw.url && raw.url.startsWith('http') ? raw.url : undefined;

		let confidence = 0.25;
		if (containsGemach(raw.title)) confidence += 0.2;
		if (phone) confidence += 0.25;
		if (city) confidence += 0.15;
		if (category !== 'other') confidence += 0.1;
		if (link) confidence += 0.05;
		confidence = Math.min(1, Math.round(confidence * 100) / 100);

		if (confidence < 0.4) return { ok: false, reason: `ביטחון נמוך (${confidence})` };

		const description = raw.snippet.replace(/\s+/g, ' ').trim().slice(0, 400);
		const tags = [city].filter(Boolean);

		const candidate: Candidate = {
			name,
			city,
			phone,
			link,
			address: raw.address,
			description,
			category,
			tags,
			confidence,
			fingerprints: fingerprintsFor({ name, city, phone, link }),
			source: raw.source,
			sourceUrl: raw.url || '',
			query: raw.query,
		};
		return { ok: true, candidate };
	}
}
