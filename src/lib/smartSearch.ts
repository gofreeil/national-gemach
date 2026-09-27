/* ═══════════ חיפוש חכם בגמ"חים ═══════════
   חיפוש מחרוזת נאיבי מפספס את רוב מה שאנשים מקלידים: "מגפיים" לא מופיע
   בשום תיאור, אבל גמ"ח ביגוד הוא בדיוק המקום שלהן. לכן כל מילה בשאילתה
   עוברת כמה שכבות, והגמ"ח נמצא אם כל מילה "נתפסה" באחת מהן:
     1. נרמול — אותיות סופיות, ניקוד, גרשיים ופיסוק (גמ"ח = גמח, מגף = מגפ).
     2. צורות — הסרת תחיליות (ו/ה/ב/ל/מ/ש/כ) וסיומות רבים (ים/יים/ות).
     3. מושגים — מילון נרדפות שממפה מילה לקטגוריות ולמילים קרובות
        (מגפיים → נעליים → ביגוד).
     4. שם הקטגוריה — גמ"ח שמסווג "ביגוד" נמצא בחיפוש "ביגוד" גם בלי המילה בתיאור.
     5. שגיאות הקלדה — מרחק עריכה 1 למילים של 4 אותיות ומעלה.
   כל התאמה מקבלת ניקוד (שם > תגיות/קטגוריה > מקום > תיאור > מושג > שגיאה),
   והתוצאות ממוינות לפיו. אם אין אף גמ"ח שעונה על כל המילים — נופלים
   ל"לפחות אחת", כדי שלא יוצג מסך ריק כשיש תוצאות קרובות. */

import { categoryKeys } from './gemachData';

const FINALS: Record<string, string> = { 'ם': 'מ', 'ן': 'נ', 'ץ': 'צ', 'ף': 'פ', 'ך': 'כ' };

