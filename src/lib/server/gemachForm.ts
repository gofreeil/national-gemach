import type { CreateGemachInput } from './db';

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
		description:  ((form.get('description') as string) ?? '').trim(),
		tags,
		order:        orderNum !== undefined && !isNaN(orderNum) ? orderNum : undefined,
		featured:     form.get('featured') === 'true'
	};

	let error: string | undefined;
	if (!input.name)          error = 'יש להזין שם לגמ"ח';
	else if (!input.category) error = 'יש לבחור קטגוריה';
	else if (!input.city)     error = 'יש להזין עיר';

	return { input, error };
}
