// ============================================================
// geocode.ts — המרת כתובת/עיר לקואורדינטות (lat/lng) בצד השרת.
//
// למה: כדי שגמ"ח יופיע על המפה של "קהילה בשכונה" (אותו אוסף items ב-Strapi)
// וייספר במונה "פרטים במפה", הפריט צריך lat/lng *שמורים* עליו.
//
// הגיאוקודר "החכם":
//   • שני ספקים חינמיים: Nominatim (ראשי) ו-Photon (גיבוי) — שניהם OpenStreetMap.
//   • countrycodes=il,ps — בלי ps יישובי יהודה ושומרון (נווה דניאל, ביתר עילית…)
//     פשוט לא נמצאים, כי ב-OSM הם מסומנים תחת קוד מדינה אחר.
//   • סולם ניסיונות מהמדויק לגס: רחוב+מספר+עיר → רחוב+עיר → שכונה+עיר → עיר.
//     השכונה לא נכנסת לשאילתת הרחוב — "גוש עציון" בשדה השכונה הפיל את כולה.
//   • כתיב מלא/חסר: נווה/נוה, ישיבה/ישבה — מנסים את שתי הצורות.
//   • אימות: תוצאה שלא יושבת ביישוב המבוקש נדחית ("נוה דניאל" החזיר פעם
//     רחוב "מוריץ דניאל" בתל אביב) — עדיף מרכז יישוב נכון מבית שגוי.
//   • מחזיר גם את הדיוק שהושג (GeoPrecision) — כך יודעים מי צריך דיוק מהבעלים.
// best-effort: לא זורק; null בכשל.
// ============================================================

import type { GeoPrecision } from '$lib/gemachData';

const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const PHOTON = 'https://photon.komoot.io/api/';
// מדיניות Nominatim מחייבת User-Agent שמזהה את האפליקציה
const UA = 'gofreeil-national-gemach/1.0 (https://gemach.gofreeil.com)';
// ישראל + יהודה ושומרון (lng מינ', lat מינ', lng מקס', lat מקס')
const BBOX = { minLng: 34.2, minLat: 29.4, maxLng: 35.95, maxLat: 33.45 };

/**
 * בדיקה בטוחה שזוג קואורדינטות תקין. חשוב: לא משתמשים ב-Number(x) כי
 * Number(null) === 0 (וגם Number('') === 0) — כלומר null/'' היו "עוברים"
 * כקואורדינטה 0 תקינה. כאן null/undefined/'' נדחים כראוי.
 */
export function hasValidCoords(lat: unknown, lng: unknown): boolean {
    return typeof lat === 'number' && Number.isFinite(lat)
        && typeof lng === 'number' && Number.isFinite(lng);
}

/** נקודה בתוך ישראל/יו"ש — שומר מפני פין שנדקר בטעות בים או בחו"ל */
export function inServiceArea(lat: number, lng: number): boolean {
    return lat >= BBOX.minLat && lat <= BBOX.maxLat && lng >= BBOX.minLng && lng <= BBOX.maxLng;
}

const RANK: Record<GeoPrecision, number> = { pin: 0, address: 1, street: 2, neighborhood: 3, city: 4 };
/** הגרוע מבין השניים — תוצאה לא יכולה להיות מדויקת יותר מהשאילתה ששלחנו */
function coarser(a: GeoPrecision, b: GeoPrecision): GeoPrecision {
    return RANK[a] >= RANK[b] ? a : b;
}

interface Hit {
    lat: number;
    lng: number;
    precision: GeoPrecision;
    /** כל שמות המקום שהספק החזיר — לאימות מול העיר */
    label: string;
}

/** השוואת שמות עבריים בלי ו/י (כתיב מלא/חסר), רווחים ופיסוק */
function squash(s: string): string {
    return s.toLowerCase().replace(/[^\p{L}]/gu, '').replace(/[וי]/g, '');
}

function nameMatches(hit: Hit, city: string): boolean {
    const c = squash(city);
    return !c || squash(hit.label).includes(c);
}

/** מרחק גס בק"מ (מספיק לסדרי גודל של יישוב) */
function km(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
    const dLat = (a.lat - b.lat) * 111;
    const dLng = (a.lng - b.lng) * 111 * Math.cos((a.lat * Math.PI) / 180);
    return Math.hypot(dLat, dLng);
}
// רדיוס שבו תוצאה עדיין נחשבת "ביישוב" — מכסה גם ערים גדולות (שכונות ירושלים עד ~8 ק"מ מהמרכז)
const CITY_RADIUS_KM = 10;

