// ============================================================
// queryPlanner.ts — בניית מרחב השאילתות וסבב מתגלגל עליו
// ============================================================
//
// מרחב השאילתות המלא (קטגוריות × ערים + שאילתות כלליות) גדול מכדי
// ריצה אחת, ולכן כל ריצה לוקחת "פרוסה" ממנו וממשיכה מהמקום שבו הריצה
// הקודמת עצרה (cursor שנשמר ב-StateStore). ככה הכיסוי מצטבר לאורך
// ריצות — בלי לחזור שוב ושוב על אותן שאילתות ראשונות.

import type { CategoryRef, ScanSpec } from './types.ts';

/** ערים שבהן ריכוז הגמ"חים הגבוה בארץ — ברירת המחדל לסבב */
export const TOP_CITIES: string[] = [
	'ירושלים', 'בני ברק', 'בית שמש', 'מודיעין עילית', 'ביתר עילית',
	'אלעד', 'אשדוד', 'חיפה', 'פתח תקווה', 'נתניה',
	'רחובות', 'תל אביב - יפו', 'באר שבע', 'צפת', 'טבריה',
	'אופקים', 'רכסים', 'קרית גת', 'לוד', 'חדרה',
];

const GENERIC_QUERIES: string[] = [
	'רשימת גמ"חים',
	'מדריך גמ"חים',
	'גמ"ח חדש נפתח',
	'גמ"חים מומלצים',
];

export class QueryPlanner {
	constructor(private readonly defaultCategories: CategoryRef[]) {}

	/** מרחב השאילתות המלא — דטרמיניסטי, כדי שה-cursor יהיה יציב בין ריצות */
	buildUniverse(spec: ScanSpec): string[] {
		const cats = (spec.categories?.length ? spec.categories : this.defaultCategories)
			.filter((c) => c.key !== 'other');
		const cities = spec.cities?.length ? spec.cities : TOP_CITIES;

		const queries: string[] = [...GENERIC_QUERIES];
		for (const city of cities) queries.push(`גמ"חים ב${city}`);
		for (const cat of cats) queries.push(`גמ"ח ${cat.label}`);
		for (const city of cities) {
			for (const cat of cats) queries.push(`גמ"ח ${cat.label} ${city}`);
		}
		return [...new Set(queries)];
	}

	/** פרוסת השאילתות לריצה הנוכחית (סבב מעגלי). שאילתות שה-skip פוסל
	 *  (בהשהיה בזיכרון הסריקות) נצרכות מהסבב בלי לרוץ.
	 *  cursorAfter[k] = ה-cursor לריצה הבאה אם רק k השאילתות הראשונות רצו —
	 *  ריצה שנקטעה (חסימה / תקרת ייבוא) מקדמת את הסבב רק על מה שבאמת רץ. */
	select(
		universe: string[],
		cursor: number,
		count: number,
		skip?: (query: string) => boolean,
	): { queries: string[]; nextCursor: number; cursorAfter: number[]; skipped: number } {
		if (universe.length === 0) return { queries: [], nextCursor: 0, cursorAfter: [0], skipped: 0 };
		const len = universe.length;
		const start = ((cursor % len) + len) % len;
		const queries: string[] = [];
		const cursorAfter: number[] = [start];
		let skipped = 0;
		for (let i = 0; i < len && queries.length < count; i++) {
			const q = universe[(start + i) % len];
			if (skip?.(q)) { skipped++; continue; }
			queries.push(q);
			cursorAfter.push((start + i + 1) % len);
		}
		// שאילתות מדולגות בסוף הפרוסה נצרכות גם הן
		const consumed = queries.length + skipped;
		const nextCursor = (start + consumed) % len;
		cursorAfter[cursorAfter.length - 1] = nextCursor;
		return { queries, nextCursor, cursorAfter, skipped };
	}
}
