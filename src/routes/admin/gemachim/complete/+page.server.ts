import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
    getAllGemachim,
    patchGemachLocation,
    geocodeGemachById,
} from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { hasValidCoords } from '$lib/server/geocode';
import { cities } from '$lib/gemachData';
import type { Gemach } from '$lib/gemachData';

const PAGE_SIZE = 40;

/** האם לגמ"ח יש קואורדינטות תקינות — התנאי להופעה על מפת הקהילה ולספירתו במונה.
 *  שים לב: g.lat/g.lng מגיעים כ-null כשאין קואורדינטות, ולכן חובה בדיקת-סוג
 *  ולא Number(x) (כי Number(null)===0 "היה עובר" בטעות). */
function hasCoords(g: Pick<Gemach, 'lat' | 'lng'>): boolean {
    return hasValidCoords(g.lat, g.lng);
}

/** שדות חסרים שמונעים מהגמ"ח להופיע מדויק על המפה. */
function missingFields(g: Gemach): string[] {
    const miss: string[] = [];
    if (!g.city) miss.push('city');
    // צריך רחוב או שכונה כדי לדייק את הפין (אחרת רק מרכז העיר)
    if (!g.address && !g.neighborhood) miss.push('location');
    if (!hasCoords(g)) miss.push('coords');
    return miss;
}

export const load: PageServerLoad = async ({ url }) => {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const onlyMissing = url.searchParams.get('missing') === '1';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

    const [all, categories] = await Promise.all([
        getAllGemachim(),
        getCategories(),
    ]);

    const enriched = all.map(g => ({
        ...g,
        _missing: missingFields(g),
        _ready: hasCoords(g),
    }));

    let filtered = enriched;
    if (q) {
        filtered = filtered.filter(g =>
            g.name.toLowerCase().includes(q) ||
            g.city.toLowerCase().includes(q) ||
            (g.neighborhood?.toLowerCase().includes(q) ?? false) ||
            (g.address?.toLowerCase().includes(q) ?? false),
        );
    }
    if (onlyMissing) filtered = filtered.filter(g => g._missing.length > 0);

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, pages);
    const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

    // כל המזהים שאפשר לגזור להם קואורדינטות אך עדיין חסרים (בכל העמודים) —
    // לשימוש כפתור "גזור מיקום לכל החסרים" (אצווה עם המשך אוטומטי).
    const geocodableMissingIds = enriched
        .filter(g => !g._ready && !!g.city)
        .map(g => g.id);

    const summary = {
        managed: all.length,
        ready: enriched.filter(g => g._ready).length,
        missingCoords: enriched.filter(g => !g._ready).length,
        missingLocation: enriched.filter(g => !g.address && !g.neighborhood).length,
    };

    return {
        items,
        categories,
        cities,
        total,
        page: safePage,
        pages,
        pageSize: PAGE_SIZE,
        q: url.searchParams.get('q') ?? '',
        onlyMissing,
        summary,
        geocodableMissingIds,
    };
};

export const actions: Actions = {
    // שמירת פרטי מיקום של גמ"ח בודד + גזירת קואורדינטות מיידית
    save: async ({ request }) => {
        const fd = await request.formData();
        const id = fd.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const city = ((fd.get('city') as string) ?? '').trim();
        const neighborhood = ((fd.get('neighborhood') as string) ?? '').trim();
        const address = ((fd.get('address') as string) ?? '').trim();
        if (!city) return fail(400, { error: 'עיר היא שדה חובה למיקום על המפה', id });
        try {
            const coords = await patchGemachLocation(id, { city, neighborhood, address });
            return { success: true, id, geocoded: coords.lat !== null && coords.lng !== null };
        } catch (e) {
            console.error('[admin/complete] save failed:', e);
            return fail(500, { error: 'השמירה נכשלה. נסה שוב.', id });
        }
    },

    // אצווה קטנה של גזירת-מיקום למזהים שנשלחו (הלקוח ממשיך אוטומטית עד שמסיים).
    // מגבילים ל-8 בכל בקשה ומרווחים ~1 שנייה בין קריאות בכבוד למדיניות Nominatim.
    geocodeBatch: async ({ request }) => {
        const fd = await request.formData();
        const ids = ((fd.get('ids') as string) ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 8);
        if (ids.length === 0) return { success: true, done: 0, failed: 0, processed: [] as string[] };

        let done = 0;
        let failed = 0;
        const processed: string[] = [];
        for (let i = 0; i < ids.length; i++) {
            const id = ids[i];
            try {
                const c = await geocodeGemachById(id);
                if (c && c.lat !== null && c.lng !== null) done++;
                else failed++;
            } catch (e) {
                console.error('[admin/complete] geocodeBatch failed for', id, e);
                failed++;
            }
            processed.push(id);
            if (i < ids.length - 1) await new Promise(r => setTimeout(r, 1100));
        }
        return { success: true, done, failed, processed };
    },
};
