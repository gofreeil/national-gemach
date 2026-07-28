// ============================================================
// duckduckgo.ts — מקור גילוי עצמאי לחלוטין (בלי דפדפן, בלי CAPTCHA)
// ============================================================
//
// זהו מקור ברירת המחדל. בניגוד ל-Google, נקודת ה-HTML של DuckDuckGo
// מגישה תוצאות לבקשת fetch רגילה — בלי Playwright, בלי אימות ובלי שום
// התערבות אנושית. זה מה שהופך את הסריקה לאוטומטית באמת.
//
// אין כאן עקיפה של הגנה: זו נקודת קצה ציבורית ללא JS שמיועדת לדפדפנים
// פשוטים. שומרים על קצב מנומס בדיוק כמו בשאר המקורות.

import { DiscoverySource, type SourceContext } from '../core/source.ts';
import type { RawResult } from '../core/types.ts';

const ENDPOINT = 'https://html.duckduckgo.com/html/';
const USER_AGENT =
	'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const REQUEST_TIMEOUT_MS = 25_000;
const ATTEMPTS = 3;

/** דומיינים שאינם רשומת גמ"ח (מנועים, רשתות חברתיות, האתרים שלנו) */
const SKIP_HOSTS = ['duckduckgo.com', 'google.', 'gofreeil.com', 'youtube.com', 'wikipedia.org', 'facebook.com'];

export class DuckDuckGoSource extends DiscoverySource {
	readonly name = 'duckduckgo';
	readonly label = 'DuckDuckGo (עצמאי)';

	async *discover(queries: string[], ctx: SourceContext): AsyncGenerator<RawResult> {
		const log = ctx.logger.child(this.name);
		for (const query of queries) {
			if (await ctx.shouldAbort()) {
				log.warn('ה-job בוטל — עוצר את המקור');
				return;
			}
			await ctx.limiter.wait();

			const html = await this.fetchResults(query, log);
			if (html === null) continue;
			if (/anomaly|unusual traffic/i.test(html) && !html.includes('result__a')) {
				log.warn('DuckDuckGo מדווח על עומס חריג — עוצר את המקור בריצה הזו');
				ctx.markBlocked('DuckDuckGo חסם זמנית את הבקשות. נסו שוב מאוחר יותר או הקטינו את היקף הסריקה.');
				return;
			}

			const items = parseResults(html);
			log.info(`"${query}" → ${items.length} תוצאות`);
			for (const item of items) {
				if (!item.url || SKIP_HOSTS.some((h) => item.url.includes(h))) continue;
				yield {
					source: this.name,
					query,
					url: item.url,
					title: item.title,
					snippet: item.snippet,
				};
			}
		}
	}

	/** מחזיר את ה-HTML, או null אם השאילתה נכשלה (ממשיכים לשאילתה הבאה) */
	private async fetchResults(query: string, log: SourceContext['logger']): Promise<string | null> {
		for (let attempt = 1; attempt <= ATTEMPTS; attempt++) {
			try {
				const res = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}&kl=il-he`, {
					headers: {
						'User-Agent': USER_AGENT,
						'Accept-Language': 'he-IL,he;q=0.9,en;q=0.8',
						Accept: 'text/html,application/xhtml+xml',
					},
					signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
				});
				if (!res.ok) {
					if (attempt === ATTEMPTS) {
						log.warn(`שאילתה "${query}" החזירה ${res.status} — מדלג`);
						return null;
					}
					continue;
				}
				return await res.text();
			} catch (e) {
				if (attempt === ATTEMPTS) {
					log.warn(`שאילתה "${query}" נכשלה — מדלג`, e);
					return null;
				}
			}
		}
		return null;
	}
}

interface ParsedResult {
	url: string;
	title: string;
	snippet: string;
}

/** ישויות ה-HTML שמופיעות בפועל בתוצאות (כולל גרשיים בשמות גמ"חים) */
function decodeEntities(s: string): string {
	return s
		.replace(/&quot;/g, '"')
		.replace(/&#x27;|&apos;/g, "'")
		.replace(/&amp;/g, '&')
		.replace(/&lt;/g, '<')
		.replace(/&gt;/g, '>')
		.replace(/&nbsp;/g, ' ')
		.replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)));
}

function stripTags(s: string): string {
	return decodeEntities(s.replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();
}

/** DuckDuckGo עוטף כל קישור בהפניה: //duckduckgo.com/l/?uddg=<כתובת מקודדת> */
function resolveUrl(href: string): string {
	if (!href) return '';
	const m = /[?&]uddg=([^&]+)/.exec(href);
	if (m) {
		try {
			return decodeURIComponent(m[1]);
		} catch {
			return '';
		}
	}
	if (href.startsWith('//')) return 'https:' + href;
	return href.startsWith('http') ? href : '';
}

/** חילוץ התוצאות מה-HTML. הפרסינג מבוסס על מבנה יציב (result__a/result__snippet)
 *  ומדלג בשקט על בלוק שלא נפרס, כדי ששינוי עיצוב לא יפיל את כל הסריקה. */
export function parseResults(html: string): ParsedResult[] {
	const out: ParsedResult[] = [];
	const seen = new Set<string>();
	// כל תוצאה היא עוגן עם class="result__a" (סדר המאפיינים בתוך התג משתנה,
	// ולכן לוכדים את כולם ומחלצים את ה-href מתוכם).
	const anchorRe = /<a\b([^>]*class="result__a"[^>]*)>([\s\S]*?)<\/a>/g;
	let m: RegExpExecArray | null;
	while ((m = anchorRe.exec(html)) !== null) {
		const url = resolveUrl(/href="([^"]+)"/.exec(m[1])?.[1] ?? '');
		const title = stripTags(m[2]);
		if (!url || !title || seen.has(url)) continue;
		seen.add(url);
		// הסניפט הוא הראשון שמופיע אחרי הכותרת; חלון מוגבל כדי לא לגלוש לתוצאה הבאה
		const after = html.slice(anchorRe.lastIndex, anchorRe.lastIndex + 3000);
		const snip = /class="result__snippet"[^>]*>([\s\S]*?)<\/a>/.exec(after);
		out.push({ url, title, snippet: snip ? stripTags(snip[1]).slice(0, 500) : '' });
	}
	return out;
}
