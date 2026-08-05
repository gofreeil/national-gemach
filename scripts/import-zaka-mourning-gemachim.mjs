// ============================================================
// import-zaka-mourning-gemachim.mjs — סניפי "ציוד לבית האבל" של זק"א כגמ"חים
// ------------------------------------------------------------
// זק"א מפעילה רשת ארצית של גמ"חי צרכי אבלות — ספסלים, כסאות נמוכים, סידורים,
// ספרי הלכה, מיחמים, מזרונים וארונות קודש מיטלטלים — והרשימה מתפרסמת בדף אחד
// באתר שלהם. הסקריפט מייבא את כל הסניפים שמופיעים שם למאגר, בקטגוריית
// "אבלות" (mourning), כדי שיימצאו בחיפוש ובסינון לפי עיר ככל גמ"ח אחר.
//
// המקור: https://zaka.org.il/public_service/ציוד-לבית-האבל/  (נשלף 6.8.2026)
// מה שאין בדף — שעות פתיחה, מיילים, אתר לסניף — פשוט חסר כאן. הפרטים
// שמופיעים בדף הועתקו כלשונם; טלפון נוסף/כתובת שנייה נשמרים ב-notes.
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי כתיבה):
//   node scripts/import-zaka-mourning-gemachim.mjs
//
// יישום בפועל (כותב ל-Strapi — דורש טוקן עם הרשאת כתיבה):
//   node --env-file=.env scripts/import-zaka-mourning-gemachim.mjs --apply
//
// דגלים:
//   --apply         כתיבה בפועל (אחרת dry-run). דורש STRAPI_TOKEN.
//   --no-geocode    לדלג על גזירת קואורדינטות (ברירת המחדל: כן, דרך Nominatim
//                   עם מרווח של 1.2 שניות בין בקשות — כמדיניות השירות).
//
// בטוח להריץ שוב: כל סניף מזוהה לפי extra_fields.source_key (ובנפילה-אחורה
// לפי user_id). סניף שכבר יובא — מדולג, ולא נוצר כפול.
// ============================================================

// כתובת ה-Strapi המשותף — מקובעת לדומיין החי, זהה ל-src/lib/server/strapiClient.ts
const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';
const SOURCE = 'zaka';
const SOURCE_URL = 'https://zaka.org.il/public_service/%D7%A6%D7%99%D7%95%D7%93-%D7%9C%D7%91%D7%99%D7%AA-%D7%94%D7%90%D7%91%D7%9C/';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');
const GEOCODE = !process.argv.includes('--no-geocode');

// תיאור משותף לכל הסניפים — לקוח מהדף עצמו (רשימת הפריטים שבגמ"ח)
const BASE_DESCRIPTION =
    'סניף של גמ"ח צרכי אבלות שמפעילים מתנדבי זק"א. השאלה ללא עלות של ציוד ' +
    'לשבעת ימי האבל: ספסלים להושבת מנחמים, כסאות נמוכים לישיבת האבלים, ' +
    'מזרונים, מיחמים לשתייה חמה, סידורים בנוסח כל עדה ועדה, ספרי הלכה ומחשבה ' +
    'בענייני אבלות וארון קודש מיטלטל.';

const BASE_TAGS = [
    'אבלות', 'שבעה', 'בית האבל', 'זק"א',
    'כסאות אבלים', 'ספסלים', 'סידורים', 'ארון קודש',
];

