import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { verifyGeoToken } from '$lib/server/claimInvite';
import { getGemachById, patchGemachGeo, setGemachPin } from '$lib/server/db';
import { geocodeAddress, hasValidCoords, inServiceArea, resolveGemachCoords } from '$lib/server/geocode';
import { isApproxGeo } from '$lib/gemachData';

// עמוד "אשרו / דייקו את מיקום הגמ"ח במפה" — מקישור ה-SMS (ראה geoJob.ts)
// או מכפתור "דקור במפה" של האדמין. האסימון חתום לגמ"ח אחד, ולכן אין צורך
// בהתחברות: מי שמחזיק בקישור יכול רק להזיז את הפין של הגמ"ח הזה.

export const load: PageServerLoad = async ({ params }) => {
    const id = verifyGeoToken(params.token);
    const g = id ? await getGemachById(id) : null;
    if (!g) return { state: 'invalid' as const };

    const placed = hasValidCoords(g.lat, g.lng);
    // בלי פין — המפה נפתחת על היישוב (או על כל הארץ), והבעלים דוקר בעצמו
    let center = placed ? { lat: g.lat as number, lng: g.lng as number } : null;
    if (!center && g.city) {
        const c = await resolveGemachCoords({ city: g.city });
        if (c.lat !== null && c.lng !== null) center = { lat: c.lat, lng: c.lng };
    }

    return {
        state: 'ok' as const,
        gemach: {
            id: g.id,
            name: g.name,
            icon: g.icon ?? '🤝',
            city: g.city,
            neighborhood: g.neighborhood ?? '',
            address: g.address ?? '',
            hideAddress: !!g.hideAddress,
        },
        placed,
        approx: placed && isApproxGeo(g.geo?.p),
        confirmed: !!g.geo?.ok,
        center,
    };
};

function readPoint(fd: FormData): { lat: number; lng: number } | null {
    const lat = Number(fd.get('lat'));
    const lng = Number(fd.get('lng'));
    if (!fd.get('lat') || !fd.get('lng') || !Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return inServiceArea(lat, lng) ? { lat, lng } : null;
}

export const actions: Actions = {
    // "המיקום נכון" — מאשר את הפין הקיים כמו שהוא
    confirm: async ({ params }) => {
        const id = verifyGeoToken(params.token);
        const g = id ? await getGemachById(id) : null;
        if (!g || !hasValidCoords(g.lat, g.lng)) return fail(400, { error: 'אין עדיין מיקום לאשר — סמנו נקודה על המפה' });
        const now = new Date().toISOString();
        await patchGemachGeo(g.id, { p: 'pin', ok: now, src: 'owner' });
        return { saved: true };
    },

    // פין חדש שנדקר במפה (+ שכונה/כתובת אם הושלמו)
    save: async ({ params, request }) => {
        const id = verifyGeoToken(params.token);
        if (!id) return fail(400, { error: 'הקישור אינו תקין' });
        const fd = await request.formData();
        const pt = readPoint(fd);
        if (!pt) return fail(400, { error: 'סמנו נקודה על המפה (בתוך הארץ)' });
        const clip = (k: string) => String(fd.get(k) ?? '').trim().slice(0, 120);
        const ok = await setGemachPin(id, {
            ...pt,
            neighborhood: clip('neighborhood'),
            address: clip('address'),
            src: 'owner',
        });
        return ok ? { saved: true } : fail(400, { error: 'השמירה נכשלה — נסו שוב' });
    },

    // חיפוש כתובת: רק מזיז את הפין במפה, לא שומר
    find: async ({ params, request }) => {
        const id = verifyGeoToken(params.token);
        if (!id) return fail(400, { error: 'הקישור אינו תקין' });
        const fd = await request.formData();
        const q = String(fd.get('q') ?? '').trim().slice(0, 200);
        if (!q) return fail(400, { findError: 'כתבו כתובת לחיפוש' });
        const hit = await geocodeAddress(q);
        return hit ? { found: hit } : fail(404, { findError: 'לא מצאנו את הכתובת — אפשר פשוט לגעת במקום הנכון במפה' });
    },
};
