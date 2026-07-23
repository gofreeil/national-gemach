// ============================================================
// feature-org-gemachim.mjs — סימון הארגונים המזוהים כ"מומלצים" (⭐) ב-Strapi
// ------------------------------------------------------------
// עדכון חד-פעמי (idempotent) שמסמן extra_fields.featured=true לגמ"חים שזוהו
// כארגונים אמיתיים (לב חב"ד, אחותי כלה) — אותם 18 שקיבלו לוגו ב-
// backfill-gemach-images.mjs. ההתאמה חיה ב-src/lib/gemachImages.ts (imagesForGemach),
// כך שהרשימה נשארת מקור-אמת אחד. כאן רק שכבת הקריאה/כתיבה מול Strapi.
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי כתיבה):
//   node --experimental-strip-types scripts/feature-org-gemachim.mjs
//
// יישום בפועל (כותב ל-Strapi — דורש טוקן עם הרשאת כתיבה):
//   STRAPI_TOKEN=xxxxx node --experimental-strip-types scripts/feature-org-gemachim.mjs --apply
//
// דגלים:
//   --apply    כתיבה בפועל (אחרת dry-run). דורש STRAPI_TOKEN.
//   --unstar   ההפך — מסיר את הסימון featured מאותם ארגונים (ביטול).
//
// בטוח להריץ שוב: מדלג על רשומה שכבר במצב הרצוי; משמר את שאר ה-extra_fields
// (כולל logo/images) ב-PUT ממוזג.
// ============================================================

import { imagesForGemach } from '../src/lib/gemachImages.ts';

// כתובת ה-Strapi המשותף — מקובעת לדומיין החי, זהה ל-src/lib/server/strapiClient.ts
const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');
const UNSTAR = process.argv.includes('--unstar');

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

/** בונה את התוכנית לרשומה בודדת: extra_fields ממוזג + מה השתנה (או null אם לא ארגון מזוהה) */
function planItem(item) {
    const extra = item.extra_fields ?? {};
    const asset = imagesForGemach({ name: item.label, link: extra.link });
    if (!asset) return null; // לא אחד מהארגונים המזוהים

    const isFeatured = extra.featured === true || extra.featured === 'true';
    const want = !UNSTAR;
    if (isFeatured === want) return { merged: extra, changes: [] }; // כבר במצב הרצוי

    const merged = { ...extra };
    if (want) merged.featured = true;
    else delete merged.featured;
    return { merged, changes: [want ? 'featured' : 'un-featured'] };
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
    console.log(`[feature] mode=${APPLY ? 'APPLY (writing to Strapi)' : 'DRY-RUN (read-only)'}  action=${UNSTAR ? 'un-feature' : 'feature'}`);
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
    console.log(`[feature] fetched ${items.length} active gemachim\n`);

    let matched = 0, changed = 0, applied = 0, skipped = 0, failed = 0;
    for (const item of items) {
        const plan = planItem(item);
        if (!plan) continue;
        matched++;
        const id = item.documentId;
        const name = item.label;
        const phone = item.phone ? '📞' : '  ';

        if (plan.changes.length === 0) {
            skipped++;
            console.log(`  = ${phone} ${id}  ${name}  (already ${UNSTAR ? 'un-featured' : 'featured'} — skip)`);
            continue;
        }
        changed++;
        console.log(`  ${APPLY ? '→' : '·'} ${phone} ${id}  ${name}  [${plan.changes.join(', ')}]`);
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
        `\n[feature] matched=${matched}  need-change=${changed}  already=${skipped}` +
        (APPLY ? `  applied=${applied}  failed=${failed}` : ''),
    );
    if (!APPLY) {
        console.log('[feature] DRY-RUN only — nothing was written.');
        console.log('[feature] to apply:  STRAPI_TOKEN=xxxxx node --experimental-strip-types scripts/feature-org-gemachim.mjs --apply');
    }
}

main().catch((e) => {
    console.error('[feature] FATAL', e);
    process.exit(1);
});