// ------------------------------------------------------------
// הסניפים, כסדר הופעתם בדף.
//   key      — מזהה יציב לייבוא חוזר (נשמר ב-extra_fields.source_key)
//   branch   — שם הסניף כפי שמופיע בדף (לפעמים אזור ולא עיר)
//   city     — העיר לסינון באתר. באזורים — העיר שבכתובת עצמה.
//   manager  — "בהנהלת ..." מהדף
//   address  — הכתובת כפי שמופיעה בדף
//   phones   — [{ n: מספר, who: מי (אם צוין בדף) }]. הראשון הופך לטלפון הראשי,
//              והשאר נכנסים ל-notes. מספר נייד מועדף כראשי (בשביל וואטסאפ).
//   extra    — שורות נוספות ל-notes (כתובת שנייה וכד')
// ------------------------------------------------------------
const BRANCHES = [
    {
        key: 'har-hevron-darom', branch: 'דרום הר חברון', city: 'דרום הר חברון',
        manager: 'חגי בכר וראובן טל', address: 'מועצה הדתית הר חברון',
        phones: [{ n: '0547568450', who: 'חגי' }, { n: '0528990324', who: 'ראובן' }],
    },
    {
        key: 'efrat', branch: 'אפרת', city: 'אפרת',
        manager: 'בנג\'י עזיז', address: 'סמדר 2, מרכז החסד יד ביד',
        phones: [{ n: '054-4482194' }],
    },
    {
        key: 'ganei-modiin', branch: 'גני מודיעין', city: 'גני מודיעין',
        manager: 'אלעזר טויטו', address: 'שפת אמת 2',
        phones: [{ n: '055-5577270' }],
    },
    {
        key: 'netivot', branch: 'נתיבות', city: 'נתיבות',
        manager: 'יהודה ויצמן', address: 'רבי עקיבא 3',
        phones: [{ n: '058-5000118' }],
    },
    {
        key: 'elad', branch: 'אלעד', city: 'אלעד',
        manager: 'ישראל אותמזגין', address: 'רבי עקיבא',
        phones: [{ n: '052-8197890' }],
    },
    {
        key: 'netanya', branch: 'נתניה', city: 'נתניה',
        manager: 'אליעזר ליפשיץ', address: 'יצחק שדה 6',
        phones: [{ n: '053-2343711' }],
    },
    {
        key: 'harish', branch: 'חריש', city: 'חריש',
        manager: 'חיים אלגרבלי', address: 'ספיר 1',
        phones: [{ n: '050-5178441' }],
    },
    {
        key: 'afula', branch: 'עפולה', city: 'עפולה',
        manager: 'משה דאקס', address: 'הערבה 5',
        phones: [{ n: '052-2352668' }],
    },
    {
        key: 'tveria', branch: 'טבריה', city: 'טבריה',
        manager: 'שי לוי', address: 'משה שפירא 10',
        phones: [{ n: '050-8744448' }],
    },
    {
        key: 'beer-sheva', branch: 'באר שבע', city: 'באר שבע',
        manager: 'שמעון זגורי', address: '',
        phones: [{ n: '052-5493335', who: 'שמעון' }],
    },
    {
        key: 'kiryat-arba', branch: 'קריית ארבע', city: 'קריית ארבע',
        manager: 'יוסף דיין', address: 'מועצה דתית',
        phones: [{ n: '050-9961650' }, { n: '02-9961083', who: 'מועצה דתית' }],
    },
    {
        key: 'raanana', branch: 'רעננה', city: 'רעננה',
        manager: 'רועי סלומון', address: 'דב הוז 8',
        phones: [{ n: '052-4222333' }],
    },
    {
        key: 'rehovot', branch: 'רחובות', city: 'רחובות',
        manager: 'נוסקה ויצחק הומינר', address: 'דוד רמז 82',
        phones: [{ n: '052-6690500', who: 'נוסקה' }, { n: '052-7401062', who: 'יצחק הומינר' }],
        extra: ['נקודה נוספת: ההגנה 12 (יצחק הומינר).'],
    },
    {
        key: 'kiryat-yearim', branch: 'קרית יערים', city: 'קרית יערים',
        manager: 'דב בקשט', address: 'הרב א. גורדון 28',
        phones: [{ n: '054-5486533' }],
    },
    {
        key: 'beit-el', branch: 'בית אל', city: 'בית אל',
        manager: 'אסף ברוכי', address: 'בית כנסת אברהם אוהבי',
        phones: [{ n: '054-5408262' }],
    },
    {
        key: 'ofakim', branch: 'אופקים', city: 'אופקים',
        manager: 'ישראל רווח', address: 'הרצל 40',
        phones: [{ n: '054-8825655' }, { n: '050-7943415', who: 'בנימין' }],
    },
    {
        key: 'gedera', branch: 'גדרה', city: 'גדרה',
        manager: 'שלום אזרד', address: 'גמליאל 3',
        phones: [{ n: '050-4040610' }],
    },
    {
        key: 'shlomi', branch: 'שלומי', city: 'שלומי',
        manager: 'אברהם וזאנה', address: 'אזור תעשייה שלומי',
        phones: [{ n: '054-4324518' }],
    },
    {
        key: 'rekhasim', branch: 'רכסים', city: 'רכסים',
        manager: 'אברהם דנציגר', address: 'סביון 20',
        phones: [{ n: '052-7119800' }, { n: '04-9040535' }],
    },
    {
        key: 'meron', branch: 'מירון', city: 'מירון',
        manager: 'יוסי זליקוביץ', address: 'חסדאי שבתאי',
        phones: [{ n: '050-7587592' }],
    },
    {
        key: 'kochav-hashahar', branch: 'כוכב השחר', city: 'כוכב השחר',
        manager: 'נועם הורביץ', address: 'התירוש 17',
        phones: [{ n: '052-3664684' }, { n: '02-9941647' }],
    },
    {
        key: 'hadera', branch: 'חדרה', city: 'חדרה',
        manager: 'חזקי מנת ודוד בירנבוים', address: 'מרכז סיוע מתנדבי חדרה, הלל יפה 1',
        phones: [{ n: '050-9190776', who: 'חזקי מנת' }, { n: '050-4190800', who: 'דוד בירנבוים' }],
        extra: ['נקודה נוספת: הסיגלית 5 (דוד בירנבוים).'],
    },
    {
        key: 'gush-dan', branch: 'גוש דן', city: 'בני ברק',
        manager: 'שלמה ויספיש', address: 'החיד"א 8',
        phones: [{ n: '050-6501542' }, { n: '03-6199818' }],
    },
    {
        key: 'zichron-yaakov', branch: 'זכרון יעקב', city: 'זכרון יעקב',
        manager: 'אברהם גליק', address: 'ביאליק 5',
        phones: [{ n: '054-8477718' }, { n: '054-8131921' }],
    },
    {
        key: 'modiin-illit', branch: 'מודיעין עילית', city: 'מודיעין עילית',
        manager: '', address: 'שאגת אריה 21', floor: 'מינוס 3',
        phones: [{ n: '052-7631218' }, { n: '08-9740886' }],
        extra: ['הגמ"ח מתנהל לעילוי נשמת שמואל סגל ז"ל.'],
    },
    {
        key: 'emmanuel', branch: 'עמנואל', city: 'עמנואל',
        manager: 'יצחק וינברג', address: 'בנייני המועצה, כיכר הרמב"ם',
        phones: [{ n: '050-4112722' }],
    },
    {
        key: 'karmiel', branch: 'כרמיאל', city: 'כרמיאל',
        manager: 'ישראל ליכטנשטיין', address: 'צאלון 22',
        phones: [{ n: '050-4115558' }, { n: '077-3009040' }],
    },
    {
        key: 'haifa', branch: 'חיפה', city: 'חיפה',
        manager: 'ישראל שכטר ויחזקאל פרקש', address: 'רבי עקיבא 5',
        phones: [{ n: '0523759947', who: 'ישראל' }, { n: '052-8730770', who: 'חזקי' }],
    },
    {
        key: 'petah-tikva', branch: 'פתח תקווה', city: 'פתח תקווה',
        manager: 'אלי הולכרר', address: 'דרך החיים, בית העלמין',
        phones: [{ n: '054-2806168' }],
    },
    {
        key: 'rishon-lezion', branch: 'ראשון לציון', city: 'ראשון לציון',
        manager: 'זכי מדמון', address: 'בן צבי 6',
        phones: [{ n: '054-6728419' }],
    },
    {
        key: 'rosh-haayin', branch: 'ראש העין', city: 'ראש העין',
        manager: 'יאיר מדמון', address: 'הנשר 1',
        phones: [{ n: '054-9237784' }],
    },
    {
        key: 'tzfat', branch: 'צפת', city: 'צפת',
        manager: 'ברוך גולן', address: 'בית העלמין צפת',
        phones: [{ n: '054-7766580' }],
    },
    {
        key: 'gush-etzion', branch: 'גוש עציון', city: 'אלון שבות',
        manager: 'אמנון ראשי', address: 'מועצה אזורית גוש עציון',
        phones: [{ n: '053-7718723' }, { n: '02-9939918' }],
    },
    {
        key: 'beitar-illit', branch: 'ביתר עילית', city: 'ביתר עילית',
        manager: 'יוסי הולצמן ולוזי פרנקל', address: 'רמ"ק 5',
        phones: [{ n: '052-7600860', who: 'יוסי' }, { n: '052-8673962', who: 'לוזי' }],
    },
    {
        key: 'beit-shemesh', branch: 'בית שמש', city: 'בית שמש',
        manager: 'אברהם קאפ', address: 'שפת אמת 27', apartment: '3',
        phones: [{ n: '053-3111310' }, { n: '02-9991536' }],
    },
    {
        key: 'jerusalem', branch: 'ירושלים', city: 'ירושלים',
        manager: 'חיים יורוביץ', address: 'סורוצקין 42',
        phones: [{ n: '052-8222716', who: 'חיים' }, { n: '052-6305079', who: 'צבי' }],
    },
];

