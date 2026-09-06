// ============================================================
// notify-donate-feature.mjs — הודעת SMS חד-פעמית לכל הגמ"חים: "מעתה אפשר
// להוסיף דרכי תרומה לכרטיס" (ביט / פייבוקס / העברה / הוראת קבע / קישור)
// ------------------------------------------------------------
// נמענים: כל טלפון נייד שמופיע באתר — phone + phone2 של הגמ"חים הפעילים
// ב-Strapi, ובנוסף הרשימה הסטטית (הגמ"חים שעוד לא יובאו ל-DB). מספר שחוזר
// בכמה גמ"חים מקבל הודעה אחת (על הגמ"ח הראשון). קווים נייחים מדולגים —
// SMS לא מגיע אליהם.
//
// ספק ה-SMS זהה ל-src/lib/server/sms.ts (SMSGate → Traccar → Twilio), לפי
// מה שמוגדר ב-env. משתני הסביבה נמשכים מ-Vercel:
//   vercel env pull .env.prod --environment=production
//
// הרצה (ברירת מחדל = תצוגה מקדימה בלבד, בלי שליחה):
//   node --experimental-strip-types --env-file=.env.prod scripts/notify-donate-feature.mjs
//
// בדיקה על מספר אחד (שולח הודעה אחת, על הגמ"ח הראשון ברשימה):
//   node --experimental-strip-types --env-file=.env.prod scripts/notify-donate-feature.mjs --apply --test 05XXXXXXXX
//
// שליחה לכולם:
//   node --experimental-strip-types --env-file=.env.prod scripts/notify-donate-feature.mjs --apply
//
// דגלים:
//   --apply        שליחה בפועל (אחרת dry-run).
//   --test <נייד>  שולח רק לנייד הזה (עם --apply). לבדיקת הנוסח לפני ההפצה.
//   --limit N      עוצר אחרי N נמענים (לשליחה בגלים).
//   --delay ms     השהיה בין הודעות (ברירת מחדל 1500 — לא להציף את הטלפון/הספק).
//   --managed-only רק גמ"חים מ-Strapi (בלי הרשימה הסטטית).
//
// בטוח להריץ שוב: כל מספר שנשלח נרשם ב-scripts/notify-donate-feature.sent.log
// (מוחרג מ-git) ומדולג בהרצה הבאה — נפילה באמצע לא גורמת להודעות כפולות.
// ============================================================

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { staticGemachim } from '../src/lib/staticGemachim.ts';

const STRAPI = 'https://api.gofreeil.com';
const CATEGORY = 'gemachim';
const SITE = 'https://gemach.gofreeil.com';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const MANAGED_ONLY = args.includes('--managed-only');
const flag = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined; };
const TEST = flag('--test');
const LIMIT = Number(flag('--limit') ?? 0) || 0;
const DELAY = Number(flag('--delay') ?? 1500) || 0;

const here = path.dirname(fileURLToPath(import.meta.url));
const SENT_LOG = path.join(here, 'notify-donate-feature.sent.log');

// ---------- הנוסח ----------
// SMS בעברית = 70 תווים למקטע; הודעה זו ~5 מקטעים. ב-SMSGate/Traccar (חבילה
// ישראלית ללא הגבלה) זה חינם; ב-Twilio זה עולה פי 5 — ראו --limit.
// פנייה ישירה לנמען; שם הגמ"ח שבו המספר מופיע נזכר בשורת הקישור, כדי שיידע
// לאיזה כרטיס ההודעה מתייחסת (ב---test זה הגמ"ח הראשון ברשימה — רק דוגמה).
function messageFor(name, url) {
    return [
        'שלום, כאן הגמ"ח הארצי 💝',
        'מעכשיו תוכלו לקבל תרומות דרך כרטיס הגמ"ח האישי שלכם באתר — ביט, פייבוקס, העברה בנקאית, הוראת קבע או קישור לדף תרומות. אפשר כמה דרכים במקביל.',
        `היכנסו לכרטיס של "${name}", לחצו "ערוך" (או "כן, זה הגמ"ח שלי" אם עוד לא נרשמתם), והוסיפו את דרכי התרומה. לוקח דקה:`,
        url,
        'להסרה — השיבו "הסר".',
    ].join('\n');
}

