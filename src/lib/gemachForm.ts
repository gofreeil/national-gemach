// פענוח טופס הגמ"ח — משותף לשרת (יצירה/עדכון ב-Strapi) וללקוח (שמירת טיוטה
// אוטומטית ב-localStorage, ראה $lib/formDraft). לכן הקובץ טהור: בלי גישה ל-DB,
// בלי משתני סביבה, ובלי import מ-$lib/server — מה שמאפשר לשני הצדדים לפענח
// את אותם שדות בדיוק, כך ששדה חדש בטופס נשמר בטיוטה בלי עבודה נוספת.

import { parseImageFitMap, type ImageFit } from '$lib/imageFit';

export interface CreateGemachInput {
    name: string;
    category: string;       // sub-category key (clothing, baby, ...) — הנושא הראשי
    categories?: string[];  // כל הנושאים, הראשי ראשון (extra_fields.gmach_types)
    city: string;
    neighborhood?: string;
    address?: string;
    phone?: string;
    contact?: string;
    description?: string;
    hours?: string;         // JSON של $lib/openingHours, או טקסט חופשי ישן
    floor?: string;
    apartment?: string;
    arrivalNotes?: string;
    icon?: string;
    image?: string;         // כתובת https או data URI — נשמר ב-extra_fields.logo
    link?: string;
    notes?: string;
    logoBase64?: string;
    images?: string[];
    /** מיקום-ותקריב פר-תמונה (extra_fields.image_fit): 'logo' | אינדקס גלריה */
    imageFit?: Record<string, ImageFit>;
    tags?: string[];
    order?: number;
    featured?: boolean;
    sourceId?: string;      // מזהה מקורי בעת ייבוא הרשימה הסטטית
    status?: string;        // ברירת מחדל 'active'
    lat?: number | null;    // פין מפורש (אחרת נגזר מהכתובת/עיר)
    lng?: number | null;
}

/**
 * כתובת תמונה מותרת: https/http, data URI של תמונה, או נתיב יחסי בתוך האתר.
 * חוסם `javascript:` וכל סכמה אחרת — הערך נכתב היישר ל-src בכרטיס.
 */
export function isSafeImageSrc(src: string): boolean {
	if (src.startsWith('/')) return true;
	if (/^data:image\/(png|jpe?g|gif|webp|avif|svg\+xml);base64,/i.test(src)) return true;
	try {
		return ['https:', 'http:'].includes(new URL(src).protocol);
	} catch {
		return false;
	}
}

/**
 * מפענח את נתוני טופס הגמ"ח (משותף ליצירה ולעריכה).
 * `input` מוחזר תמיד (לזריעת הטופס מחדש בעת שגיאה); `error` מוגדר אם חסר שדה חובה.
 */
export function parseGemachForm(form: FormData): { input: CreateGemachInput; error?: string } {
	const str = (k: string): string | undefined => {
		const v = ((form.get(k) as string) ?? '').trim();
		return v === '' ? undefined : v;
	};

	const orderRaw = ((form.get('order') as string) ?? '').trim();
	const orderNum = orderRaw === '' ? undefined : Number(orderRaw);

	const tags = ((form.get('tags') as string) ?? '')
		.split(/[\n,]/)
		.map(t => t.trim())
		.filter(Boolean);

	// גלריה: שדה `images` חוזר פעם אחת לכל תמונה (hidden input לכל אחת), אבל
	// מקבלים גם בלוק של כתובת-בכל-שורה. כתובות לא-תקינות נשמטות בשקט כדי
	// ששורה אחת שגויה לא תפיל שמירה של טופס שלם.
	const images = form.getAll('images')
		.flatMap(v => String(v).split('\n'))
		.map(s => s.trim())
		.filter(s => s !== '' && isSafeImageSrc(s));

	// מיקומי התמונות: JSON שנבנה בעורך המיקוד של הטופס. ערך לא-תקין נשמט
	// בשקט — מיקום הוא קישוט, ואסור שיפיל שמירה של טופס שלם.
	let imageFit: Record<string, ImageFit> | undefined;
	try {
		imageFit = parseImageFitMap(JSON.parse((form.get('image_fit') as string) || '{}'));
	} catch { /* JSON שבור → בלי מיקומים */ }

	// נושאים: הטופס שולח `categories` פעם אחת לכל נושא מסומן, הראשון הוא הראשי.
	// `category` נשאר כנפילה-לאחור לטפסים/סקריפטים שמכירים רק שדה בודד.
	const picked = form.getAll('categories')
		.map(v => String(v).trim())
		.filter(Boolean);
	const categoriesList = [...new Set([...picked, ...(str('category') ? [str('category')!] : [])])];

	const input: CreateGemachInput = {
		name:         str('name') ?? '',
		category:     categoriesList[0] ?? '',
		categories:   categoriesList,
		city:         str('city') ?? '',
		neighborhood: str('neighborhood'),
		phone:        str('phone'),
		address:      str('address'),
		contact:      str('contact'),
		hours:        str('hours'),
		floor:        str('floor'),
		apartment:    str('apartment'),
		arrivalNotes: str('arrival_notes'),
		link:         str('link'),
		notes:        str('notes'),
		icon:         str('icon'),
		image:        str('image'),
		images,
		imageFit,
		description:  ((form.get('description') as string) ?? '').trim(),
		tags,
		order:        orderNum !== undefined && !isNaN(orderNum) ? orderNum : undefined,
		featured:     form.get('featured') === 'true'
	};

	let error: string | undefined;
	if (!input.name)          error = 'יש להזין שם לגמ"ח';
	else if (!input.category) error = 'יש לבחור נושא אחד לפחות';
	else if (!input.city)     error = 'יש להזין עיר';
	else if (input.image && !isSafeImageSrc(input.image))
		error = 'כתובת התמונה אינה תקינה — נדרשת כתובת https:// או data:image';

	return { input, error };
}

/** האם יש בטיוטה משהו ששווה לשחזר (שדה תוכן אחד לפחות) */
export function hasContent(input: CreateGemachInput | null | undefined): boolean {
	if (!input) return false;
	return !!(
		input.name || input.city || input.description || input.phone || input.address ||
		input.contact || input.neighborhood || input.hours || input.link || input.notes ||
		input.icon || input.image || input.floor || input.apartment || input.arrivalNotes ||
		(input.tags?.length ?? 0) > 0 ||
		(input.images?.length ?? 0) > 0 ||
		(input.categories?.length ?? 0) > 0
	);
}