export function normalize(s: string): string {
    return (s ?? '')
        .toLowerCase()
        .replace(/[֑-ׇ]/g, '')                       // ניקוד וטעמים
        .replace(/[׳״'"`׳״]/g, '')                    // גרש/גרשיים: גמ"ח → גמח
        .replace(/[םןץףך]/g, (c) => FINALS[c])
        .replace(/[^\p{L}\p{N}]+/gu, ' ')
        .trim();
}

const STOP = new Set(
    ['גמח', 'גמחים', 'גמחי', 'של', 'עם', 'את', 'על', 'או', 'גם', 'יש', 'אני', 'מחפש', 'מחפשת',
     'צריכ', 'צריכה', 'צריכימ', 'רוצה', 'איפה', 'למי', 'מי', 'לי', 'לנו', 'בשביל', 'עבור', 'כל',
     'השאלה', 'להשאלה', 'השאלת', 'the', 'a', 'of'].map(normalize)
);

const PREFIXES = ['וכש', 'ושה', 'וכשה', 'וה', 'וב', 'ול', 'ומ', 'וש', 'שה', 'שב', 'של', 'מה', 'לה', 'בה', 'כש', 'כה',
    'ו', 'ה', 'ב', 'ל', 'מ', 'ש', 'כ'];

/** צורות אפשריות של מילה, כל אחת עם משקל אמינות (המקור = 1). */
export function variants(word: string): Map<string, number> {
    const out = new Map<string, number>();
    const add = (v: string, w: number) => {
        if (v.length < (v === word ? 2 : 3)) return;             // צורה נגזרת קצרה מדי תופסת הכל (כלה → כל)
        if ((out.get(v) ?? 0) < w) out.set(v, w);
    };
    const stems = (base: string, w: number) => {
        add(base, w);
        if (base.length >= 5 && base.endsWith('יימ')) add(base.slice(0, -3), w * 0.9);   // מגפיימ → מגפ
        if (base.length >= 5 && base.endsWith('ימ')) add(base.slice(0, -2), w * 0.9);    // בגדימ → בגד
        if (base.length >= 5 && base.endsWith('ות')) {                                   // שמלות → שמלה/שמל
            add(base.slice(0, -2), w * 0.85);
            add(base.slice(0, -2) + 'ה', w * 0.9);
        }
        if (base.length >= 4 && base.endsWith('ה')) add(base.slice(0, -1), w * 0.85);    // שמלה → שמל
        if (base.length >= 5 && base.endsWith('יה')) add(base.slice(0, -2), w * 0.8);    // ספריה → ספר
        if (base.length >= 4 && base.endsWith('ת')) add(base.slice(0, -1) + 'ה', w * 0.9); // סמיכות: עגלת → עגלה
    };
    stems(word, 1);
    for (const p of PREFIXES) {
        if (word.startsWith(p) && word.length - p.length >= 3) stems(word.slice(p.length), 0.75);
    }
    return out;
}

/* ─────────── מילון מושגים ───────────
   כל קבוצה: מילים קרובות + הקטגוריות שבהן סביר למצוא אותן. קבוצה בלי
   קטגוריות משמשת רק להרחבת מילים (כתיבים שונים של אותו דבר). */
/** broad — קבוצה של פריטים שונים זה מזה (מקרר ≠ מיחם): הקטגוריה נתפסת, אבל מילה אחרת
 *  מהקבוצה בתיאור לא נחשבת התאמה. */
type Concept = { cats: string[]; broad?: boolean; terms: string[] };

const CONCEPTS: Concept[] = [
    { cats: ['clothing'], terms: ['נעל', 'נעליים', 'נעלי', 'מגף', 'מגפיים', 'מגפי', 'סנדל', 'סנדלים', 'כפכף', 'כפכפים', 'סניקרס', 'נעלית', 'הנעלה', 'נעלי ספורט', 'נעלי בית'] },
    { cats: ['clothing'], terms: ['בגד', 'בגדים', 'ביגוד', 'לבוש', 'חולצה', 'חולצות', 'מכנס', 'מכנסיים', 'שמלה', 'שמלות', 'חצאית', 'חצאיות',
        'מעיל', 'מעילים', 'גקט', 'גקטים', 'סוודר', 'סוודרים', 'פיגמה', 'פיגמות', 'גרב', 'גרביים', 'כובע', 'כובעים', 'צעיף', 'כפפות',
        'חליפה', 'חליפות', 'עניבה', 'עניבות', 'טוקסידו', 'אפודה', 'הלבשה', 'תחתונים', 'מדים', 'בגדי'] },
    { cats: ['wedding', 'clothing'], terms: ['שמלת', 'כלה', 'כלות', 'הינומה', 'שמלותכלה'] },
    { cats: ['wedding', 'events'], terms: ['חתונה', 'חתונות', 'חתן', 'חופה', 'חופות', 'אירוסין', 'טבעת', 'טבעות', 'תכשיט', 'תכשיטים', 'נישואין', 'שבעברכות'] },
    { cats: ['events', 'wedding', 'holidays'], broad: true, terms: ['אירוע', 'אירועים', 'שמחה', 'שמחות', 'מצווה', 'ברית', 'בריתות', 'פדיון', 'קידוש',
        'מפה', 'מפות', 'צלחות', 'סכום', 'סכו"ם', 'הגשה', 'מגש', 'מגשים', 'קישוט', 'קישוטים', 'בלונים', 'אוהל', 'אוהלים', 'הגברה', 'רמקול'] },
    { cats: ['baby'], terms: ['תינוק', 'תינוקות', 'תינוקת', 'עגלה', 'עגלות', 'טיולון', 'לול', 'עריסה', 'עריסות', 'סלקל', 'בוסטר',
        'בקבוק', 'בקבוקים', 'מוצץ', 'טיטול', 'טיטולים', 'חיתול', 'חיתולים', 'משאבה', 'שאיבה', 'יולדת', 'יולדות', 'הנקה', 'לידה',
        'פעוט', 'פעוטות', 'אמבטיה', 'שידתהחתלה', 'החתלה', 'מנשא', 'נדנדה', 'היריון', 'הריון'] },
    { cats: ['medical'], terms: ['רפואי', 'רפואה', 'רפואית', 'גלגלים', 'הליכון', 'הליכונים', 'קביים', 'קב', 'סיעודית', 'סיעוד', 'סיעודי',
        'חמצן', 'סוכר', 'אינהלציה', 'אינהלטור', 'תרופה', 'תרופות', 'נכים', 'נכה', 'נכות', 'קשישים', 'קשיש', 'זקנים', 'חולה',
        'חולים', 'שיקום', 'רחצה', 'מזרןאוויר', 'קלנועית', 'קלנועיות', 'מקל', 'מקלות', 'אורתופדי', 'סד', 'מכשירשמיעה', 'שמיעה', 'רופא',
        'בריאות', 'מעקה', 'פיזיותרפיה', 'אחות'] },
    { cats: ['food'], terms: ['אוכל', 'מזון', 'ארוחה', 'ארוחות', 'מצרכים', 'ירקות', 'פירות', 'לחם', 'חלב', 'בשר', 'עוף', 'דגים',
        'תבשיל', 'תבשילים', 'קמח', 'שימורים', 'מטבח', 'בישול', 'חלות', 'עוגות', 'מזנון', 'ביצים', 'אורז'] },
    { cats: ['furniture', 'events'], terms: ['כסא', 'כיסא', 'כסאות', 'כיסאות', 'שולחן', 'שולחנות'] },
    { cats: ['furniture'], broad: true, terms: ['רהיט', 'רהיטים', 'ריהוט', 'ספה', 'ספות', 'כורסה', 'כורסא', 'כורסאות', 'מיטה', 'מיטות', 'מזרן', 'מזרון',
        'מזרנים', 'ארון', 'ארונות', 'שידה', 'שידות', 'מדף', 'מדפים', 'כוורת', 'ספריה', 'שטיח', 'שטיחים', 'וילון', 'וילונות',
        'מתקפלת', 'מתקפל'] },
    { cats: ['electronics'], broad: true, terms: ['חשמל', 'חשמלי', 'חשמליים', 'מקרר', 'מקררים', 'תנור', 'תנורים', 'כביסה', 'מייבש', 'מזגן', 'מזגנים', 'מאוורר',
        'מאווררים', 'מחשב', 'מחשבים', 'לפטופ', 'טלפון', 'טלפונים', 'סלולרי', 'טאבלט', 'מדפסת', 'טלוויזיה', 'מיקרוגל', 'קומקום',
        'מיחם', 'מיחמים', 'פלטה', 'פלטות', 'שואב', 'מפזר', 'רדיאטור', 'הסקה', 'אלקטרוניקה'] },
    { cats: ['tools'], broad: true, terms: ['כלים', 'מקדחה', 'מברגה', 'פטיש', 'סולם', 'סולמות', 'מסור', 'בנייה', 'שיפוץ', 'שיפוצים', 'גינון', 'גינה',
        'מדחס', 'מכסחה', 'דשא', 'מברג', 'ברגים', 'עגלתיד', 'מלגזה', 'הובלה', 'הובלות', 'קרטונים', 'ארגזים'] },
    { cats: ['books'], terms: ['ספר', 'ספרים', 'ספרי', 'לימוד', 'לימודים', 'חוברת', 'חוברות', 'ספריה', 'ספרייה', 'מחברת', 'מחברות', 'ילקוט',
        'ילקוטים', 'קלמר', 'בית ספר', 'בגרות', 'סטודנט', 'סטודנטים'] },
    { cats: ['toys'], terms: ['צעצוע', 'צעצועים', 'משחק', 'משחקים', 'בובה', 'בובות', 'לגו', 'פאזל', 'פאזלים', 'אופניים', 'אופנים', 'קורקינט',
        'תחפושת', 'תחפושות', 'ילדה', 'טרמפולינה', 'מתנפח', 'מתנפחים', 'כדור', 'גוגואים'] },
    { cats: ['money'], terms: ['הלוואה', 'הלוואות', 'כסף', 'כספים', 'כספי', 'מימון', 'קרן', 'צדקה', 'תרומה', 'תרומות', 'כלכלי', 'כלכלית',
        'חוב', 'חובות', 'משכנתא', 'ערבים', 'ערבות', 'מלגה', 'מלגות', 'שקל', 'שקלים', 'מזומן'] },
    { cats: ['judaism'], broad: true, terms: ['תפילין', 'ציצית', 'טלית', 'טליתות', 'מזוזה', 'מזוזות', 'סידור', 'סידורים', 'תורה', 'יהדות', 'כיפה', 'כיפות',
        'ישיבה', 'גמרא', 'משניות', 'סת"ם', 'קודש', 'מקווה', 'מקוואות', 'נטלה', 'כשרות', 'הכשרה'] },
    { cats: ['holidays'], broad: true, terms: ['שבת', 'שבתות', 'חג', 'חגים', 'פסח', 'סוכות', 'סוכה', 'לולב', 'אתרוג', 'מינים', 'חנוכה', 'חנוכיה', 'חנוכייה',
        'פורים', 'משלוח', 'משלוחי', 'ראשהשנה', 'שופר', 'כיפור', 'מצות', 'מצה', 'הגדה', 'הגדות', 'קערה', 'נרות', 'פמוט', 'פמוטים'] },
    { cats: ['transport'], terms: ['רכב', 'רכבים', 'הסעה', 'הסעות', 'טרמפ', 'טרמפים', 'נסיעה', 'נסיעות', 'מונית', 'אמבולנס', 'אופנוע', 'נהג',
        'נהגים', 'מושבבטיחות', 'גרר', 'עגלהנגררת', 'רכבנכים', 'שאטל'] },
    { cats: ['hosting'], terms: ['אירוח', 'לינה', 'דירות', 'חדר', 'חדרים', 'לישון', 'מלון', 'אכסניה', 'מאושפזים', 'מאושפז', 'מגורים',
        'צימר', 'מארח', 'מארחים'] },
    { cats: ['mourning', 'prayer'], terms: ['אבל', 'אבלים', 'אבלות', 'שבעה', 'ניחום', 'לוויה', 'הלוויה', 'קבורה', 'יארצייט', 'אזכרה', 'קדיש',
        'נפטר', 'נפטרים', 'פטירה', 'שבעה', 'מצבה'] },
    { cats: ['prayer', 'judaism'], terms: ['תפילה', 'תפילות', 'תהילים', 'ברכה', 'רחמים', 'מניין', 'מנין'] },
    { cats: ['initiatives'], terms: ['מיזם', 'מיזמים', 'התנדבות', 'מתנדבים', 'מתנדב'] },
    // צירופים — נתפסים כיחידה אחת לפני הפיצול למילים ("כסא גלגלים" הוא ציוד רפואי, לא ריהוט)
    { cats: ['medical'], terms: ['כסא גלגלים', 'כיסא גלגלים', 'כסאות גלגלים', 'כיסאות גלגלים', 'מיטה סיעודית', 'מיטות סיעודיות',
        'מיטת בית חולים', 'מכשיר שמיעה', 'ציוד רפואי', 'כסא רחצה', 'כיסא רחצה', 'מד לחץ', 'מד סוכר', 'מזרן אוויר', 'מזרן נגד פצעים'] },
    { cats: ['baby'], terms: ['עגלת תינוק', 'עגלות תינוק', 'מיטת תינוק', 'מיטות תינוק', 'כסא רכב', 'כיסא רכב', 'כסאות רכב',
        'מושב בטיחות', 'בגדי תינוקות', 'בגדי תינוק', 'משאבת חלב', 'כסא אוכל', 'כיסא אוכל', 'שידת החתלה'] },
    { cats: ['wedding', 'clothing'], terms: ['שמלת כלה', 'שמלות כלה', 'שמלת ערב', 'שמלות ערב', 'חליפת חתן'] },
    { cats: ['events', 'wedding'], terms: ['בר מצווה', 'בת מצווה', 'כלי הגשה', 'ציוד לאירועים', 'כלי אוכל'] },
    { cats: ['mourning'], terms: ['כסא אבלים', 'כסאות אבלים', 'כיסאות אבלים', 'ניחום אבלים', 'בית האבל'] },
    { cats: ['electronics'], terms: ['מכונת כביסה', 'מכונות כביסה', 'מוצרי חשמל', 'מכשירי חשמל'] },
    { cats: ['holidays', 'electronics'], terms: ['פלטת שבת', 'פלטות שבת', 'מיחם שבת'] },
    { cats: ['books', 'judaism'], terms: ['ספרי קודש'] },
    { cats: ['books'], terms: ['ספרי לימוד', 'ציוד לימודי', 'בית ספר'] },
    { cats: ['holidays'], terms: ['ארבעת המינים', 'משלוח מנות', 'משלוחי מנות', 'ראש השנה', 'יום כיפור', 'ליל הסדר'] },
    { cats: ['tools'], terms: ['כלי עבודה', 'ציוד בנייה', 'ציוד גינון'] },
    { cats: ['food'], terms: ['סל מזון', 'סלי מזון', 'חלוקת מזון', 'ארוחות חמות'] },
    { cats: ['transport', 'medical'], terms: ['רכב נכים', 'הסעה לבית חולים'] },
    { cats: ['clothing'], terms: ['בגדי ילדים', 'בגדי נשים', 'בגדי גברים'] },
    { cats: ['prayer'], terms: ['בית כנסת'] },
    // כתיבים שונים בלי קטגוריה — רק מרחיבים את המילה
    { cats: [], terms: ['ווצאפ', 'וואטסאפ', 'וצאפ', 'ווטסאפ', 'וטסאפ', 'whatsapp', 'קבוצה', 'קבוצות', 'קבוצת', 'טלגרם'] },
    { cats: [], terms: ['בני ברק', 'בנ"ב', 'ב"ב'] },
];

type NormConcept = { cats: Set<string>; broad: boolean; terms: string[] };

const CONCEPT_INDEX: { list: NormConcept[]; byForm: Map<string, number[]> } = (() => {
    const list: NormConcept[] = [];
    const byForm = new Map<string, number[]>();
    CONCEPTS.forEach((c, i) => {
        const terms = [...new Set(c.terms.map(normalize).filter((t) => t.length >= 2))];
        list.push({ cats: new Set(c.cats), broad: !!c.broad, terms });
        for (const t of terms)
            for (const form of variants(t.replace(/ /g, '')).keys()) {
                if (form.length < 3 && form !== t) continue;
                const arr = byForm.get(form) ?? [];
                if (!arr.includes(i)) arr.push(i);
                byForm.set(form, arr);
            }
    });
    return { list, byForm };
})();

/** מרחק עריכה ≤ 1 (החלפה/הוספה/מחיקה אחת) — מהיר, בלי מטריצה */
function withinOne(a: string, b: string): boolean {
    if (a === b) return true;
    const la = a.length, lb = b.length;
    if (Math.abs(la - lb) > 1) return false;
    let i = 0, j = 0, edits = 0;
    while (i < la && j < lb) {
        if (a[i] === b[j]) { i++; j++; continue; }
        if (++edits > 1) return false;
        if (la > lb) i++;
        else if (lb > la) j++;
        else { i++; j++; }
    }
    return edits + (la - i) + (lb - j) <= 1;
}

type Searchable = {
    name: string; description: string; tags: string[]; city: string;
    neighborhood?: string; contact?: string; notes?: string;
    category?: string; categories?: string[];
};

type Indexed<T> = {
    g: T;
    name: string; tags: string; cats: string; place: string; body: string;
    catKeys: Set<string>;
    words: string[];
};

export function buildIndex<T extends Searchable>(list: T[], labelByKey: Map<string, string>): Indexed<T>[] {
    return list.map((g) => {
        const keys = categoryKeys(g);
        const name = normalize(g.name);
        const tags = normalize(g.tags.join(' '));
        const cats = normalize(keys.map((k) => labelByKey.get(k) ?? '').join(' '));
        const place = normalize(`${g.city} ${g.neighborhood ?? ''}`);
        const body = normalize(`${g.description} ${g.contact ?? ''} ${g.notes ?? ''}`);
        const words = [...new Set(`${name} ${tags} ${cats} ${place} ${body}`.split(' ').filter((w) => w.length >= 4))];
        return { g, name, tags, cats, place, body, catKeys: new Set(keys), words };
    });
}

/** מופע של צורה בטקסט. המילה כפי שהוקלדה (3+ אותיות) נתפסת בכל מקום; צורה נגזרת
 *  או מילה ממילון המושגים — רק בתחילת מילה (אחרי תחילית אפשרית), כדי שהגזע "ספר"
 *  לא יתפוס את "מספר טלפון" ו"מקל" לא יתפוס "מקלט". */
const wordStart = new Map<string, RegExp>();
function hit(text: string, form: string, loose = false): boolean {
    if (!text) return false;
    if (loose && form.length >= 3) return text.includes(form);
    let re = wordStart.get(form);
    if (!re) {
        re = new RegExp(`(?:^| )[והבלשכ]{0,2}${form}${form.length < 3 ? '(?: |$)' : ''}`);
        wordStart.set(form, re);
    }
    return re.test(text);
}

type Term = { forms: Map<string, number>; concepts: number[]; raw: string };

function prepareTerm(word: string): Term {
    const forms = variants(word);
    const concepts = new Set<number>();
    for (const f of forms.keys()) for (const c of CONCEPT_INDEX.byForm.get(f) ?? []) concepts.add(c);
    return { forms, concepts: [...concepts], raw: word };
}

function scoreTerm(ix: Indexed<unknown>, t: Term): number {
    let best = 0;
    for (const [f, w] of t.forms) {
        const loose = w === 1;                           // רק המילה המקורית נתפסת גם באמצע מילה
        if (hit(ix.name, f, loose)) best = Math.max(best, 10 * w);
        else if (hit(ix.tags, f, loose) || hit(ix.cats, f, loose)) best = Math.max(best, 8 * w);
        else if (hit(ix.place, f, loose)) best = Math.max(best, 7 * w);
        else if (hit(ix.body, f, loose)) best = Math.max(best, 5 * w);
    }
    if (best >= 8) return best;

    for (const ci of t.concepts) {
        const c = CONCEPT_INDEX.list[ci];
        for (const k of ix.catKeys) if (c.cats.has(k)) { best = Math.max(best, 4); break; }
        for (const term of c.terms) {
            if (term.length < 3) continue;
            if (hit(ix.name, term) || hit(ix.tags, term)) { best = Math.max(best, 4.5); break; }
            if (!c.broad && (hit(ix.body, term) || hit(ix.cats, term))) best = Math.max(best, 3.5);
        }
    }
    if (best > 0) return best;

    if (t.raw.length >= 4) {
        for (const w of ix.words) if (withinOne(t.raw, w)) return 2;
        // שגיאת הקלדה בתוך מילה ארוכה יותר (תחילית/סיומת): בודקים חלון באורך המילה
        for (const w of ix.words)
            if (w.length > t.raw.length && w.length <= t.raw.length + 3 && withinOne(t.raw, w.slice(0, t.raw.length))) return 1.5;
    }
    return 0;
}

/** מחזיר את הגמ"חים התואמים ממוינים לפי רלוונטיות. שאילתה ריקה → הכל, בסדר המקורי. */
export function smartSearch<T>(index: Indexed<T>[], query: string): T[] {
    let q = ` ${normalize(query)} `;
    const terms: Term[] = [];
    // צירופים קודם — כל אחד הופך למונח יחיד ונגרע מהשאילתה (עם תחילית אופציונלית: "לכסא גלגלים")
    CONCEPT_INDEX.list.forEach((c, ci) => {
        for (const phrase of c.terms) {
            if (!phrase.includes(' ')) continue;
            const m = q.match(new RegExp(` (?:[והבלמשכ]{1,2})?${phrase} `));
            if (!m) continue;
            q = q.replace(m[0], ' ');
            terms.push({ forms: new Map([[phrase, 1]]), concepts: [ci], raw: phrase });
        }
    });
    const words = q.split(' ').filter((w) => w && !STOP.has(w));
    terms.push(...words.map(prepareTerm));
    if (!terms.length) return index.map((ix) => ix.g);

    const scored = index.map((ix, i) => {
        const per = terms.map((t) => scoreTerm(ix as Indexed<unknown>, t));
        const matched = per.filter((s) => s > 0).length;
        return { g: ix.g, i, per, score: per.reduce((a, b) => a + b, 0), matched };
    });

    // שלוש שכבות: התאמה ישירה בכל המילים → אם יש מספיק כאלה, רק הן ("תפילין" לא
    // מציף את כל גמ"חי היהדות). מעט מדי → מצטרפים גם המושגיים ("מגפיים" → כל גמ"חי
    // הביגוד). אין כלום → לפחות מילה אחת.
    const STRONG = 5, ENOUGH = 3;
    const all = scored.filter((s) => s.matched === terms.length);
    const strong = all.filter((s) => s.per.every((x) => x >= STRONG));
    const pool = strong.length >= ENOUGH ? strong : all.length ? all : scored.filter((s) => s.matched > 0);
    return pool
        .sort((a, b) => b.matched - a.matched || b.score - a.score || a.i - b.i)
        .map((s) => s.g);
}