// ---------- טלפונים ----------
/** מספר ישראלי (מקומי או 972) → E.164. רק ניידים. זהה ל-toMobileE164 ב-sms.ts */
function toMobileE164(phone) {
    let d = String(phone ?? '').replace(/\D/g, '');
    if (d.startsWith('972')) d = '0' + d.slice(3);
    if (!/^05\d{8}$/.test(d)) return null;
    return '+972' + d.slice(1);
}

// ---------- ספקי SMS (העתק של src/lib/server/sms.ts, על process.env) ----------
const env = process.env;
function providerName() {
    if (env.SMSGATE_LOGIN && env.SMSGATE_PASSWORD) return 'SMSGate';
    if (env.TRACCAR_SMS_TOKEN) return 'Traccar';
    if (env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN && env.TWILIO_FROM) return 'Twilio';
    return null;
}
async function sendSms(to, body) {
    const p = providerName();
    let res;
    if (p === 'SMSGate') {
        const auth = Buffer.from(`${env.SMSGATE_LOGIN}:${env.SMSGATE_PASSWORD}`).toString('base64');
        res = await fetch('https://api.sms-gate.app/3rdparty/v1/messages', {
            method: 'POST',
            headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ textMessage: { text: body }, phoneNumbers: [to] }),
        });
    } else if (p === 'Traccar') {
        res = await fetch('https://www.traccar.org/sms/', {
            method: 'POST',
            headers: { Authorization: env.TRACCAR_SMS_TOKEN, 'Content-Type': 'application/json' },
            body: JSON.stringify({ to, message: body }),
        });
    } else if (p === 'Twilio') {
        const sid = env.TWILIO_ACCOUNT_SID;
        res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
            method: 'POST',
            headers: {
                Authorization: 'Basic ' + Buffer.from(`${sid}:${env.TWILIO_AUTH_TOKEN}`).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: new URLSearchParams({ To: to, From: env.TWILIO_FROM, Body: body }),
        });
    } else {
        throw new Error('אף ספק SMS אינו מוגדר (SMSGATE_* / TRACCAR_SMS_TOKEN / TWILIO_*)');
    }
    if (!res.ok) throw new Error(`${p} ${res.status} — ${(await res.text().catch(() => '')).slice(0, 300)}`);
}