// ------------------------------------------------------------
// עזרים
// ------------------------------------------------------------

/** 0521234567 → 052-1234567, 021234567 → 02-1234567. מה שלא מזוהה נשאר כמו שהוא. */
function normalizePhone(raw) {
    const d = String(raw).replace(/\D/g, '');
    if (d.length === 10 && /^(05|07)/.test(d)) return `${d.slice(0, 3)}-${d.slice(3)}`;
    if (d.length === 9 && d.startsWith('0')) return `${d.slice(0, 2)}-${d.slice(2)}`;
    return String(raw).trim();
}

function buildItem(b) {
    const phones = b.phones.map((p) => ({ ...p, n: normalizePhone(p.n) }));
    const [primary, ...rest] = phones;

    const noteLines = [];
    for (const p of rest) noteLines.push(`טלפון נוסף: ${p.n}${p.who ? ` (${p.who})` : ''}`);
    if (b.extra) noteLines.push(...b.extra);

    const description = BASE_DESCRIPTION + (b.manager ? ` הסניף בהנהלת ${b.manager}.` : '');

    const extra_fields = {
        gmach_type: 'mourning',
        gmach_types: ['mourning'],
        tags: [...BASE_TAGS, b.city].filter(Boolean),
        link: SOURCE_URL,
        verified: true,
        source: SOURCE,
        source_key: b.key,
    };
    if (noteLines.length) extra_fields.notes = noteLines.join(' • ');
    if (b.floor) extra_fields.floor = b.floor;
    if (b.apartment) extra_fields.apartment = b.apartment;

    return {
        label: `גמ"ח ציוד לבית האבל – זק"א ${b.branch}`,
        category: CATEGORY,
        description,
        contact: b.manager || 'זק"א',
        phone: primary ? primary.n : '',
        address: b.address || '',
        icon: '🤍',
        color: 'amber',
        neighborhood: '',
        city: b.city,
        extra_fields,
        status1: 'active',
        // 'sheet:' = פריט מיובא, לא בבעלות שום משתמש — רק אדמין עורך אותו
        // (ראה isGemachOwner ב-src/lib/server/ownership.ts)
        user_id: `sheet:${SOURCE}:${b.key}`,
    };
}

