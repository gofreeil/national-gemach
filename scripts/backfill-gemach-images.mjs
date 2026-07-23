// ============================================================
// backfill-gemach-images.mjs — הזרקת לוגואים/תמונות אמת לרשומות Strapi החיות
// ------------------------------------------------------------
// עדכון חד-פעמי (idempotent) שמוסיף extra_fields.logo/images לגמ"חים שזוהו
// כארגונים אמיתיים (לב חב"ד, אחותי כלה). ההתאמה + הנכסים חיים ב-
// src/lib/gemachImages.ts — כאן רק שכבת הקריאה/כתיבה מול Strapi.
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי כתיבה):
//   node --experimental-strip-types scripts/backfill-gemach-images.mjs
//
// יישום בפועל (כותב ל-Strapi — דורש טוקן עם הרשאת כתיבה):
//   STRAPI_TOKEN=xxxxx node --experimental-strip-types scripts/backfill-gemach-images.mjs --apply
//
// דגלים:
//   --apply   כתיבה בפועל (אחרת dry-run). דורש STRAPI_TOKEN.
//   --force   דריסת לוגו קיים (ברירת מחדל: מדלגים על רשומה שכבר יש לה לוגו).
//
// בטוח להריץ שוב ושוב: לא דורס לוגו קיים (אלא עם --force), ומוסיף לגלריה רק
// תמונות שעדיין אינן שם.
// ============================================================

import { imagesForGemach } from '../src/lib/gemachImages.ts';

// כתובת ה-Strapi המשותף — מקובעת לדומיין החי, זהה ל-src/lib/server/strapiClient.ts
const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');
const FORCE = process.argv.includes('--force');

function headers(withAuth) {
    return {
        'Content-Type': 'application/json',
        ...(withAuth && TOKEN ? { Authorization: `Bearer ${TOKEN}` } : {}),
    };
}

/** שולף את כל הגמ"חים הפעילים, עמוד-אחר-עמוד (ללא תקרה) */
async function fetchAllGemachim() {
    const out = [];
    const LIMIT = 100;
    for (let start = 0; start < 100000; start += LIMIT) {
        const url = `${STRAPI}/api/items?filters[category][$eq]=${CATEGORY}` +
            `&filters[status1][$eq]=active&pagination[start]=${start}&pagination[limit]=${LIMIT}`;
        const res = await fetch(url, { headers: headers(false) });
        if (!res.ok) throw new Error(`GET items → ${res.status}: ${await res.text()}`);
        const json = await res.json();
        const batch = json.data ?? [];
        out.push(...batch);
        if (batch.length < LIMIT) break;
    }
    return out;
}

/** בונה את התוכנית לרשומה בודדת: מה משתנה ב-extra_fields (או null אם אין התאמה) */
function planItem(item) {
    const extra = item.extra_fields ?? {};
    const asset = imagesForGemach({ name: item.label, link: extra.link });
    if (!asset) return null;

    const merged = { ...extra };
    const changes = [];

    const curLogo = typeof merged.logo === 'string' ? merged.logo.trim() : '';
    if (asset.image && (!curLogo || FORCE)) {
        merged.logo = asset.image;
        changes.push(curLogo ? 'logo(overwrite)' : 'logo');
    }

    if (asset.gallery && asset.gallery.length > 0) {
        const existing = Array.isArray(merged.images)
            ? merged.images.filter((x) => typeof x === 'string')
            : [];
        const add = asset.gallery.filter((u) => !existing.includes(u));
        if (add.length > 0) {
            merged.images = [...existing, ...add];
            changes.push(`gallery+${add.length}`);
        }
    }

    return { merged, changes };
}

async function putExtra(documentId, extra_fields) {
    const res = await fetch(`${STRAPI}/api/items/${documentId}`, {
        method: 'PUT',
        headers: headers(true),
        body: JSON.stringify({ data: { extra_fields } }),
    });
    if (!res.ok) throw new Error(`PUT ${documentId} → ${res.status}: ${await res.text()}`);
}

async function main() {
    console.log(`[backfill] mode=${APPLY ? 'APPLY (writing to Strapi)' : 'DRY-RUN (read-only)'}  force=${FORCE}`);
    if (APPLY && !TOKEN) {
        console.error('ERROR: --apply requires the STRAPI_TOKEN environment variable (write-access token).');
        process.exit(1);
    }
    // טוקן חייב להיות ASCII (הוא נכנס לכותרת Authorization). תו לא-ASCII = כמעט תמיד
    // מציין־המקום "הטוקן-שלך" שלא הוחלף, ואחרת השגיאה היא "Cannot convert argument to a ByteString".
    if (APPLY && /[^\x20-\x7E]/.test(TOKEN)) {
        console.error('ERROR: STRAPI_TOKEN מכיל תווים לא-ASCII — נראה שהודבק מציין־המקום ("הטוקן-שלך") במקום הטוקן האמיתי.');
        console.error('       הכנס את מפתח ה-API האמיתי של Strapi (ASCII בלבד) בין המרכאות ונסה שוב.');
        process.exit(1);
    }

    const items = await fetchAllGemachim();
    console.log(`[backfill] fetched ${items.length} active gemachim\n`);

    let matched = 0, changed = 0, applied = 0, skipped = 0, failed = 0;
    for (const item of items) {
        const plan = planItem(item);
        if (!plan) continue;
        matched++;
        const id = item.documentId;
        const name = item.label;

        if (plan.changes.length === 0) {
            skipped++;
            console.log(`  = ${id}  ${name}  (already enriched — skip)`);
            continue;
        }
        changed++;
        console.log(`  ${APPLY ? '→' : '·'} ${id}  ${name}  [${plan.changes.join(', ')}]`);
        if (APPLY) {
            try {
                await putExtra(id, plan.merged);
                applied++;
            } catch (e) {
                failed++;
                console.error(`      ✗ ${e.message}`);
            }
        }
    }

    console.log(
        `\n[backfill] matched=${matched}  need-change=${changed}  already=${skipped}` +
        (APPLY ? `  applied=${applied}  failed=${failed}` : ''),
    );
    if (!APPLY) {
        console.log('[backfill] DRY-RUN only — nothing was written.');
        console.log('[backfill] to apply:  STRAPI_TOKEN=xxxxx node --experimental-strip-types scripts/backfill-gemach-images.mjs --apply');
    }
}

main().catch((e) => {
    console.error('[backfill] FATAL', e);
    process.exit(1);
});
