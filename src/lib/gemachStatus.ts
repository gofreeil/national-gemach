// ============================================================
// gemachStatus.ts — מצב הכרטיס בלשון של בעל הגמ"ח
//
// אותו מיפוי משרת את דף הגמ"ח, את האזור האישי ואת מסכי ההרשמה, כדי
// שהמשתמש יראה בכל מקום את אותו משפט בדיוק על אותו כרטיס. שתי שורות
// לכל מצב: התג הקצר (label) ומה הוא אומר בפועל (meaning) — בלי הרצאה.
//
// הסטטוסים מגיעים מ-status1 של Strapi (ראה db.ts): 'active' מוצג באתר,
// 'draft' מוסתר וממתין לפרסום, 'rejected'/'inactive' הוחלטו ע"י אדמין.
// verified = תו התקן, needsReview = כרטיס חדש מהטופס הציבורי שכבר באוויר
// והצוות עוד לא עבר עליו.
// ============================================================

export type GemachStatusTone = 'live' | 'wait' | 'off';

export interface GemachStatusInput {
	status?: string;
	verified?: boolean;
	needsReview?: boolean;
}

export interface GemachStatusView {
	label: string;
	meaning: string;
	tone: GemachStatusTone;
}

/** התג + המשמעות, לפי מצב הכרטיס. ברירת המחדל היא "באוויר" — פריט בלי
 *  status הוא פריט מהרשימה הסטטית, שמוצג באתר. */
export function gemachStatusView(g: GemachStatusInput): GemachStatusView {
	if (g.status === 'draft')
		return {
			label: '⏳ ממתין לפרסום',
			meaning: 'עדיין לא מוצג באתר. הצוות עובר על הפרטים ומפרסם.',
			tone: 'wait'
		};
	if (g.status === 'rejected')
		return {
			label: '⛔ לא פורסם',
			meaning: 'הצוות לא אישר את הכרטיס. אפשר לתקן את הפרטים ולשלוח שוב.',
			tone: 'off'
		};
	if (g.status && g.status !== 'active')
		return {
			label: '⏸ ירד מהאתר',
			meaning: 'הכרטיס לא מוצג כרגע במאגר.',
			tone: 'off'
		};
	if (g.verified)
		return {
			label: '✅ באוויר · תו תקן',
			meaning: 'מוצג במאגר ובאתר "קהילה בשכונה", עם תו התקן של הצוות.',
			tone: 'live'
		};
	if (g.needsReview)
		return {
			label: '● באוויר · בבדיקת צוות',
			meaning: 'כבר מוצג במאגר. הצוות עובר על הפרטים ויעניק תו תקן.',
			tone: 'live'
		};
	return {
		label: '● באוויר',
		meaning: 'מוצג במאגר ובאתר "קהילה בשכונה".',
		tone: 'live'
	};
}

/** צבעי התג לפי המצב — אותה שפה ויזואלית בכל המסכים */
export const GEMACH_TONE: Record<GemachStatusTone, string> = {
	live: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300',
	wait: 'border-amber-500/40 bg-amber-500/10 text-amber-300',
	off: 'border-rose-500/40 bg-rose-500/10 text-rose-300'
};

/** אותם צבעים בלי מסגרת — לשורות צפופות (רשימת הגמ"חים באזור האישי) */
export const GEMACH_TONE_TEXT: Record<GemachStatusTone, string> = {
	live: 'text-emerald-300',
	wait: 'text-amber-300',
	off: 'text-rose-300'
};
