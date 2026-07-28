// ============================================================
// gemachSource.ts — מקור אמת אחד לרשימת הגמ"חים המוצגת באתר
// מאחד את מה שמנוהל ב-Strapi עם הרשימה הסטטית שטרם יובאה.
// ============================================================

import type { Gemach, ListGemach } from '$lib/gemachData';
import { getAllGemachim } from './db';
import { staticGemachim } from '$lib/staticGemachim';

// מספר טלפון שנכתב בתוך שדה טקסט חופשי (תיאור / איש קשר / הערות) מוסתר גם
// הוא ברשימות — אחרת המספר היה גלוי בלי לחיצה דרך הדלת האחורית.
const PHONE_IN_TEXT = /[+(]?\d[\d\-().\s]{6,}\d\)?/g;

function withoutPhones(text: string | undefined): string | undefined {
    if (!text) return text;
    // כתובות אינטרנט נשארות שלמות — בקבוצת Facebook יש רצף ספרות ארוך
    // שאינו טלפון. ה-split עם קבוצת-לכידה מחזיר את הכתובות באינדקסים האי-זוגיים.
    const clean = text
        .split(/(https?:\/\/\S+|www\.\S+)/g)
        .map((part, i) => (i % 2 === 1 ? part : part.replace(PHONE_IN_TEXT, ' ')))
        .join('')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/^[\s\-–,:;·|]+|[\s\-–,:;·|]+$/g, '');
    return clean || undefined;
}

/**
 * הצורה שנשלחת ללקוח ברשימות: בלי הטלפון, וגם בלי מספרים שנכתבו בתוך
 * הטקסט. הכרטיסים ממילא לא מציגים טלפון (הוא נחשף רק בעמוד הגמ"ח, אחרי
 * פרסומת), ולכן הוא גם לא נשלח לדפדפן — אחרת המספר היה יושב בקוד המקור
 * של העמוד ועוקף את השער.
 */
export function toListItem(g: Gemach): ListGemach {
    const { phone, ...rest } = g;
    return {
        ...rest,
        description: withoutPhones(g.description) ?? '',
        contact: withoutPhones(g.contact),
        notes: withoutPhones(g.notes),
        hasPhone: Boolean(phone),
    };
}

/**
 * כל הגמ"חים להצגה: מה שב-Strapi (מנוהל/נערך בפאנל) ואחריו הרשימה הסטטית
 * בניכוי פריטים שכבר יובאו — התאמה לפי sourceId ↔ id הסטטי, כדי שלא יופיעו פעמיים.
 */
export async function getMergedGemachim(): Promise<Gemach[]> {
    const strapiGemachim = await getAllGemachim();
    const importedIds = new Set(strapiGemachim.map(g => g.sourceId).filter(Boolean));
    const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id));
    return [...strapiGemachim, ...remainingStatic];
}

/**
 * גמ"ח בודד לדף הפריט. מחפש קודם לפי המזהה שבו הפריט מוצג (documentId של
 * Strapi או id סטטי), ואז לפי sourceId — כדי שקישורים ישנים לפריט סטטי
 * ימשיכו לעבוד גם אחרי שיובא ל-DB וקיבל documentId חדש.
 */
export async function findGemachById(id: string): Promise<Gemach | null> {
    const all = await getMergedGemachim();
    return all.find(g => g.id === id) ?? all.find(g => g.sourceId === id) ?? null;
}
