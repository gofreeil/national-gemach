import { fail, redirect } from '@sveltejs/kit';
import type { Actions } from './$types';
import { createGemach } from '$lib/server/db';
import { categories, cities } from '$lib/gemachData';

const KNOWN_CATEGORY_KEYS = new Set(categories.map(c => c.key));
const KNOWN_CITIES = new Set(cities);

export const actions: Actions = {
    default: async (event) => {
        const fd           = await event.request.formData();
        const name         = fd.get('name')?.toString().trim()         ?? '';
        const category     = fd.get('category')?.toString().trim()     ?? '';
        const city         = fd.get('city')?.toString().trim()         ?? '';
        const neighborhood = fd.get('neighborhood')?.toString().trim() ?? '';
        const address      = fd.get('address')?.toString().trim()      ?? '';
        const phone        = fd.get('phone')?.toString().trim()        ?? '';
        const contact      = fd.get('contact')?.toString().trim()      ?? '';
        const description  = fd.get('description')?.toString().trim()  ?? '';
        const hours        = fd.get('hours')?.toString().trim()        ?? '';
        const icon         = fd.get('icon')?.toString().trim()         || '🤝';
        const logoBase64   = fd.get('logo_base64')?.toString()         ?? '';
        const imagesJson   = fd.get('images_json')?.toString()         ?? '';

        let images: string[] = [];
        try {
            const parsed = JSON.parse(imagesJson || '[]');
            if (Array.isArray(parsed)) images = parsed.filter(s => typeof s === 'string');
        } catch {}

        if (!name)                              return fail(400, { error: 'יש למלא שם הגמ"ח' });
        if (!phone)                             return fail(400, { error: 'יש למלא טלפון' });
        if (!city)                              return fail(400, { error: 'יש לבחור עיר' });
        if (!KNOWN_CITIES.has(city))            return fail(400, { error: 'עיר לא תקינה' });
        if (!category || !KNOWN_CATEGORY_KEYS.has(category)) {
            return fail(400, { error: 'יש לבחור קטגוריה' });
        }

        try {
            await createGemach({
                name, category, city, neighborhood, address, phone, contact,
                description, hours, icon, logoBase64, images,
            });
        } catch (e) {
            console.error('[national-gemach/add] createGemach failed:', e);
            return fail(500, { error: 'שגיאה בשמירת הגמ"ח, נסה שוב' });
        }

        throw redirect(303, '/?added=1');
    },
};
