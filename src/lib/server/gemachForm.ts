import type { CreateGemachInput } from './db';

/**
 * כתובת תמונה מותרת: https/http, data URI של תמונה, או נתיב יחסי בתוך האתר.
 * חוסם `javascript:` וכל סכמה אחרת — הערך נכתב היישר ל-src בכרטיס.
 */
function isSafeImageSrc(src: string): boolean {
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

	// גלריה: כתובת בכל שורה. כתובות לא-תקינות נשמטות בשקט כדי ששורה אחת
	// שגויה לא תפיל שמירה של טופס שלם.
	const images = ((form.get('images') as string) ?? '')
		.split('\n')
		.map(s => s.trim())
		.filter(s => s !== '' && isSafeImageSrc(s));

	const input: CreateGemachInput = {
		name:         str('name') ?? '',
		category:     str('category') ?? '',
		city:         str('city') ?? '',
		neighborhood: str('neighborhood'),
		phone:        str('phone'),
		address:      str('address'),
		contact:      str('contact'),
		hours:        str('hours'),
		link:         str('link'),
		notes:        str('notes'),
		icon:         str('icon'),
		image:        str('image'),
		images,
		description:  ((form.get('description') as string) ?? '').trim(),
		tags,
		order:        orderNum !== undefined && !isNaN(orderNum) ? orderNum : undefined,
		featured:     form.get('featured') === 'true'
	};

	let error: string | undefined;
	if (!input.name)          error = 'יש להזין שם לגמ"ח';
	else if (!input.category) error = 'יש לבחור קטגוריה';
	else if (!input.city)     error = 'יש להזין עיר';
	else if (input.image && !isSafeImageSrc(input.image))
		error = 'כתובת התמונה אינה תקינה — נדרשת כתובת https:// או data:image';

	return { input, error };
}
