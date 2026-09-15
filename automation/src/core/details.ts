// ============================================================
// details.ts — חילוץ פרטי הגמ"ח מטקסט חופשי: כתובת, שכונה, שעות, איש קשר,
//              טלפונים; ניקוי תיאור; כל הקטגוריות התואמות
// ============================================================
//
// למה: תוצאות החיפוש (ועמודי המקור) מכילים בדרך כלל את כל הפרטים שהטופס
// של "גמ"ח חדש" יודע לקבל — אבל כטקסט אחד רצוף:
//   "כתובת: סנהדריה המורחבת 106, ירושלים שכונה: סנהדריה טלפון: 02-... שעות פעילות: 9-13"
// עד עכשיו כל זה נשפך לשדה התיאור והאדמין העתיק ידנית. כאן מפרקים את הטקסט
// לשדות המבניים של הפריט, ומה שנשאר הופך לתיאור קריא.

import { extractAllPhones, guessCategoryKeys } from './text.ts';

export interface ExtractedDetails {
	address?: string;
	neighborhood?: string;
	city?: string;
	hours?: string;
	contact?: string;
	/** "קטגוריה: ציוד רפואי" — טקסט חופשי, לתיאור-גיבוי כשאין תיאור אמיתי */
	categoryText?: string;
	/** טלפונים ייחודיים לפי סדר הופעה (ספרות בלבד) */
	phones: string[];
}

// ---------- תוויות "שדה: ערך" ----------

type FieldKey = 'address' | 'neighborhood' | 'city' | 'hours' | 'contact' | 'phone' | 'category' | 'skip';

