// הפענוח עצמו עבר ל-$lib/gemachForm (טהור, משותף עם הלקוח שמנהל טיוטות).
// כאן נשארת רק ההודעה שמוצגת אחרי כשל שמירה מול Strapi.
export { parseGemachForm, isSafeImageSrc } from '$lib/gemachForm';

/**
 * הודעה קריאה לכשל שמירה. 413 מגיע מ-Strapi כשהרשומה (כולל התמונות שנשמרות
 * בתוכה כ-data URI) חורגת ממגבלת ה-JSON שלו — בלי זה האדמין רואה "נסה שוב"
 * ולא מבין שהתמונות הן הבעיה.
 */
export function saveErrorMessage(e: unknown, verb: 'יצירת' | 'עדכון'): string {
	const msg = e instanceof Error ? e.message : String(e);
	if (msg.includes('413') || /payload too large/i.test(msg)) {
		return 'הרשומה כבדה מדי לשמירה — הסר תמונה מהגלריה או השתמש בכתובת URL במקום העלאת קובץ.';
	}
	return `${verb} הגמ"ח נכשל. נסה שוב.`;
}
