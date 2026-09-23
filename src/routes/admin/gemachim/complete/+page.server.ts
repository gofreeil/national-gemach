import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import {
    getAllGemachim,
    patchGemachLocation,
    geocodeGemachById,
} from '$lib/server/db';
import { getPublicCategories } from '$lib/server/adminStore';
import { withImageUrls } from '$lib/server/gemachSource';
import { hasValidCoords } from '$lib/server/geocode';
import { geoToken } from '$lib/server/claimInvite';
import { isGeoNotifyOff, runGeoJob, setGeoNotifyOff } from '$lib/server/geoJob';
import { smsEnabled } from '$lib/server/sms';
import { getAdminContext } from '$lib/server/admin';
import { cities, isApproxGeo } from '$lib/gemachData';
import type { Gemach } from '$lib/gemachData';

const PAGE_SIZE = 40;

/**
 * מצב המיקום של גמ"ח. אף אחד מהם אינו "חסר פרטים": מי שאין לו פין
 * יוצב אוטומטית (ה-cron היומי), ומי שלא נמצא לו מקום מקבל בקשה מהבעלים.
 *   exact   — על המפה, בית מדויק / נדקר ידנית
 *   approx  — על המפה, מיקום משוער (רחוב/שכונה/מרכז יישוב)
 *   queued  — עוד אין פין; יוצב בריצה האוטומטית הבאה
 *   owner   — לא נמצא מיקום; ממתין שהבעלים יסמן במפה
 */
type GeoState = 'exact' | 'approx' | 'queued' | 'owner';

function geoState(g: Gemach): GeoState {
    // g.lat/g.lng מגיעים כ-null כשאין קואורדינטות — חובה בדיקת-סוג, לא Number(x)
    if (hasValidCoords(g.lat, g.lng)) {
        // פריט ותיק בלי מטא-דאטה — אין דרך לדעת; לא מסמנים אותו כבעייתי
        return g.geo && isApproxGeo(g.geo.p) ? 'approx' : 'exact';
    }
    return g.geo && g.geo.p === null ? 'owner' : 'queued';
}

export const load: PageServerLoad = async ({ url }) => {
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
    const onlyOpen = url.searchParams.get('missing') === '1';
    const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);

    const [all, categories, notifyOff] = await Promise.all([
        getAllGemachim(),
        getPublicCategories(),
        isGeoNotifyOff(),
    ]);

    const enriched = all.map(g => ({
        ...g,
        _state: geoState(g),
        _ready: hasValidCoords(g.lat, g.lng),
        _pinHref: `/l/${geoToken(g.id)}`,
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
    // "רק לא מדויקים" — כל מה שלא יושב בבית מדויק במפה
    if (onlyOpen) filtered = filtered.filter(g => g._state !== 'exact');

    const total = filtered.length;
    const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    const safePage = Math.min(page, pages);
    // תמונות ככתובות endpoint ולא כ-data URI מוטמע — הרשימה נטענת מהר
    const items = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE).map(withImageUrls);

    // כל מי שעוד אין לו פין (בכל העמודים) — לכפתור "הצב עכשיו" (אצווה עם המשך אוטומטי)
    const geocodableMissingIds = enriched
        .filter(g => !g._ready)
        .map(g => g.id);

    const count = (s: GeoState) => enriched.filter(g => g._state === s).length;
    const summary = {
        managed: all.length,
        exact: count('exact'),
        approx: count('approx'),
        queued: count('queued'),
        owner: count('owner'),
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
        onlyMissing: onlyOpen,
        summary,
        geocodableMissingIds,
        notify: { off: notifyOff, sms: smsEnabled() },
    };
};

// ה-layout שומר רק על load — כל פעולה בודקת הרשאה בעצמה
export const actions: Actions = {
    // שמירת פרטי מיקום של גמ"ח בודד + גזירת קואורדינטות מיידית
    save: async ({ request, locals }) => {
        await getAdminContext(locals);
        const fd = await request.formData();
        const id = fd.get('id') as string;
        if (!id) return fail(400, { error: 'חסר מזהה' });
        const city = ((fd.get('city') as string) ?? '').trim();
        const neighborhood = ((fd.get('neighborhood') as string) ?? '').trim();
        const address = ((fd.get('address') as string) ?? '').trim();
        if (!city) return fail(400, { error: 'בלי עיר אי אפשר לאתר — דקרו במפה', id });
        try {
            const coords = await patchGemachLocation(id, { city, neighborhood, address });
            return { success: true, id, geocoded: coords.lat !== null && coords.lng !== null };
        } catch (e) {
            console.error('[admin/complete] save failed:', e);
            return fail(500, { error: 'השמירה נכשלה. נסה שוב.', id });
        }
    },

    // אצווה קטנה של הצבה (הלקוח ממשיך אוטומטית עד שמסיים). הגיאוקודר עצמו
    // שומר על מרווח של ~שנייה בין קריאות ל-Nominatim.
    geocodeBatch: async ({ request, locals }) => {
        await getAdminContext(locals);
        const fd = await request.formData();
        const ids = ((fd.get('ids') as string) ?? '')
            .split(',')
            .map(s => s.trim())
            .filter(Boolean)
            .slice(0, 3);
        if (ids.length === 0) return { success: true, done: 0, failed: 0, processed: [] as string[] };

        let done = 0;
        let failed = 0;
        const processed: string[] = [];
        for (const id of ids) {
            try {
                const c = await geocodeGemachById(id);
                if (c && c.lat !== null && c.lng !== null) done++;
                else failed++;
            } catch (e) {
                console.error('[admin/complete] geocodeBatch failed for', id, e);
                failed++;
            }
            processed.push(id);
        }
        return { success: true, done, failed, processed };
    },

    // הריצה היומית, עכשיו (הצבה + בקשות לבעלים שהגיע זמנן)
    runJob: async ({ locals }) => {
        await getAdminContext(locals);
        const r = await runGeoJob({ budgetMs: 40_000 });
        return { job: r };
    },

    notify: async ({ request, locals }) => {
        await getAdminContext(locals);
        const fd = await request.formData();
        await setGeoNotifyOff(fd.get('off') === '1');
        return { success: true };
    },
};
