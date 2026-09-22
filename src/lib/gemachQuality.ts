// ============================================================
// gemachQuality.ts — מה חסר בכרטיס של הגמ"ח, ומה זה עושה למי שמחפש
// ------------------------------------------------------------
// הטופס מקבל כמעט הכול כרשות, ולכן אפשר לשמור גמ"ח שבפועל לא אומר כלום:
// גמ"ח ששמר שם, נושא ותמונה בלבד מופיע ברשימה כשם בודד — כל מה שהבעלים
// כתב ("ביגוד ילדים נשים וגברים") נכנס ל"הערות", והכרטיס נראה ריק.
// כאן יושב מקור-האמת של הבדיקות: מה נחשב חסר, ומה התוצאה הגלויה של החוסר.
// טקסט ה-effect מנוסח כתוצאה ("ברשימה יופיע השם בלבד") ולא כנזיפה — זו
// המטרה: שהמשתמש יבין מה הוא מפסיד, לא שירגיש שנכשל במבחן.
// ============================================================

import { parseOpeningHours, hasOpenDays } from './openingHours';

export interface GemachQualityCheck {
    key: string;
    /** שם הפריט החסר, קצר — נכנס לגלולה */
    label: string;
    /** מה קורה בלי זה, בלשון תוצאה */
    effect: string;
    done: boolean;
    /** major = פוגע במה שגולש רואה או עושה; minor = שיפור */
    major: boolean;
}

/** ערכי הטופס כפי שנקראים מ-FormData — מחרוזות בלבד */
export type GemachFormValues = Record<string, string>;

const filled = (v: string | undefined): boolean => !!v && v.trim() !== '';

/** שעות פתיחה נשלחות כ-JSON; "כל הימים סגורים" הוא כמו ריק לעניין הכרטיס */
function hasHours(v: string | undefined): boolean {
    if (!filled(v)) return false;
    const parsed = parseOpeningHours(v);
    return parsed ? hasOpenDays(parsed) : true;   // טקסט חופשי ישן — נחשב מלא
}

export function gemachQualityChecks(v: GemachFormValues): GemachQualityCheck[] {
    return [
        {
            key: 'description',
            label: 'תיאור',
            effect: 'בלי תיאור הכרטיס ברשימה ובגוגל מראה את השם בלבד — מי שמחפש לא יודע מה יש בגמ"ח וממשיך הלאה',
            done: filled(v.description),
            major: true,
        },
        {
            key: 'image',
            label: 'תמונה',
            effect: 'בלי תמונה מוצג אייקון כללי, והכרטיס נבלע בין השאר',
            done: filled(v.image) || filled(v.images),
            major: true,
        },
        {
            key: 'phone',
            label: 'טלפון',
            effect: 'בלי טלפון אין דרך ליצור קשר עם הגמ"ח מהאתר',
            done: filled(v.phone) || filled(v.phone2),
            major: true,
        },
        {
            key: 'address',
            label: 'כתובת',
            effect: 'בלי כתובת הגמ"ח לא מקבל סיכה במפה',
            done: filled(v.address),
            major: false,
        },
        {
            key: 'hours',
            label: 'שעות פתיחה',
            effect: 'בלי שעות מתקשרים בזמנים לא נוחים — או לא מתקשרים בכלל',
            done: hasHours(v.hours),
            major: false,
        },
        {
            key: 'contact',
            label: 'איש קשר',
            effect: 'שם של אדם בכרטיס הופך את הפנייה לקלה יותר',
            done: filled(v.contact),
            major: false,
        },
    ];
}

/**
 * המקרה של אפרת: הטקסט שמתאר את הגמ"ח נכתב ב"הערות" והתיאור נשאר ריק.
 * אז אפשר להציע העברה בלחיצה — זה בדיוק מה שהיה חסר בכרטיס.
 */
export function suggestNotesAsDescription(v: GemachFormValues): string | null {
    if (filled(v.description)) return null;
    const notes = v.notes?.trim();
    return notes ? notes : null;
}
