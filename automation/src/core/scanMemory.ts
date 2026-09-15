// ============================================================
// scanMemory.ts — זיכרון הסריקות: מה כבר נראה ואילו שאילתות לא מניבות
// ============================================================
//
// שתי בעיות שהזיכרון פותר:
//   1. אותם עמודים חוזרים בתוצאות של עשרות שאילתות (אינדקסים, מדריכים,
//      גמ"חים שכבר נדחו). כל אחד מהם עבר נירמול, הורדת עמוד וגיאוקודינג
//      מחדש בכל ריצה. עכשיו כתובת URL שכבר טופלה מדולגת (עם תוקף — עמוד
//      יכול להשתנות).
//   2. שאילתות שסבב אחרי סבב לא מניבות גמ"ח חדש ממשיכות לבזבז את תקציב
//      הריצה. שאילתה שנכשלה פעמיים ברצף נכנסת להשהיה, ונבדקת שוב רק אחרי
//      תקופת צינון.
//
// הזיכרון נשמר דחוס (gzip + base64) — בפריט ה-Strapi של המצב (תקרת 1MB)
// ובקובץ המקומי — ומפתחותיו הם hash קצר ולא הטקסט המלא.

import { gzipSync, gunzipSync } from 'node:zlib';
import { normalizeUrl } from './fingerprint.ts';

/** כמה ימים עמוד נחשב "נראה" לפני שבודקים אותו מחדש */
const URL_TTL_DAYS = 90;
/** תקרת כתובות בזיכרון — הישנות ביותר נשמטות */
const MAX_URLS = 20_000;
/** שאילתה עם כמה ריצות עקרות ברצף נכנסת להשהיה */
const STALE_AFTER_ZERO_RUNS = 2;
/** ימי צינון לשאילתה מושהית */
const QUERY_COOLDOWN_DAYS = 60;

interface QueryStat {
	/** ריצות */
	r: number;
	/** ריצות עקרות ברצף (0 גמ"חים חדשים) */
	z: number;
	/** יום הריצה האחרונה (מספר ימים מאז 1970) */
	t: number;
}

interface MemoryShape {
	v: 1;
	/** hash של כתובת → יום שבו נראתה לאחרונה */
	u: Record<string, number>;
	/** hash של שאילתה → סטטיסטיקה */
	q: Record<string, QueryStat>;
}

/** FNV-1a 32-bit בבסיס 36 — 6–7 תווים, מספיק ל-20K מפתחות */
export function shortHash(s: string): string {
	let h = 0x811c9dc5;
	for (let i = 0; i < s.length; i++) {
		h ^= s.charCodeAt(i);
		h = Math.imul(h, 0x01000193) >>> 0;
	}
	return h.toString(36);
}

const today = (): number => Math.floor(Date.now() / 86_400_000);

export class ScanMemory {
	private urls: Map<string, number>;
	private queries: Map<string, QueryStat>;
	dirty = false;

	constructor(shape?: MemoryShape | null) {
		this.urls = new Map(Object.entries(shape?.u ?? {}));
		this.queries = new Map(Object.entries(shape?.q ?? {}));
	}

	// ---------- כתובות ----------

	/** האם הכתובת טופלה בתוך תקופת התוקף */
	seenUrl(link: string): boolean {
		const key = urlKey(link);
		if (!key) return false;
		const day = this.urls.get(key);
		return day !== undefined && today() - day < URL_TTL_DAYS;
	}

	rememberUrl(link: string): void {
		const key = urlKey(link);
		if (!key) return;
		this.urls.set(key, today());
		this.dirty = true;
	}

	// ---------- שאילתות ----------

	/** שאילתה בהשהיה: כמה ריצות עקרות ברצף, ועוד לא עבר הצינון */
	isStaleQuery(query: string): boolean {
		const st = this.queries.get(shortHash(query));
		if (!st || st.z < STALE_AFTER_ZERO_RUNS) return false;
		return today() - st.t < QUERY_COOLDOWN_DAYS;
	}

	/** רישום תוצאת שאילתה: כמה גמ"חים חדשים היא הניבה בריצה הזו */
	recordQuery(query: string, newImports: number): void {
		const key = shortHash(query);
		const st = this.queries.get(key) ?? { r: 0, z: 0, t: 0 };
		st.r++;
		st.z = newImports > 0 ? 0 : st.z + 1;
		st.t = today();
		this.queries.set(key, st);
		this.dirty = true;
	}

	get size(): { urls: number; queries: number; staleQueries: number } {
		let stale = 0;
		for (const st of this.queries.values()) {
			if (st.z >= STALE_AFTER_ZERO_RUNS && today() - st.t < QUERY_COOLDOWN_DAYS) stale++;
		}
		return { urls: this.urls.size, queries: this.queries.size, staleQueries: stale };
	}

	// ---------- אריזה ----------

	/** מחרוזת דחוסה (gzip+base64) לשמירה */
	pack(): string {
		// ניקוי: כתובות שפג תוקפן, ואז חיתוך לתקרה (הישנות קודם)
		const cutoff = today() - URL_TTL_DAYS;
		const live = [...this.urls].filter(([, day]) => day >= cutoff).sort((a, b) => a[1] - b[1]);
		const kept = live.slice(-MAX_URLS);
		this.urls = new Map(kept);
		const shape: MemoryShape = { v: 1, u: Object.fromEntries(kept), q: Object.fromEntries(this.queries) };
		return gzipSync(Buffer.from(JSON.stringify(shape), 'utf8')).toString('base64');
	}

	static unpack(packed: string | null | undefined): ScanMemory {
		if (!packed) return new ScanMemory();
		try {
			const json = gunzipSync(Buffer.from(packed, 'base64')).toString('utf8');
			return new ScanMemory(JSON.parse(json) as MemoryShape);
		} catch {
			return new ScanMemory();
		}
	}
}

function urlKey(link: string): string | undefined {
	const norm = normalizeUrl(link);
	return norm ? shortHash(norm) : undefined;
}
