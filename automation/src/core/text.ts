// ============================================================
// text.ts — עיבוד טקסט עברי: זיהוי גמ"ח, טלפונים, ערים וקטגוריות
// ============================================================

/** גרשיים/גרש בכל הצורות (כולל תווי Unicode ״ ׳) */
const QUOTES_RE = /["'`״׳]/g;

/** צורות הכתיבה של "גמ"ח" בטקסט חופשי: גמ"ח, גמ״ח, גמח, גמ'ח, גמילות חסד/חסדים */
const GEMACH_RE = /גמ["'`״׳]?ח|גמילות\s*חסד/;

export function containsGemach(text: string): boolean {
	return GEMACH_RE.test(text);
}

/** נירמול השוואתי: בלי גרשיים, רווחים מכווצים, אותיות סופיות רגילות, lowercase */
export function normalizeHebrew(text: string): string {
	return text
		.replace(QUOTES_RE, '')
		.replace(/[־–—]/g, '-') // מקף עברי / en / em dash → מקף רגיל
		.replace(/\s+/g, ' ')
		.trim()
		.toLowerCase();
}

/** נירמול שם לטביעת אצבע: כמו normalizeHebrew + בלי פיסוק ובלי ניקוד */
export function normalizeName(name: string): string {
	return normalizeHebrew(name)
		.replace(/[֑-ׇ]/g, '') // ניקוד וטעמים
		.replace(/[^\wא-ת ]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

// ---------- טלפונים ----------

/** מספרי טלפון ישראליים בטקסט חופשי: 0X-XXXXXXX / 05X-XXXXXXX / +972... */
const PHONE_RE = /(?:\+972[-\s.]?|0)(?:[23489]|5\d|7\d)(?:[-\s.]?\d){7}/g;

export function extractPhone(text: string): string | undefined {
	PHONE_RE.lastIndex = 0;
	const m = PHONE_RE.exec(text);
	return m ? normalizePhone(m[0]) : undefined;
}

export function extractAllPhones(text: string): string[] {
	PHONE_RE.lastIndex = 0;
	const out: string[] = [];
	let m: RegExpExecArray | null;
	while ((m = PHONE_RE.exec(text)) !== null) out.push(normalizePhone(m[0]));
	return [...new Set(out)];
}

/** ספרות בלבד; קידומת בינלאומית 972 → 0 */
export function normalizePhone(phone: string): string {
	let digits = phone.replace(/\D/g, '');
	if (digits.startsWith('972')) digits = '0' + digits.slice(3);
	return digits;
}

/** 9 הספרות האחרונות — משווה 05X-XXXXXXX מול +972-5X-XXXXXXX */
export function phoneTail(phone: string): string {
	return normalizePhone(phone).slice(-9);
}

// ---------- ערים ----------

/** כינויים נפוצים → השם הקנוני ברשימת הערים */
const CITY_ALIASES: Array<[alias: string, canonical: string]> = [
	['תל אביב', 'תל אביב - יפו'],
	['ת"א', 'תל אביב - יפו'],
	['ב"ב', 'בני ברק'],
	['י-ם', 'ירושלים'],
	['פ"ת', 'פתח תקווה'],
	['ק. גת', 'קרית גת'],
];

const HEBREW_LETTER = /[א-ת]/;

/** מזהה עיר מתוך טקסט חופשי. מחפש את ההתאמה הארוכה ביותר עם גבולות מילה
 *  (כדי ש"אור יהודה" לא תיתפס כ"יהודה" ו"רחובות" לא תיתפס בתוך מילה אחרת). */
export class CityDetector {
	/** [טקסט חיפוש מנורמל, שם קנוני] — ממויין מהארוך לקצר */
	private readonly terms: Array<[string, string]>;

	constructor(cities: string[]) {
		const seen = new Set<string>();
		const terms: Array<[string, string]> = [];
		for (const city of cities) {
			const norm = normalizeHebrew(city);
			if (norm.length < 3 || seen.has(norm)) continue;
			seen.add(norm);
			terms.push([norm, city]);
		}
		for (const [alias, canonical] of CITY_ALIASES) {
			const norm = normalizeHebrew(alias);
			if (!seen.has(norm)) terms.push([norm, cities.includes(canonical) ? canonical : canonical]);
		}
		this.terms = terms.sort((a, b) => b[0].length - a[0].length);
	}

	detect(text: string): string | undefined {
		const norm = ' ' + normalizeHebrew(text) + ' ';
		for (const [term, canonical] of this.terms) {
			// גם "בבני ברק" / "לירושלים" — אות שימוש לפני שם העיר
			const idx = norm.indexOf(term);
			if (idx === -1) continue;
			const before = norm[idx - 1] ?? ' ';
			const after = norm[idx + term.length] ?? ' ';
			const beforeOk = !HEBREW_LETTER.test(before) || 'בלמהוכש'.includes(before);
			const afterOk = !HEBREW_LETTER.test(after);
			if (beforeOk && afterOk) return canonical;
		}
		return undefined;
	}
}

// ---------- קטגוריות ----------

/** מילות מפתח → מפתח תת-קטגוריה (extra_fields.gmach_type).
 *  הסדר חשוב: הספציפי קודם (רפואי לפני כלים, ברית לפני חתונה). */
const CATEGORY_KEYWORDS: Array<[key: string, words: string[]]> = [
	['medical', ['רפואי', 'קביים', 'כסא גלגלים', 'כיסא גלגלים', 'הליכון', 'אינהלציה', 'משאבת חלב', 'מד לחץ', 'חמצן']],
	['baby', ['תינוק', 'עגלת', 'עגלות', 'לול', 'מוצץ', 'טיטול', 'בקבוק']],
	['wedding', ['חתונה', 'שמלות כלה', 'שמלת כלה', 'כלה', 'חתן', 'ברית מילה', 'ברית', 'כרית']],
	['mourning', ['אבל', 'אבלות', 'הלוויה', 'ניחום', 'נפטר', 'חסד של אמת']],
	['prayer', ['תפילה', 'תהילים', 'בקשת רחמים', 'שמות לתפילה', 'סגולה']],
	['judaism', ['תפילין', 'מזוזה', 'ספר תורה', 'טלית', 'ציצית', 'סידורים', 'ספרי קודש']],
	['holidays', ['שבת', 'חג', 'סוכה', 'סוכות', 'פסח', 'חנוכה', 'פורים', 'ארבעת המינים']],
	['events', ['אירוע', 'שמחות', 'הגברה', 'שולחנות', 'כיסאות', 'קישוט', 'מפות']],
	['money', ['הלוואה', 'הלוואות', 'כספים', 'קופת', 'צדקה', 'החזר']],
	['clothing', ['ביגוד', 'בגדים', 'שמלות', 'חליפות', 'הנעלה', 'נעליים']],
	['books', ['ספרים', 'ספריית', 'השאלת ספרים']],
	['furniture', ['ריהוט', 'רהיטים', 'מיטות', 'ארונות', 'שולחן']],
	['food', ['מזון', 'אוכל', 'סעודות', 'מנות חמות', 'סלי מזון']],
	['electronics', ['מחשב', 'מחשבים', 'חשמל', 'מקרר', 'תנור', 'מכשירי']],
	['transport', ['רכב', 'הסעה', 'הסעות', 'טרמפ', 'אופניים']],
	['hosting', ['אירוח', 'לינה', 'דירות אירוח', 'מיטות אירוח']],
	['toys', ['צעצוע', 'משחקים', 'משחקייה']],
	['tools', ['כלי עבודה', 'כלים', 'מקדחה', 'סולם', 'שואב']],
];

export function guessCategory(text: string): string {
	const norm = normalizeHebrew(text);
	for (const [key, words] of CATEGORY_KEYWORDS) {
		if (words.some((w) => norm.includes(normalizeHebrew(w)))) return key;
	}
	return 'other';
}

// ---------- ניקוי כותרות ----------

/** סיומות שנראות כמו שם אתר/מדריך ולא חלק משם הגמ"ח */
const SITE_SUFFIX_RE = /(\.|www|אתר|מדריך|אינדקס|פורטל|דירוג|facebook|פייסבוק|youtube|whatsapp)/i;

/** מנקה כותרת תוצאת חיפוש לשם גמ"ח: מפצל על מפרידי אתרים, מעדיף את
 *  המקטע שמכיל "גמ"ח", ומשמיט מקטע אחרון שנראה כמו שם האתר. */
export function cleanTitle(title: string): string {
	let s = title.replace(/\s+/g, ' ').trim();
	const parts = s
		.split(/\s+[|•·»«]+\s+|\s+[-–—]\s+/)
		.map((p) => p.trim())
		.filter(Boolean);
	if (parts.length > 1) {
		const withGemach = parts.filter((p) => containsGemach(p));
		if (withGemach.length > 0) {
			s = withGemach[0];
		} else {
			// בלי "גמ"ח" באף מקטע — משמיטים מקטע אחרון שנראה כמו שם אתר
			const kept = SITE_SUFFIX_RE.test(parts[parts.length - 1]) ? parts.slice(0, -1) : parts;
			s = kept.join(' - ');
		}
	}
	s = s.replace(/^[\s\-–—:,.]+|[\s\-–—:,.]+$/g, '');
	return s.length > 90 ? s.slice(0, 90).trim() : s;
}
