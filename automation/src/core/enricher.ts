// ============================================================
// enricher.ts — העשרת מועמד מעמוד המקור: טלפון, כתובת, שכונה, שעות,
//               איש קשר, תיאור (meta) ולוגו (og:image)
// ============================================================
//
// תוצאת חיפוש נותנת שורה-שתיים; העמוד עצמו נותן את כל מה שהטופס של
// "גמ"ח חדש" יודע לקבל. הורדה אחת קצרה (fetch, בלי דפדפן — רץ גם ב-CI
// שבו Chromium לא מותקן) ממלאת את השדות שחסרים, בלי לדרוס מה שכבר ידוע.
// מתוקצב (budget) כדי לא להאריך את הריצה.

import type { Candidate } from './types.ts';
import type { Logger } from './logger.ts';
import type { RateLimiter } from './rateLimiter.ts';
import { CityDetector } from './text.ts';
import { fingerprintsFor } from './fingerprint.ts';
import { cleanDescription, decodeEntities, extractDetails, guessCategories, isWeakDescription } from './details.ts';

/** תקרת גודל ללוגו שמוטמע כ-data URI — הפריט כולו מוגבל ל-~1MB ב-Strapi */
const MAX_LOGO_BYTES = 350_000;
/** תקרת HTML שנקרא מעמוד */
const MAX_HTML_BYTES = 1_500_000;
/** כתובות תמונה שנראות כמו לוגו של האתר-המארח ולא של הגמ"ח */
const GENERIC_IMAGE_RE = /(logo|default|placeholder|share|og[-_]?image|favicon|banner|sprite|avatar|blank)/i;
const UA = 'Mozilla/5.0 (compatible; gofreeil-gemach-discovery/1.0; +https://gemach.gofreeil.com)';

export interface PageMeta {
	description: string;
	image: string;
	imageWidth: number;
	text: string;
}

/** מה חסר למועמד כדי שהטיוטה תהיה שלמה */
export function needsEnrichment(c: Candidate): boolean {
	return !c.phone || !c.address || !c.hours || !c.logo || isWeakDescription(c.description);
}

export class PageEnricher {
	private budget: number;

	constructor(
		private readonly limiter: RateLimiter,
		private readonly cityDetector: CityDetector,
		private readonly logger: Logger,
		budget = 60,
	) {
		this.budget = budget;
	}

	/** מחזיר מועמד מועשר (או את המקורי אם אין מה/איך להעשיר) */
	async enrich(candidate: Candidate): Promise<Candidate> {
		if (!candidate.link || this.budget <= 0 || !needsEnrichment(candidate)) return candidate;
		this.budget--;
		await this.limiter.wait();
		try {
			const meta = await fetchPageMeta(candidate.link);
			if (!meta) return candidate;
			const enriched = this.merge(candidate, meta);
			if (meta.image && !enriched.logo && !GENERIC_IMAGE_RE.test(meta.image) && (meta.imageWidth === 0 || meta.imageWidth >= 200)) {
				enriched.logo = await fetchImageAsDataUri(new URL(meta.image, candidate.link).href);
			}
			enriched.fingerprints = fingerprintsFor(enriched);
			const gained = diff(candidate, enriched);
			if (gained.length > 0) this.logger.debug(`הועשר: ${candidate.name} → ${gained.join(', ')}`);
			return enriched;
		} catch {
			return candidate;
		}
	}

	/** ממלא שדות חסרים מתוך העמוד; לא דורס ערכים שכבר קיימים.
	 *  עמודי מדריכים מציגים לצד הגמ"ח גם "גמ"חים קרובים" עם כתובות וטלפונים
	 *  משלהם — לכן הפרטים נלקחים רק מהקטע שסביב שם הגמ"ח / הטלפון הידוע
	 *  שלו. אם לא נמצא כזה, משתמשים רק ב-meta description (שמתאר את העמוד). */
	merge(c: Candidate, meta: PageMeta): Candidate {
		const focus = focusText(meta.text, c);
		const text = focus ? `${meta.description}\n${focus}` : meta.description;
		const details = extractDetails(text, c.city);
		const out: Candidate = { ...c };

		// עיר: אם חסרה — "עיר: X" בקטע, ואם אין — זיהוי חופשי בכל העמוד
		if (!out.city) {
			out.city = (details.city ? this.cityDetector.detect(details.city) : undefined)
				?? this.cityDetector.detect(text) ?? this.cityDetector.detect(meta.text) ?? '';
		}

		// טלפון: רק כשחסר, ורק מהקטע של הגמ"ח עצמו. טלפון שני לא נלקח מעמוד —
		// גם בתוך הקטע הוא עלול להיות של גמ"ח סמוך; הוא מגיע רק מה-snippet.
		if (!out.phone && focus && details.phones.length > 0) {
			out.phone = details.phones[0];
			out.confidence = Math.min(1, out.confidence + 0.2);
		}

		if (!out.address && details.address) {
			out.address = details.address;
			out.confidence = Math.min(1, out.confidence + 0.05);
		}
		if (!out.neighborhood && details.neighborhood && details.neighborhood !== out.city) out.neighborhood = details.neighborhood;
		if (!out.hours && details.hours) out.hours = details.hours;
		if (!out.contact && details.contact) out.contact = details.contact;

		// תיאור: meta description של העמוד עדיף על snippet של מנוע חיפוש —
		// אבל רק כשהוא באמת מתאר (לא כותרת האתר) וכשמה שיש חלש.
		if (isWeakDescription(out.description) && meta.description) {
			const cleaned = cleanDescription(meta.description, { name: out.name });
			if (cleaned.length >= 40) out.description = cleaned;
		}

		// נושאים נוספים שהעמוד מזכיר (הראשי נשאר זה שזוהה מהכותרת)
		if (out.category === 'other') {
			const fromPage = guessCategories(text);
			if (fromPage[0] !== 'other') {
				out.category = fromPage[0];
				out.categories = fromPage;
			}
		}

		out.tags = [out.city, out.neighborhood].filter((t): t is string => !!t);
		return out;
	}
}