// Nominatim: לכל היותר בקשה אחת לשנייה מכל מופע שרת
let lastNominatim = 0;
async function nominatimGap(): Promise<void> {
    const wait = lastNominatim + 1100 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastNominatim = Date.now();
}

async function getJson(url: URL, headers: Record<string, string> = {}): Promise<unknown> {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 5000);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, signal: ctrl.signal });
        return res.ok ? await res.json() : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

function nominatimPrecision(addresstype: string): GeoPrecision {
    if (addresstype === 'road') return 'street';
    if (['suburb', 'neighbourhood', 'quarter', 'city_block', 'city_district', 'borough', 'residential', 'allotments'].includes(addresstype)) return 'neighborhood';
    if (['city', 'town', 'village', 'hamlet', 'municipality', 'isolated_dwelling', 'county', 'state', 'region', 'country', 'farm'].includes(addresstype)) return 'city';
    return 'address';
}

async function nominatim(params: Record<string, string>): Promise<Hit | null> {
    const url = new URL(NOMINATIM);
    for (const [k, v] of Object.entries({
        ...params,
        format: 'jsonv2',
        limit: '1',
        countrycodes: 'il,ps',
        'accept-language': 'he',
    })) url.searchParams.set(k, v);
    await nominatimGap();
    const arr = await getJson(url);
    const r = Array.isArray(arr) ? (arr[0] as Record<string, string> | undefined) : undefined;
    if (!r) return null;
    const lat = Number(r.lat);
    const lng = Number(r.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng) || !inServiceArea(lat, lng)) return null;
    return { lat, lng, precision: nominatimPrecision(r.addresstype ?? ''), label: r.display_name ?? '' };
}

function photonPrecision(type: string): GeoPrecision {
    if (type === 'house') return 'address';
    if (type === 'street') return 'street';
    if (type === 'district' || type === 'locality') return 'neighborhood';
    return 'city';
}

async function photon(q: string): Promise<Hit | null> {
    const url = new URL(PHOTON);
    url.searchParams.set('q', q);
    url.searchParams.set('limit', '1');
    url.searchParams.set('bbox', `${BBOX.minLng},${BBOX.minLat},${BBOX.maxLng},${BBOX.maxLat}`);
    const j = (await getJson(url)) as { features?: Array<{ geometry?: { coordinates?: number[] }; properties?: Record<string, string> }> } | null;
    const f = j?.features?.[0];
    const [lng, lat] = f?.geometry?.coordinates ?? [];
    if (typeof lat !== 'number' || typeof lng !== 'number' || !inServiceArea(lat, lng)) return null;
    const p = f?.properties ?? {};
    const label = [p.name, p.street, p.district, p.locality, p.city, p.county].filter(Boolean).join(', ');
    return { lat, lng, precision: photonPrecision(p.type ?? ''), label };
}

/** צורות כתיב של שם יישוב: כפי שנכתב, ובכתיב חסר (וו→ו, יי→י) / מלא (ו→וו) */
function spellings(name: string): string[] {
    const out = [name];
    const defective = name.replace(/וו/g, 'ו').replace(/יי/g, 'י');
    if (defective !== name) out.push(defective);
    // "נוה" → "נווה" — ו בודדת אחרי האות הראשונה של מילה (נוה, נוף, גולן…)
    const plene = name.replace(/(^|\s)(\p{L})ו(?!ו)(?=\p{L})/gu, '$1$2וו');
    if (plene !== name && !out.includes(plene)) out.push(plene);
    return out;
}

type Accept = (hit: Hit) => boolean;

/** ניסיון אחד: Nominatim ואז Photon, עם אימות וחסם-דיוק */
async function attempt(
    nominatimParams: Record<string, string>,
    photonQuery: string,
    accept: Accept,
    floor: GeoPrecision,
): Promise<Hit | null> {
    for (const run of [() => nominatim(nominatimParams), () => photon(photonQuery)]) {
        const hit = await run();
        if (hit && accept(hit)) return { ...hit, precision: coarser(hit.precision, floor) };
    }
    return null;
}

// מרכזי יישובים — פעם אחת לכל מופע שרת (אצווה של אותה עיר לא חוזרת לספק)
const centerCache = new Map<string, Hit>();

