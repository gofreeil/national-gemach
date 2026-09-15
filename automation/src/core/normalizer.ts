// ============================================================
// normalizer.ts — תוצאה גולמית ← מועמד מנורמל עם ניקוד ביטחון
// ============================================================

import type { Candidate, RawResult } from './types.ts';
import { fingerprintsFor } from './fingerprint.ts';
import { cleanDescription, extractDetails, guessCategories, stripCityFromAddress } from './details.ts';
import {
	CityDetector,
	cleanTitle,
	containsGemach,
	hasIdentityBeyondGemach,
	normalizePhone,
} from './text.ts';

export type NormalizeOutcome =
	| { ok: true; candidate: Candidate }
	| { ok: false; reason: string };

/** "גמ"ח ציוד רפואי בסנהדריה, ירושלים" — מהשדות שחולצו, כשאין תיאור אמיתי */
export function fallbackDescription(p: { name: string; categoryText?: string; neighborhood?: string; city?: string }): string {
	const what = p.categoryText ? `גמ"ח ${p.categoryText.replace(/^גמ["״']?ח\s*/, '')}` : p.name;
	const where = [p.neighborhood ? `ב${p.neighborhood}` : '', p.city].filter(Boolean).join(', ');
	return where ? `${what} ${where}` : what;
}

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

		// עיר: מה שהמקור סיפק → "עיר: X" בטקסט → זיהוי חופשי בטקסט
		const details = extractDetails(fullText);
		const city = raw.city
			?? (details.city ? this.cityDetector.detect(details.city) : undefined)
			?? this.cityDetector.detect(fullText)
			?? '';

		// טלפונים: של המקור קודם, ואז לפי סדר ההופעה בטקסט. השני → phone2.
		const phones = [
			...(raw.phone ? [normalizePhone(raw.phone)] : []),
			...details.phones,
		].filter((p, i, arr) => arr.indexOf(p) === i);
		const phone = phones[0];
		const phone2 = phones[1];

		// בלי עיר ובלי טלפון אין במה לאחוז — גם לא לזיהוי כפילויות אמין
		if (!city && !phone) return { ok: false, reason: 'אין עיר ואין טלפון' };

		const categories = guessCategories(fullText);
		const category = categories[0];
		const link = raw.url && raw.url.startsWith('http') ? raw.url : undefined;
		// העיר זוהתה רק עכשיו — מורידים אותה מסוף הכתובת ("סנהדריה 106, ירושלים")
		const address = stripCityFromAddress(raw.address ?? details.address, city);
		// שכונה שזוהתה כעיר היא לא שכונה ("שכונה: ירושלים")
		const neighborhood = details.neighborhood && details.neighborhood !== city ? details.neighborhood : undefined;

		let confidence = 0.25;
		if (containsGemach(raw.title)) confidence += 0.2;
		if (phone) confidence += 0.25;
		if (city) confidence += 0.15;
		if (category !== 'other') confidence += 0.1;
		if (link) confidence += 0.05;
		confidence = Math.min(1, Math.round(confidence * 100) / 100);

		if (confidence < 0.4) return { ok: false, reason: `ביטחון נמוך (${confidence})` };

		// התיאור: ה-snippet בלי בלוקי "שדה: ערך" (שפורקו לשדות) ובלי שאריות
		// תבנית. אם לא נשאר משפט אמיתי — שורה עניינית מהשדות שכן ידועים,
		// עדיף על "כתיבת תגובה / מאת ... / דירוג: אין דירוג" בכרטיס.
		const rawSnippet = raw.snippet.replace(/\s+/g, ' ').trim();
		const cleaned = cleanDescription(rawSnippet, { name });
		const description = (cleaned.length >= 15
			? cleaned
			: fallbackDescription({ name, categoryText: details.categoryText, neighborhood, city })
		).slice(0, 400);
		const tags = [city, neighborhood].filter((t): t is string => !!t);

		const candidate: Candidate = {
			name,
			city,
			phone,
			phone2,
			link,
			address,
			neighborhood,
			hours: details.hours,
			contact: details.contact,
			description,
			category,
			categories,
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
