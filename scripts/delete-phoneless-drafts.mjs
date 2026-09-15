// ============================================================
// delete-phoneless-drafts.mjs — מחיקת טיוטות גמ"ח (status1='pending') בלי טלפון
// ------------------------------------------------------------
// טיוטה בלי מספר טלפון (לא ב-phone ולא ב-extra_fields.phone2) היא חסרת ערך:
// אין למי להתקשר, ואין מה לאשר. הסורק (automation) כבר לא מייצר כאלה
// (decision 'no_phone' ב-pipeline.ts); הסקריפט מנקה את מה שנוצר לפני כן.
//
//   node scripts/delete-phoneless-drafts.mjs            ← תצוגה מקדימה (dry-run)
//   STRAPI_TOKEN=xxxxx node scripts/delete-phoneless-drafts.mjs --apply
//
// לא נוגע בטיוטות עם טלפון, בפריטים פעילים, בנדחים או בטיוטות-אורח מהטופס
// (guest_claim) — אלה של אנשים אמיתיים שממתינים לפרסום; הן מודפסות לידיעה בלבד.
// המחיקה ב-Strapi סופית. טביעות-האצבע של הטיוטות נשארות בזיכרון האוטומציה
// ('imported'), ולכן הסורק לא ייבא אותן שוב.
// ============================================================

const STRAPI = 'https://api.gofreeil.com';
const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');

const hasText = (v) => typeof v === 'string' && v.trim() !== '';

async function listPendingDrafts() {
    const out = [];
    for (let page = 1; page <= 50; page++) {
        const q = new URLSearchParams({
            'filters[category][$eq]': 'gemachim',
            'filters[status1][$eq]':  'pending',
            'pagination[page]':       String(page),
            'pagination[pageSize]':   '100',
            'fields[0]': 'label', 'fields[1]': 'phone', 'fields[2]': 'city',
            'fields[3]': 'createdAt', 'fields[4]': 'user_id', 'fields[5]': 'extra_fields',
        });
        const res = await fetch(`${STRAPI}/api/items?${q}`, TOKEN ? { headers: { Authorization: `Bearer ${TOKEN}` } } : undefined);
        if (!res.ok) throw new Error(`GET items → ${res.status}: ${await res.text()}`);
        const json = await res.json();
        out.push(...(json.data ?? []));
        const pc = json.meta?.pagination?.pageCount ?? 1;
        if (page >= pc) break;
    }
    return out;
}

const drafts = await listPendingDrafts();
const targets = [];
const guests = [];
let withPhone = 0;
for (const it of drafts) {
    const extra = it.extra_fields ?? {};
    if (hasText(it.phone) || hasText(extra.phone2)) { withPhone++; continue; }
    (extra.guest_claim ? guests : targets).push(it);
}

console.log(`טיוטות ממתינות: ${drafts.length} | עם טלפון (נשארות): ${withPhone} | בלי טלפון למחיקה: ${targets.length}`);
for (const it of targets) {
    console.log(`  ✖ ${it.documentId}  ${(it.createdAt ?? '').slice(0, 10)}  ${it.city || '-'}  ${it.label}`);
}
if (guests.length) {
    console.log(`\nטיוטות-אורח בלי טלפון (לא נמחקות — לטיפול ידני ב-/admin/gemachim): ${guests.length}`);
    for (const it of guests) console.log(`  · ${it.documentId}  ${it.label}`);
}

if (targets.length === 0) { console.log('\nאין מה למחוק.'); process.exit(0); }
if (!APPLY) {
    console.log('\n(dry-run — לא נמחק דבר; הוסיפו --apply עם STRAPI_TOKEN למחיקה)');
    process.exit(0);
}
if (!TOKEN) {
    console.error('חסר STRAPI_TOKEN — נדרש טוקן עם הרשאת מחיקה בשביל --apply');
    process.exit(1);
}

let ok = 0, failed = 0;
for (const it of targets) {
    const res = await fetch(`${STRAPI}/api/items/${it.documentId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${TOKEN}` },
    });
    if (res.ok || res.status === 404) { ok++; console.log(`  🗑 נמחק: ${it.label}`); }
    else { failed++; console.error(`  ⚠ DELETE ${it.documentId} → ${res.status}: ${await res.text()}`); }
}
console.log(`\n✅ נמחקו ${ok}${failed ? ` | נכשלו ${failed}` : ''}. מסך הגילוי מתרענן עד דקה (מטמון הרשימות).`);