/** מרכז היישוב — השם שהספק מחזיר חייב להכיל את שם היישוב (בכל כתיב) */
async function cityCenter(city: string): Promise<Hit | null> {
    const key = squash(city);
    const cached = centerCache.get(key);
    if (cached) return cached;
    for (const c of spellings(city)) {
        const hit = await attempt({ q: c }, c, (h) => nameMatches(h, city), 'city');
        if (hit) {
            centerCache.set(key, hit);
            return hit;
        }
    }
    return null;
}

/** geocoding של כתובת חופשית (לחיפוש בעמוד דקירת המפה). null בכשל/ללא תוצאה. */
export async function geocodeAddress(query: string): Promise<{ lat: number; lng: number } | null> {
    const q = query.trim();
    if (!q) return null;
    const hit = await attempt({ q }, q, () => true, 'address');
    return hit ? { lat: hit.lat, lng: hit.lng } : null;
}

export interface ResolvedCoords {
    lat: number | null;
    lng: number | null;
    /** null = לא נמצא מיקום */
    precision: GeoPrecision | null;
}

/**
 * גוזר קואורדינטות לגמ"ח, מהמדויק לגס:
 *   1. פין מפורש (lat/lng שכבר קיימים על הקלט) — מכובד כמו שהוא.
 *   2. רחוב + מספר ביישוב — בכל צורות הכתיב של שם היישוב.
 *   3. רחוב בלי מספר (מספר בית שלא קיים ב-OSM מפיל את כל השאילתה).
 *   4. שכונה ביישוב.
 *   5. מרכז היישוב.
 * תוצאה מתקבלת רק אם היא ביישוב המבוקש. precision:null = לא נמצא כלום.
 */
export async function resolveGemachCoords(input: {
    lat?: number | null;
    lng?: number | null;
    address?: string | null;
    neighborhood?: string | null;
    city?: string | null;
}): Promise<ResolvedCoords> {
    if (hasValidCoords(input.lat, input.lng)) {
        return { lat: input.lat as number, lng: input.lng as number, precision: 'pin' };
    }

    const address = (input.address ?? '').trim();
    const neighborhood = (input.neighborhood ?? '').trim();
    let city = (input.city ?? '').trim();
    const none: ResolvedCoords = { lat: null, lng: null, precision: null };
    const done = (h: Hit): ResolvedCoords => ({ lat: h.lat, lng: h.lng, precision: h.precision });

    // בלי עיר: מנסים את הכתובת/שכונה כמו שהן (אין מול מה לאמת, ולכן לכל היותר "שכונה")
    if (!city) {
        const q = [address, neighborhood].filter(Boolean).join(', ');
        if (!q) return none;
        const hit = await attempt({ q }, q, () => true, 'neighborhood');
        return hit ? done(hit) : none;
    }

    // כשמרכז היישוב ידוע — התוצאה חייבת לשבת לידו (שם לבד מטעה: יש רחוב
    // "ירושלים" בכל עיר). בלי מרכז — נשען על שם היישוב בתוצאה.
    let center = await cityCenter(city);
    // "עיר" שנכתבה עם תוספת חופשית ("נתניה לרוב", "ירושלים והסביבה") — מקצרים
    // מילה-מילה מהסוף עד שנמצא יישוב, וממשיכים איתו כעיר
    const words = city.split(/[\s,/()-]+/).filter(Boolean);
    for (let n = words.length - 1; !center && n >= 1; n--) {
        const shorter = words.slice(0, n).join(' ');
        center = await cityCenter(shorter);
        if (center) city = shorter;
    }
    const accept: Accept = (h) => (center ? km(h, center) <= CITY_RADIUS_KM : nameMatches(h, city));
    const cities = spellings(city);

    if (address) {
        const num = address.match(/\d+/)?.[0];
        const street = address.replace(/\d+[א-ת]?/g, ' ').replace(/[,\s]+/g, ' ').trim();
        for (const c of cities) {
            // Nominatim מבין "מספר רחוב" בשאילתה מובנית
            const nomStreet = num && street ? `${num} ${street}` : address;
            const hit = await attempt({ street: nomStreet, city: c }, `${address} ${c}`, accept, 'address');
            if (hit) return done(hit);
        }
        if (num && street) {
            for (const c of cities) {
                const hit = await attempt({ street, city: c }, `${street} ${c}`, accept, 'street');
                if (hit) return done(hit);
            }
        }
    }

    if (neighborhood) {
        for (const c of cities) {
            const q = `${neighborhood}, ${c}`;
            const hit = await attempt({ q }, q, accept, 'neighborhood');
            if (hit) return done(hit);
        }
    }

    return center ? done(center) : none;
}
