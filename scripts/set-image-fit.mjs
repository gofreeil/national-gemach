// ============================================================
// set-image-fit.mjs — קביעת מיקום-ותקריב (image_fit) לתמונה של גמ"ח ב-Strapi
// ------------------------------------------------------------
// אותו שדה שהטפסים כותבים (extra_fields.image_fit) — כאן לקביעה ידנית
// מהטרמינל, למשל לפריט שכבר קיים ועוד לא נערך דרך הטופס.
//
// המקרה שבשבילו נכתב: "פנויים ופניות קרית משה" — תמונת גלריה רחבה (2:1)
// שהמשבצת הריבועית חתכה למרכזה; הרצוי הוא הצד השמאלי (x=0):
//
//   node scripts/set-image-fit.mjs                          ← תצוגה מקדימה (dry-run)
//   STRAPI_TOKEN=xxxxx node scripts/set-image-fit.mjs --apply
//
// שימוש כללי (כל פריט/תמונה):
//   --id <documentId>   ברירת מחדל: ax8caf15z1y5uco1bdlifx9y (פנויים ופניות קרית משה)
//   --key <logo|0..4>   איזו תמונה — 'logo' או אינדקס בגלריה. ברירת מחדל: 0
//   --x/--y <0..100>    מיקום object-position באחוזים (0=שמאל/למעלה). ברירת מחדל: x=0, y=50
//   --z <1..3>          תקריב. ברירת מחדל: 1
//   --contain           "תמונה שלמה" — התמונה מוקטנת עד שכולה נכנסת, בלי חיתוך
//   --clear             מוחק את המיקום של המפתח (חזרה למרכז)
//   --apply             כתיבה בפועל (אחרת dry-run). דורש STRAPI_TOKEN עם הרשאת כתיבה.
//
// בטוח להריץ שוב (idempotent); משמר את שאר ה-extra_fields ב-PUT ממוזג.
// ============================================================

const STRAPI = 'https://api.gofreeil.com';

const TOKEN = process.env.STRAPI_TOKEN || '';
const APPLY = process.argv.includes('--apply');
const CLEAR = process.argv.includes('--clear');
const CONTAIN = process.argv.includes('--contain');

function argOf(name, fallback) {
    const i = process.argv.indexOf(`--${name}`);
    return i >= 0 && process.argv[i + 1] ? process.argv[i + 1] : fallback;
}

const ID  = argOf('id', 'ax8caf15z1y5uco1bdlifx9y');
const KEY = argOf('key', '0');
const FIT = {
    x: Math.min(100, Math.max(0, Number(argOf('x', '0')))),
    y: Math.min(100, Math.max(0, Number(argOf('y', '50')))),
    z: CONTAIN ? 1 : Math.min(3, Math.max(1, Number(argOf('z', '1')))),
    ...(CONTAIN ? { contain: true } : {}),
};

if (KEY !== 'logo' && !/^\d+$/.test(KEY)) {
    console.error(`מפתח לא חוקי: "${KEY}" — צריך 'logo' או אינדקס גלריה (0..4)`);
    process.exit(1);
}

const res = await fetch(`${STRAPI}/api/items/${ID}`);
if (!res.ok) {
    console.error(`GET item → ${res.status}: ${await res.text()}`);
    process.exit(1);
}
const item = (await res.json()).data;
if (!item) {
    console.error(`הפריט ${ID} לא נמצא`);
    process.exit(1);
}

const extra = { ...(item.extra_fields ?? {}) };
const current = (extra.image_fit && typeof extra.image_fit === 'object') ? extra.image_fit : {};
const nextMap = { ...current };
if (CLEAR) delete nextMap[KEY];
else nextMap[KEY] = FIT;
if (Object.keys(nextMap).length > 0) extra.image_fit = nextMap;
else delete extra.image_fit;

console.log(`פריט:  ${item.label} (${ID})`);
console.log(`לפני:  image_fit = ${JSON.stringify(current)}`);
console.log(`אחרי:  image_fit = ${JSON.stringify(nextMap)}`);

if (!APPLY) {
    console.log('\n(dry-run — לא נכתב דבר; הוסיפו --apply עם STRAPI_TOKEN לכתיבה)');
    process.exit(0);
}
if (!TOKEN) {
    console.error('חסר STRAPI_TOKEN — נדרש טוקן עם הרשאת כתיבה בשביל --apply');
    process.exit(1);
}

const put = await fetch(`${STRAPI}/api/items/${ID}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${TOKEN}` },
    body: JSON.stringify({ data: { extra_fields: extra } }),
});
if (!put.ok) {
    console.error(`PUT item → ${put.status}: ${await put.text()}`);
    process.exit(1);
}
console.log('\n✅ נכתב. הרענון באתר עשוי לקחת עד דקה (מטמון הרשימות).');
