// ============================================================
// gemachSource.ts — מקור אמת אחד לרשימת הגמ"חים המוצגת באתר
// מאחד את מה שמנוהל ב-Strapi עם הרשימה הסטטית שטרם יובאה.
// ============================================================

import type { Gemach } from '$lib/gemachData';
import { getAllGemachim } from './db';
import { staticGemachim } from '$lib/staticGemachim';

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
