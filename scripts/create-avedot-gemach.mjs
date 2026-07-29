// ============================================================
// create-avedot-gemach.mjs — "פינת האבדות" כגמ"ח אמיתי במאגר
// ------------------------------------------------------------
// עד היום פינת האבדות הייתה רכיב קשיח בקוד (AvedotBanner.svelte): אי אפשר
// היה לערוך אותה, היא לא הופיעה ב"הנכסים שלי" ולא הסתנכרנה ל"קהילה בשכונה".
// הסקריפט יוצר אותה כפריט Strapi רגיל בקטגוריית הגמ"חים, על שם הבעלים —
// ומאותו רגע היא כרטיס גמ"ח רגיל לכל דבר (הבאנר הקשיח נסוג מעצמו, ראה
// hasAvedotGemach ב-src/routes/+page.svelte).
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי כתיבה):
//   node scripts/create-avedot-gemach.mjs
//
// יישום בפועל (כותב ל-Strapi — דורש טוקן עם הרשאת כתיבה):
//   $env:STRAPI_TOKEN="xxxxx"; node scripts/create-avedot-gemach.mjs --apply
//
// דגלים:
//   --apply           כתיבה בפועל (אחרת dry-run). דורש STRAPI_TOKEN.
//   --owner=<email>   מייל הבעלים (ברירת מחדל: yahavanter@gmail.com)
//
// בטוח להריץ שוב: אם הפריט כבר קיים (לפי הקישור ל-avedot.gofreeil.com) הוא
// לא נוצר שוב; אם הוא קיים בלי בעלים / עם בעלים אחר — רק ה-user_id יעודכן.
// ============================================================

// כתובת ה-Strapi המשותף — מקובעת לדומיין החי, זהה ל-src/lib/server/strapiClient.ts
const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';
const SITE = 'https://avedot.gofreeil.com';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');
const OWNER_EMAIL = (process.argv.find(a => a.startsWith('--owner='))?.slice('--owner='.length)
    || 'yahavanter@gmail.com').trim().toLowerCase();

// תבנית הבעלות של "קהילה בשכונה" — כך אותו משתמש עורך את הגמ"ח בשני האתרים
// (ראה ownerIdForSession ב-src/lib/server/ownership.ts)
const OWNER_ID = `credentials_${OWNER_EMAIL}`;

const ITEM = {
    label: 'פינת האבדות הארצית',
    category: CATEGORY,
    description:
        'אבד לכם משהו? מצאתם חפץ ומחפשים את הבעלים? לוח אבידות ומציאות ארצי — ' +
        'פרסום וחיפוש חינם, לכל הארץ. מיזם של רשת "יוצאים לחירות".',
    contact: 'יוצאים לחירות',
    phone: '',
    address: '',
    icon: '🔍',
    color: 'amber',
    neighborhood: '',
    city: 'כל הארץ',
    // בלי פין: "כל הארץ" אינה כתובת, ופין שגוי היה מטעה על מפת הקהילה
    lat: null,
    lng: null,
    extra_fields: {
        gmach_type: 'initiatives',      // "מיזמים חשובים לציבור"
        link: SITE,
        tags: ['אבידות', 'מציאות', 'ארצי', 'חינם'],
        verified: true,
    },
    status1: 'active',
    user_id: OWNER_ID,
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

/** הפריט הקיים של פינת האבדות, אם כבר נוצר — לפי הקישור, ובנפילה-אחורה לפי השם */
function findExisting(items) {
    return items.find(it => String((it.extra_fields ?? {}).link ?? '').includes('avedot.gofreeil.com'))
        ?? items.find(it => String(it.label ?? '').includes('פינת האבדות'))
        ?? null;
}

async function main() {
    console.log(`[avedot] mode=${APPLY ? 'APPLY (writing to Strapi)' : 'DRY-RUN (read-only)'}  owner=${OWNER_ID}`);
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
    console.log(`[avedot] fetched ${items.length} gemachim`);

    const existing = findExisting(items);

    if (existing) {
        const owner = (existing.user_id ?? '').trim();
        console.log(`[avedot] כבר קיים: ${existing.documentId}  "${existing.label}"  user_id=${owner || '(ריק)'}`);
        if (owner.toLowerCase() === OWNER_ID) {
            console.log('[avedot] הבעלות כבר נכונה — אין מה לעשות.');
            return;
        }
        console.log(`[avedot] ${APPLY ? '→' : '·'} עדכון user_id → ${OWNER_ID}`);
        if (APPLY) {
            const res = await fetch(`${STRAPI}/api/items/${existing.documentId}`, {
                method: 'PUT',
                headers: headers(true),
                body: JSON.stringify({ data: { user_id: OWNER_ID } }),
            });
            if (!res.ok) throw new Error(`PUT → ${res.status}: ${await res.text()}`);
            console.log('[avedot] ✓ הבעלות עודכנה');
        }
    } else {
        console.log(`[avedot] ${APPLY ? '→' : '·'} יצירת "${ITEM.label}" (${ITEM.city}, ${ITEM.extra_fields.gmach_type})`);
        if (APPLY) {
            const res = await fetch(`${STRAPI}/api/items`, {
                method: 'POST',
                headers: headers(true),
                body: JSON.stringify({ data: { ...ITEM, publishedAt: new Date().toISOString() } }),
            });
            if (!res.ok) throw new Error(`POST → ${res.status}: ${await res.text()}`);
            const json = await res.json();
            console.log(`[avedot] ✓ נוצר: ${json.data?.documentId}`);
        }
    }

    if (!APPLY) {
        console.log('[avedot] DRY-RUN only — nothing was written.');
        console.log('[avedot] to apply:  $env:STRAPI_TOKEN="xxxxx"; node scripts/create-avedot-gemach.mjs --apply');
    }
}

main().catch((e) => {
    console.error('[avedot] FATAL', e);
    process.exit(1);
});