// ---------- הקטע של הגמ"ח בתוך העמוד ----------

const FOCUS_BEFORE = 1_200;
const FOCUS_AFTER = 1_800;

/** הקטע סביב שם הגמ"ח ו/או הטלפון הידוע שלו; '' אם אף אחד מהם לא בעמוד */
export function focusText(text: string, c: Candidate): string {
	const anchors: number[] = [];
	const byName = findName(text, c.name);
	if (byName >= 0) anchors.push(byName);
	const byPhone = c.phone ? findPhone(text, c.phone) : -1;
	if (byPhone >= 0) anchors.push(byPhone);
	if (anchors.length === 0) return '';
	const lo = Math.min(...anchors);
	const hi = Math.max(...anchors);
	return text.slice(Math.max(0, lo - FOCUS_BEFORE), Math.min(text.length, hi + FOCUS_AFTER));
}

/** מיקום השם בעמוד — סובלני לגרשיים/רווחים; 3 המילים הראשונות מספיקות */
function findName(text: string, name: string): number {
	const words = name.split(/\s+/).filter((w) => /[א-ת\w]/.test(w)).slice(0, 3);
	if (words.length === 0) return -1;
	const pattern = words
		.map((w) => w.split('').map((ch) => (/["״׳'`]/.test(ch) ? `["״׳'\`]?` : ch.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&'))).join(''))
		.join('\\s+');
	const m = new RegExp(pattern, 'i').exec(text);
	return m ? m.index : -1;
}

/** מיקום הטלפון בעמוד — הספרות עם מפרידים אופציונליים (02-531-2345 / 025312345) */
function findPhone(text: string, digits: string): number {
	const tail = digits.slice(-7);
	const m = new RegExp(tail.split('').join('[-\\s.]?')).exec(text);
	return m ? m.index : -1;
}

// ---------- HTML → מטא + טקסט (בלי דפדפן) ----------

/** מוריד עמוד ומחזיר meta description / og:image / הטקסט הגלוי; null אם לא HTML */
export async function fetchPageMeta(url: string): Promise<PageMeta | null> {
	const res = await fetch(url, {
		headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml', 'Accept-Language': 'he,en;q=0.5' },
		signal: AbortSignal.timeout(15_000),
		redirect: 'follow',
	});
	if (!res.ok) return null;
	const type = (res.headers.get('content-type') ?? '').toLowerCase();
	if (type && !type.includes('html')) return null;
	const raw = Buffer.from(await res.arrayBuffer()).subarray(0, MAX_HTML_BYTES).toString('utf8');
	return parseHtml(raw);
}

/** ניתוח HTML לטקסט ומטא — מספיק טוב לעמודי מדריכים ואתרי גמ"חים */
export function parseHtml(html: string): PageMeta {
	const meta = (attr: string, value: string): string => {
		const re = new RegExp(`<meta\\s+[^>]*${attr}\\s*=\\s*["']${value}["'][^>]*>`, 'i');
		const tag = re.exec(html)?.[0];
		if (!tag) return '';
		const content = /content\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1] ?? '';
		return decodeEntities(content).trim();
	};
	const description = meta('property', 'og:description') || meta('name', 'description');
	const image = meta('property', 'og:image') || meta('name', 'twitter:image');
	const imageWidth = Number(meta('property', 'og:image:width')) || 0;

	let body = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)?.[1] ?? html;
	body = body
		.replace(/<(script|style|noscript|svg|template)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
		.replace(/<!--[\s\S]*?-->/g, ' ')
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|tr|h[1-6]|section|article|header|footer|td|th|dd|dt|blockquote)>/gi, '\n')
		.replace(/<[^>]+>/g, ' ');
	// רצפים של שורות ריקות (תבניות עם עשרות div ריקים) → שורה אחת, אחרת
	// תקרת הטקסט מתבזבזת על רווחים לפני שמגיעים לפרטי הגמ"ח
	const text = decodeEntities(body)
		.replace(/[ \t ]+/g, ' ')
		.replace(/[ \r]*\n\s*/g, '\n')
		.trim()
		.slice(0, 30_000);
	return { description, image, imageWidth, text };
}

/** מוריד תמונה ומחזיר data URI — או undefined אם גדולה/לא תמונה/נכשלה */
async function fetchImageAsDataUri(url: string): Promise<string | undefined> {
	try {
		const res = await fetch(url, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(8_000), redirect: 'follow' });
		if (!res.ok) return undefined;
		const type = (res.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
		if (!/^image\/(jpeg|png|webp|gif)$/.test(type)) return undefined;
		const buf = Buffer.from(await res.arrayBuffer());
		if (buf.length === 0 || buf.length > MAX_LOGO_BYTES) return undefined;
		return `data:${type};base64,${buf.toString('base64')}`;
	} catch {
		return undefined;
	}
}

function diff(before: Candidate, after: Candidate): string[] {
	const keys: Array<keyof Candidate> = ['phone', 'phone2', 'address', 'neighborhood', 'hours', 'contact', 'logo', 'city'];
	const gained = keys.filter((k) => !before[k] && after[k]).map(String);
	if (before.description !== after.description) gained.push('description');
	return gained;
}