// ---------- נמענים ----------
async function fetchStrapiGemachim() {
    const out = [];
    const PAGE = 100;
    for (let start = 0; start < 100000; start += PAGE) {
        const url = `${STRAPI}/api/items?filters[category][$eq]=${CATEGORY}` +
            `&filters[status1][$eq]=active&pagination[start]=${start}&pagination[limit]=${PAGE}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`GET items → ${res.status}: ${await res.text()}`);
        const batch = (await res.json()).data ?? [];
        out.push(...batch);
        if (batch.length < PAGE) break;
    }
    return out;
}

/** רשימת {to, name, url, source} — מספר אחד לכל נייד, הגמ"ח הראשון שבו הופיע */
async function buildRecipients() {
    const items = await fetchStrapiGemachim();
    const importedIds = new Set(items.map((i) => i.extra_fields?.source_id).filter(Boolean));

    const sources = items.map((i) => ({
        id: i.documentId,
        name: i.label ?? '',
        phones: [i.phone, i.extra_fields?.phone2],
        source: 'strapi',
    }));
    if (!MANAGED_ONLY) {
        for (const g of staticGemachim) {
            if (importedIds.has(g.id)) continue; // כבר ב-DB — נספר שם
            sources.push({ id: g.id, name: g.name, phones: [g.phone], source: 'static' });
        }
    }

    const seen = new Set();
    const recipients = [];
    let landlines = 0;
    for (const s of sources) {
        for (const raw of s.phones) {
            if (!raw) continue;
            const to = toMobileE164(raw);
            if (!to) { landlines++; continue; }
            if (seen.has(to)) continue;
            seen.add(to);
            recipients.push({ to, name: s.name, url: `${SITE}/gemach/${s.id}`, source: s.source });
        }
    }
    return { recipients, gemachim: sources.length, managed: items.length, landlines };
}

function loadSent() {
    try { return new Set(fs.readFileSync(SENT_LOG, 'utf8').split('\n').map((l) => l.split('\t')[0]).filter(Boolean)); }
    catch { return new Set(); }
}
function markSent(to, name) {
    fs.appendFileSync(SENT_LOG, `${to}\t${new Date().toISOString()}\t${name}\n`);
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function main() {
    const provider = providerName();
    console.log(`[notify] mode=${APPLY ? 'APPLY (sending SMS)' : 'DRY-RUN (no sending)'}  provider=${provider ?? 'none'}${TEST ? `  test=${TEST}` : ''}`);
    if (APPLY && !provider) {
        console.error('ERROR: --apply דורש ספק SMS ב-env (SMSGATE_LOGIN/PASSWORD, TRACCAR_SMS_TOKEN או TWILIO_*).');
        process.exit(1);
    }

    let { recipients, gemachim, managed, landlines } = await buildRecipients();
    console.log(`[notify] gemachim=${gemachim} (strapi ${managed}, static ${gemachim - managed})  mobiles=${recipients.length}  landlines/invalid skipped=${landlines}`);

    if (TEST) {
        const to = toMobileE164(TEST);
        if (!to) { console.error(`ERROR: --test ${TEST} אינו נייד ישראלי תקין`); process.exit(1); }
        const sample = recipients[0] ?? { name: 'גמ"ח לדוגמה', url: `${SITE}/gemach/1000` };
        recipients = [{ ...sample, to, source: 'test' }];
    } else {
        const sent = loadSent();
        const before = recipients.length;
        recipients = recipients.filter((r) => !sent.has(r.to));
        if (before !== recipients.length) console.log(`[notify] already sent (log): ${before - recipients.length} — skipping`);
        if (LIMIT > 0) recipients = recipients.slice(0, LIMIT);
    }

    console.log(`\n--- נוסח לדוגמה (${recipients[0]?.to ?? '-'}) ---\n${messageFor(recipients[0]?.name ?? '…', recipients[0]?.url ?? '…')}\n---\n`);

    if (!APPLY) {
        console.log('[notify] preview of recipients:');
        for (const r of recipients.slice(0, 15)) console.log(`  ${r.to}  ${r.source.padEnd(6)}  ${r.name}`);
        if (recipients.length > 15) console.log(`  … +${recipients.length - 15} more`);
        console.log(`\n[notify] DRY-RUN — nothing sent. would send ${recipients.length} messages. add --apply to send.`);
        return;
    }

    let ok = 0, failed = 0;
    for (const [i, r] of recipients.entries()) {
        try {
            await sendSms(r.to, messageFor(r.name, r.url));
            if (r.source !== 'test') markSent(r.to, r.name);
            ok++;
            console.log(`  ✓ ${i + 1}/${recipients.length}  ${r.to}  ${r.name}`);
        } catch (e) {
            failed++;
            console.log(`  ✗ ${i + 1}/${recipients.length}  ${r.to}  ${r.name}  — ${e.message}`);
        }
        if (DELAY && i < recipients.length - 1) await sleep(DELAY);
    }
    console.log(`\n[notify] done: sent=${ok} failed=${failed}${failed ? '  (הרצה חוזרת תשלח רק למי שנכשל)' : ''}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
