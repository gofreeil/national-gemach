// ============================================================
// geocode.ts — המרת כתובת/עיר לקואורדינטות (lat/lng) בצד השרת.
//
// למה: כדי שגמ"ח יופיע על המפה של "קהילה בשכונה" (אותו אוסף items ב-Strapi)
// וייספר במונה "פרטים במפה", הפריט צריך lat/lng *שמורים* עליו. הפאנל הארצי
// לא כולל סימון פין על מפה, ולכן אנחנו גוזרים את הקואורדינטות מהכתובת/עיר.
//
// המקור: OpenStreetMap (Nominatim) — חינמי, ללא מפתח. best-effort: מחזיר null
// בכשל/ללא תוצאה, והגמ"ח נשמר גם בלי קואורדינטות (אפשר להשלים מאוחר יותר).
// זהה במהותו ל-geocode.ts של "קהילה בשכונה" כדי לשמור על אותה איכות מיקום.
// ============================================================

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
// מדיניות Nominatim מחייבת User-Agent שמזהה את האפליקציה
const UA = 'gofreeil-national-gemach/1.0 (https://gemach.gofreeil.com)';

/**
 * בדיקה בטוחה שזוג קואורדינטות תקין. חשוב: לא משתמשים ב-Number(x) כי
 * Number(null) === 0 (וגם Number('') === 0) — כלומר null/'' היו "עוברים"
 * כקואורדינטה 0 תקינה. כאן null/undefined/'' נדחים כראוי.
 */
export function hasValidCoords(lat: unknown, lng: unknown): boolean {
    return typeof lat === 'number' && Number.isFinite(lat)
        && typeof lng === 'number' && Number.isFinite(lng);
}

async function nominatim(query: string): Promise<{ lat: number; lng: number } | null> {
    try {
        const url = new URL(NOMINATIM);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1');
        url.searchParams.set('countrycodes', 'il');
        url.searchParams.set('accept-language', 'he');

        const ctrl = new AbortController();
        const timer = setTimeout(() => ctrl.abort(), 4000);
        const res = await fetch(url, {
            headers: { 'User-Agent': UA },
            signal: ctrl.signal,
        }).finally(() => clearTimeout(timer));

        if (!res.ok) return null;
        const arr = (await res.json()) as Array<{ lat: string; lon: string }>;
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const lat = Number(arr[0].lat);
        const lng = Number(arr[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}

/** geocoding של כתובת חופשית. best-effort: null בכשל/ללא תוצאה. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
    const q = query.trim();
    return q ? nominatim(q) : null;
}

/**
 * גוזר קואורדינטות לגמ"ח לפי סדר עדיפויות:
 *   1. פין מפורש (lat/lng שכבר קיימים על הקלט) — מכובד כמו שהוא.
 *   2. geocoding של הכתובת המלאה (כתובת + שכונה + עיר) — מדויק לרחוב.
 *   3. geocoding של העיר בלבד — מרכז העיר, גיבוי שתמיד קיים כשיש עיר.
 * מחזיר {lat:null,lng:null} רק אם אין מספיק מידע או שכל הניסיונות נכשלו.
 */
export async function resolveGemachCoords(input: {
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
}): Promise<{ lat: number | null; lng: number | null }> {
    // 1. פין מפורש (רק מספר אמיתי — null/'' לא ייחשבו פין ב-(0,0))
    if (hasValidCoords(input.lat, input.lng)) {
        return { lat: input.lat as number, lng: input.lng as number };
    }

    const address = (input.address ?? '').trim();
    const neighborhood = (input.neighborhood ?? '').trim();
    const city = (input.city ?? '').trim();

    // 2. כתובת מדויקת (רחוב + שכונה + עיר + "ישראל" לדיוק)
    if (address || neighborhood) {
        const q = [address, neighborhood, city, 'ישראל'].filter(Boolean).join(', ');
        const hit = await geocodeAddress(q);
        if (hit) return hit;
    }

    // 3. מרכז העיר
    if (city) {
        const hit = await geocodeAddress([city, 'ישראל'].join(', '));
        if (hit) return hit;
    }

    return { lat: null, lng: null };
}