function headers(withAuth) {
    return {
        'Content-Type': 'application/json',
        ...(withAuth && TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    };
}

/** שולף את כל הגמ"חים (פעילים + ממתינים), עמוד-אחר-עמוד */
async function fetchAllGemachim() {
    const out = [];
    const LIMIT = 100;
    for (let start = 0; start < 100000; start += LIMIT) {
        const url = `${STRAPI}/api/items?filters[category][$eq]=${CATEGORY}` +
            `&filters[status1][$in][0]=active&filters[status1][$in][1]=pending` +
            `&pagination[start]=${start}&pagination[limit]=${LIMIT}`;
        const res = await fetch(url, { headers: headers(false) });
        if (!res.ok) throw new Error(`GET items → ${res.status}: ${await res.text()}`);
        const json = await res.json();
        const batch = json.data ?? [];
        out.push(...batch);
        if (batch.length < LIMIT) break;
    }
    return out;
}

// --- geocoding: זהה במהותו ל-src/lib/server/geocode.ts ---
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';
const UA = 'gofreeil-national-gemach/1.0 (https://gemach.gofreeil.com)';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function nominatim(query) {
    try {
        const url = new URL(NOMINATIM);
        url.searchParams.set('q', query);
        url.searchParams.set('format', 'json');
        url.searchParams.set('limit', '1');
        url.searchParams.set('countrycodes', 'il');
        url.searchParams.set('accept-language', 'he');
        const res = await fetch(url, { headers: { 'User-Agent': UA } });
        if (!res.ok) return null;
        const arr = await res.json();
        if (!Array.isArray(arr) || arr.length === 0) return null;
        const lat = Number(arr[0].lat);
        const lng = Number(arr[0].lon);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
        return { lat, lng };
    } catch {
        return null;
    }
}

/** כתובת מלאה ואז מרכז העיר, כמו resolveGemachCoords. מכבד את מדיניות
 *  Nominatim (בקשה אחת לשנייה) — 1.2 שניות בין קריאות. */
async function resolveCoords(item) {
    if (item.address) {
        const hit = await nominatim([item.address, item.city, 'ישראל'].filter(Boolean).join(', '));
        await sleep(1200);
        if (hit) return hit;
    }
    if (item.city) {
        const hit = await nominatim([item.city, 'ישראל'].join(', '));
        await sleep(1200);
        if (hit) return hit;
    }
    return { lat: null, lng: null };
}

// ------------------------------------------------------------

async function main() {
    console.log(`[zaka] mode=${APPLY ? 'APPLY (writing to Strapi)' : 'DRY-RUN (read-only)'}  geocode=${GEOCODE}`);
    if (APPLY && !TOKEN) {
        console.error('ERROR: --apply requires the STRAPI_TOKEN environment variable (write-access token).');
        process.exit(1);
    }
    // טוקן חייב להיות ASCII (נכנס לכותרת Authorization). תו לא-ASCII = כמעט תמיד מציין־מקום שלא הוחלף.
    if (APPLY && /[^\x20-\x7E]/.test(TOKEN)) {
        console.error('ERROR: STRAPI_TOKEN מכיל תווים לא-ASCII — נראה שהודבק מציין־המקום במקום הטוקן האמיתי.');
        process.exit(1);
    }

    const existingItems = await fetchAllGemachim();
    console.log(`[zaka] fetched ${existingItems.length} gemachim from Strapi`);

    // מה כבר יובא — לפי source_key, ובנפילה-אחורה לפי user_id (אם extra_fields נדרס)
    const seen = new Set();
    for (const it of existingItems) {
        const k = (it.extra_fields ?? {}).source_key;
        if ((it.extra_fields ?? {}).source === SOURCE && k) seen.add(String(k));
        const uid = String(it.user_id ?? '');
        if (uid.startsWith(`sheet:${SOURCE}:`)) seen.add(uid.slice(`sheet:${SOURCE}:`.length));
    }
    console.log(`[zaka] already imported: ${seen.size}`);

    let created = 0, skipped = 0, failed = 0, located = 0;

    for (const b of BRANCHES) {
        if (seen.has(b.key)) {
            console.log(`[zaka] · דילוג (קיים): ${b.branch}`);
            skipped++;
            continue;
        }

        const item = buildItem(b);
        let lat = null, lng = null;
        if (GEOCODE) {
            const c = await resolveCoords(item);
            lat = c.lat; lng = c.lng;
            if (lat !== null) located++;
        }

        const label = `${item.label}  [${item.city}${lat !== null ? ' 📍' : ' ללא מיקום'}]  ${item.phone}`;
        if (!APPLY) {
            console.log(`[zaka] · ייווצר: ${label}`);
            continue;
        }

        try {
            const res = await fetch(`${STRAPI}/api/items`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({
                    data: { ...item, lat, lng, publishedAt: new Date().toISOString() },
                }),
            });
            if (!res.ok) throw new Error(`POST → ${res.status}: ${await res.text()}`);
            const json = await res.json();
            console.log(`[zaka] ✓ נוצר ${json.data?.documentId}: ${label}`);
            created++;
        } catch (e) {
            console.error(`[zaka] ✗ נכשל: ${b.branch} — ${e.message}`);
            failed++;
        }
    }

    console.log(`[zaka] סיכום: ${BRANCHES.length} סניפים בדף | נוצרו ${created} | דולגו ${skipped} | נכשלו ${failed}` +
        (GEOCODE ? ` | עם קואורדינטות ${located}` : ''));
    if (!APPLY) {
        console.log('[zaka] DRY-RUN only — nothing was written.');
        console.log('[zaka] to apply:  node --env-file=.env scripts/import-zaka-mourning-gemachim.mjs --apply');
    }
}

main().catch((e) => {
    console.error('[zaka] FATAL', e);
    process.exit(1);
});
