// ============================================================
// create-yedidim-gemach.mjs — "ידידים – סיוע בדרכים" כגמ"ח אמיתי במאגר
// ------------------------------------------------------------
// ידידים הוא ארגון המתנדבים הארצי לעזרה ראשונה שאינה רפואית בדרכים ובבתים:
// פתיחת רכב נעול (כולל ילד שננעל בפנים), החלפת גלגל, הנעת רכב, חילוץ מבוץ
// ומהשטח וחילוץ ממעלית — בחינם, 24 שעות ביממה למעט שבת וחג, דרך מוקד 1230.
// הסקריפט יוצר אותו כפריט Strapi רגיל בקטגוריית הגמ"חים, ומאותו רגע הוא
// כרטיס גמ"ח לכל דבר: נספר באריח "רכב ותאונות", נמצא בחיפוש, יש לו דף משלו
// עם כפתור חיוג, והלוגו הרשמי עולה אוטומטית (ראה כלל yedidim-il.org
// ב-src/lib/gemachImages.ts).
//
// המקור: https://yedidim-il.org  (נשלף 9.8.2026)
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי כתיבה):
//   node scripts/create-yedidim-gemach.mjs
//
// יישום בפועל (כותב ל-Strapi — דורש טוקן עם הרשאת כתיבה):
//   $env:STRAPI_TOKEN="xxxxx"; node scripts/create-yedidim-gemach.mjs --apply
//
// בטוח להריץ שוב: אם הפריט כבר קיים (לפי הקישור ל-yedidim-il.org, ובנפילה-
// אחורה לפי השם) הוא לא נוצר שוב.
// ============================================================

// כתובת ה-Strapi המשותף — מקובעת לדומיין החי, זהה ל-src/lib/server/strapiClient.ts
const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';
const SITE = 'https://yedidim-il.org';
const SOURCE = 'yedidim';
const SOURCE_KEY = 'national';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');

const ITEM = {
    label: 'ידידים – סיוע בדרכים',
    category: CATEGORY,
    description:
        'ארגון מתנדבים ארצי לעזרה ראשונה שאינה רפואית, בחינם: ילד שננעל ברכב, ' +
        'פתיחת רכב נעול, החלפת גלגל, הנעת רכב שלא מתניע, נגמר הדלק, חילוץ מבוץ ' +
        'ומהשטח וחילוץ ממעלית תקועה. 65,000 מתנדבים פרוסים בכל הארץ, מדן ועד ' +
        'אילת, ומגיעים 24 שעות ביממה בכל ימות השבוע — למעט שבת וחג. ' +
        'חיוג למוקד: 1230 (מכל טלפון, בלי כוכבית).',
    contact: 'מוקד ידידים',
    phone: '1230',
    address: '',
    icon: '🚗',
    color: 'amber',
    neighborhood: '',
    city: 'כל הארץ',
    // בלי פין: "כל הארץ" אינה כתובת, ופין שגוי היה מטעה על מפת הקהילה
    lat: null,
    lng: null,
    extra_fields: {
        gmach_type: 'transport',        // "רכב ותאונות"
        link: SITE,
        tags: ['ידידים', 'סיוע בדרכים', 'חילוץ', 'רכב נעול', 'החלפת גלגל', 'ארצי', 'חינם'],
        verified: true,
        source: SOURCE,
        source_key: SOURCE_KEY,
    },
    status1: 'active',
    // ארגון חיצוני — לא נרשם על שם אף משתמש של האתר (אותה תבנית של ייבוא זק"א)
    user_id: `sheet:${SOURCE}:${SOURCE_KEY}`,
};

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

/** הפריט הקיים של ידידים, אם כבר נוצר — לפי הקישור, ובנפילה-אחורה לפי השם */
function findExisting(items) {
    return items.find((it) => String((it.extra_fields ?? {}).link ?? '').includes('yedidim-il.org'))
        ?? items.find((it) => String(it.label ?? '').includes('ידידים'))
        ?? null;
}

async function main() {
    console.log(`[yedidim] mode=${APPLY ? 'APPLY (writing to Strapi)' : 'DRY-RUN (read-only)'}`);
    if (APPLY && !TOKEN) {
        console.error('ERROR: --apply requires the STRAPI_TOKEN environment variable (write-access token).');
        process.exit(1);
    }
    // טוקן חייב להיות ASCII (נכנס לכותרת Authorization). תו לא-ASCII = כמעט תמיד מציין־מקום שלא הוחלף.
    if (APPLY && /[^\x20-\x7E]/.test(TOKEN)) {
        console.error('ERROR: STRAPI_TOKEN מכיל תווים לא-ASCII — נראה שהודבק מציין־המקום במקום הטוקן האמיתי.');
        process.exit(1);
    }

    const items = await fetchAllGemachim();
    console.log(`[yedidim] fetched ${items.length} gemachim`);

    const existing = findExisting(items);
    if (existing) {
        console.log(`[yedidim] כבר קיים: ${existing.documentId}  "${existing.label}" — אין מה לעשות.`);
        return;
    }

    console.log(`[yedidim] ${APPLY ? '→' : '·'} יצירת "${ITEM.label}" (${ITEM.city}, ${ITEM.extra_fields.gmach_type}, טלפון ${ITEM.phone})`);
    if (APPLY) {
        const res = await fetch(`${STRAPI}/api/items`, {
            method: 'POST',
            headers: headers(true),
            body: JSON.stringify({ data: { ...ITEM, publishedAt: new Date().toISOString() } }),
        });
        if (!res.ok) throw new Error(`POST → ${res.status}: ${await res.text()}`);
        const json = await res.json();
        console.log(`[yedidim] ✓ נוצר: ${json.data?.documentId}`);
    }

    if (!APPLY) {
        console.log('[yedidim] DRY-RUN only — nothing was written.');
        console.log('[yedidim] to apply:  $env:STRAPI_TOKEN="xxxxx"; node scripts/create-yedidim-gemach.mjs --apply');
    }
}

main().catch((e) => {
    console.error('[yedidim] FATAL', e);
    process.exit(1);
});