/** תווית → שדה. הסדר חשוב: הספציפי לפני הכללי ("שעות פעילות" לפני "שעות"). */
const LABELS: Array<[re: RegExp, key: FieldKey]> = [
	[/כתובת(?:\s+(?:הגמ["״']?ח|מדויקת(?:\s+לאיתור)?|מלאה|למשלוח|הסניף|המקום))?/y, 'address'],
	[/שכונה|שכונת\s*מגורים/y, 'neighborhood'],
	[/עיר|יישוב|ישוב/y, 'city'],
	[/שעות(?:\s+(?:פעילות|פתיחה|קבלה|מענה|הפעילות|הפתיחה))?(?:\s*\/\s*פרטים)?|קבלת\s+קהל|זמני\s+(?:פעילות|פתיחה)/y, 'hours'],
	[/איש\s+קשר|אשת\s+קשר|לפרטים(?:\s+נוספים)?|פרטים\s+אצל|אחראי(?:ת)?|מנהל(?:ת)?/y, 'contact'],
	// "טלפונים" נכתב בנו"ן רגילה, "טלפון" בסופית — שתיהן
	[/טלפו[ןנ](?:ים)?(?:\s+(?:ליצירת\s+קשר|לפרטים|לבירורים|נוסף))?|נייד|פלאפון|טל["״']?/y, 'phone'],
	// תוויות שרק מסמנות סוף ערך — לא נשמרות
	[/קטגוריה|קטגוריות|תחום|סוג\s+הגמ["״']?ח/y, 'category'],
	[/מדינה|אי?זור(?:\s+הגמ["״']?ח)?|פקס|מייל|דוא["״']?ל|אימייל|אתר(?:\s+אינטרנט)?|תגיות|מחיר|הערות|עלות|תשלום|מדד|תיאור|פרטים\s+נוספים|דירוג|ביקורות|המלצות|שיתוף|מקור/y, 'skip'],
];

interface LabelHit { start: number; valueStart: number; key: FieldKey }

/** מוצא את כל התוויות "X:" בטקסט (גם עם נקודתיים או קו מפריד אחריהן) */
function findLabels(text: string): LabelHit[] {
	const hits: LabelHit[] = [];
	// תווית מתחילה בגבול מילה: תחילת טקסט / רווח / פיסוק
	const boundary = /(?:^|[\s|•·,.;()\[\]])/g;
	let b: RegExpExecArray | null;
	while ((b = boundary.exec(text)) !== null) {
		// התאמה ריקה (^) לא מקדמת את lastIndex מעצמה — בלי זה לולאה אינסופית
		if (b[0].length === 0) boundary.lastIndex++;
		const pos = b.index + b[0].length;
		if (pos >= text.length) break;
		for (const [re, key] of LABELS) {
			re.lastIndex = pos;
			const m = re.exec(text);
			if (!m || m.index !== pos) continue;
			// אחרי התווית חייבים נקודתיים (או "-" / "–") — אחרת זו סתם מילה במשפט
			const after = text.slice(pos + m[0].length, pos + m[0].length + 4);
			const sep = /^\s*[:：\-–]\s*/.exec(after);
			if (!sep) continue;
			hits.push({ start: pos, valueStart: pos + m[0].length + sep[0].length, key });
			boundary.lastIndex = pos + m[0].length;
			break;
		}
	}
	return hits;
}

const MAX_VALUE = 90;

/** ניקוי ערך שחולץ: פיסוק תלוי בסוף, "ישראל" בסוף כתובת, גרשיים עודפים */
function tidy(value: string): string {
	return value
		.replace(/\s+/g, ' ')
		.replace(/^[\s,.;:\-–|•·]+|[\s,.;:\-–|•·]+$/g, '')
		.trim();
}

function tidyAddress(value: string, city?: string): string | undefined {
	const v = stripCityFromAddress(tidy(value).replace(/,?\s*ישראל$/, ''), city);
	// כתובת שהיא רק מספר או קצרה מדי — אין בה מידע
	if (!v || v.length < 3 || /^\d+$/.test(v)) return undefined;
	return v.slice(0, MAX_VALUE);
}

/** "סנהדריה 106, ירושלים" → "סנהדריה 106" — העיר יושבת בשדה משלה */
export function stripCityFromAddress(address: string | undefined, city?: string): string | undefined {
	if (!address) return address;
	let v = address;
	if (city) v = v.replace(new RegExp(`(?:^|[,\\s])\\s*ב?${escapeRe(city)}\\s*$`), '');
	v = tidy(v);
	return v || undefined;
}

function escapeRe(s: string): string {
	return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** מפרק טקסט חופשי לשדות הפריט. הטקסט יכול להיות שורה אחת (snippet) או
 *  עמוד שלם (innerText); ערך נגמר בתווית הבאה, בשורה חדשה או במפריד. */
export function extractDetails(text: string, knownCity?: string): ExtractedDetails {
	const out: ExtractedDetails = { phones: extractAllPhones(text) };
	const hits = findLabels(text);
	for (let i = 0; i < hits.length; i++) {
		const hit = hits[i];
		if (hit.key === 'skip' || hit.key === 'phone') continue;
		const end = i + 1 < hits.length ? hits[i + 1].start : text.length;
		let raw = text.slice(hit.valueStart, Math.min(end, hit.valueStart + MAX_VALUE * 2));
		// ערך לא חוצה שורה או מפריד רשימה
		raw = raw.split(/\n|\s[|•·]\s|\s{3,}/)[0] ?? '';
		const value = tidy(raw);
		if (!value) continue;
		switch (hit.key) {
			case 'address':      out.address      ??= tidyAddress(value, knownCity ?? out.city); break;
			case 'neighborhood': out.neighborhood ??= value.slice(0, 40); break;
			case 'city':         out.city         ??= value.slice(0, 40); break;
			case 'hours':        out.hours        ??= value.slice(0, MAX_VALUE); break;
			case 'contact':      out.contact      ??= tidyContact(value); break;
			case 'category':     out.categoryText ??= value.slice(0, 40); break;
		}
	}

	// גיבויים בלי תוויות: "ברחוב בית ישראל 4" / "שכונת הר נוף" / "שעות פתיחה 9:00-13:00"
	if (!out.address) {
		// אות דירה אחרי המספר ("4 א") — רק אם היא לבד, לא תחילת מילה ("4 בשכונת")
		const m = /(?:^|[\s,(])(?:ב?רחוב|רח['׳]\s?)\s*((?:[א-ת"״'׳\-]+\s){1,4}\d{1,4}(?:\s?[א-ת](?![א-ת]))?)/.exec(text);
		if (m) out.address = tidyAddress(m[1], knownCity);
	}
	if (!out.neighborhood) {
		const m = /(?:^|[\s,(])(?:ב?שכונת)\s+((?:[א-ת"״'׳\-]+\s?){1,3})/.exec(text);
		if (m) out.neighborhood = tidy(m[1]).slice(0, 40) || undefined;
	}
	if (!out.hours) {
		const m = /(?:פתוח(?:ה)?|פעיל(?:ה)?|שעות\s+(?:פעילות|פתיחה|קבלה))\s*[:\-–]?\s*((?:בימים\s+)?[א-ת'׳\-–\s]{0,20}\d{1,2}[:.]?\d{0,2}\s*[-–עד]+\s*\d{1,2}[:.]?\d{0,2}[^\n|•·]{0,30})/.exec(text);
		if (m) out.hours = tidy(m[1]).slice(0, MAX_VALUE) || undefined;
	}
	return out;
}

/** איש קשר: שם של 1–4 מילים עבריות, בלי טלפון/מייל שנדבקו אליו */
function tidyContact(value: string): string | undefined {
	const v = tidy(value.replace(/[\d+()\-–]{6,}.*$/, '').replace(/\S+@\S+/, ''));
	if (!v || v.length < 2 || v.length > 40) return undefined;
	if (!/[א-ת]/.test(v)) return undefined;
	return v;
}

// ---------- תיאור ----------

/** שאריות של תבניות אתרים/מדריכים שנדבקות ל-snippet ואינן תיאור */
const JUNK_RE: RegExp[] = [
	/כתיבת תגובה/g,
	/\/?\s*מאת\s+[^\/|•]{2,40}\/?/g,
	/(?:ינואר|פברואר|מרץ|אפריל|מאי|יוני|יולי|אוגוסט|ספטמבר|אוקטובר|נובמבר|דצמבר)\s+\d{1,2},?\s+\d{4}/g,
	/עודכן לאחרונה\s*ב?-?\s*\d{1,2}\s+ל?[א-ת]+\s+\d{4}/g,
	/הצג\s+מספרי?\s+טלפון/g,
	/חזרה לתוצאות/g, /עדכן פרטי עסק/g, /פרטים נוספים/g, /נווט (?:לכתובת|ב-?Waze)/g,
	/הוסף המלצה/g, /שתפו:?/g, /קרא עוד/g, /לחץ כאן/g, /להמשך קריאה/g,
	/מכירים בעלי גמח\? הציעו להם להרשם ל[א-ת'׳]+!?/g,
	/יש לכם דעה זהב![^.!?]*[.!?]?/g,
	/רוצים שובר[^.!?]*[.!?]?/g,
	/\.{3,}|…/g,
	/[|•·]\s*/g,
];

/** תיאור קריא מתוך snippet/מטא: בלי שאריות תבנית, בלי בלוקי "שדה: ערך"
 *  שכבר פורקו לשדות, מקוצר לגבול מילה. */
export function cleanDescription(text: string, opts: { name?: string; max?: number } = {}): string {
	const max = opts.max ?? 400;
	let s = text.replace(/\s+/g, ' ').trim();
	// בלוקי "כתובת: ..." / "טלפון: ..." — פורקו לשדות, לא שייכים לתיאור
	const hits = findLabels(s);
	if (hits.length > 0) {
		let rebuilt = '';
		let cursor = 0;
		for (let i = 0; i < hits.length; i++) {
			rebuilt += s.slice(cursor, hits[i].start);
			const end = i + 1 < hits.length ? hits[i + 1].start : s.length;
			const segment = s.slice(hits[i].valueStart, end);
			// ערך של תווית נגמר במפריד; מה שאחריו הוא טקסט חופשי שנשמר
			const valueEnd = segment.search(/\s[|•·]\s|\s{3,}/);
			cursor = valueEnd >= 0 ? hits[i].valueStart + valueEnd : end;
		}
		rebuilt += s.slice(cursor);
		s = rebuilt;
	}
	for (const re of JUNK_RE) s = s.replace(re, ' ');
	s = s.replace(/\s+/g, ' ').replace(/^[\s,.;:\-–\/]+/, '').trim();
	// תיאור שהוא רק השם — אין בו תוכן
	if (opts.name && s.replace(/[^\wא-ת]+/g, '') === opts.name.replace(/[^\wא-ת]+/g, '')) s = '';
	if (s.length > max) {
		const cut = s.lastIndexOf(' ', max);
		s = s.slice(0, cut > max * 0.6 ? cut : max).trim();
	}
	return s;
}

/** האם התיאור נראה כמו שארית תבנית (קצר / רק פסיקים / מתחיל במבנה "שדה:") */
export function isWeakDescription(desc: string | undefined): boolean {
	if (!desc) return true;
	const d = desc.trim();
	if (d.length < 40) return true;
	const letters = (d.match(/[א-ת]/g) ?? []).length;
	return letters < d.length * 0.4;
}

// ---------- קטגוריות ----------

/** כל תת-הקטגוריות שהטקסט מזכיר, הראשית ראשונה; 'other' אם אין */
export function guessCategories(text: string): string[] {
	const keys = guessCategoryKeys(text);
	return keys.length > 0 ? keys.slice(0, 3) : ['other'];
}
