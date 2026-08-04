// ============================================================
// gemachSource.ts — מקור אמת אחד לרשימת הגמ"חים המוצגת באתר
// מאחד את מה שמנוהל ב-Strapi עם הרשימה הסטטית שטרם יובאה.
// ============================================================

import type { Gemach, ListGemach } from '$lib/gemachData';
import { getAllGemachimWithDrafts } from './db';
import { staticGemachim } from '$lib/staticGemachim';
// מספר טלפון שנכתב בתוך טקסט חופשי מוסתר גם הוא ברשימות — אחרת המספר היה
// גלוי בלי לחיצה דרך הדלת האחורית. אותו ניקוי משמש את טקסט השיתוף בלקוח.
import { withoutPhones } from '$lib/phoneText';

// ---------- תמונות: מ-data URI מוטמע לכתובת endpoint ----------
// התמונות שמורות כ-data URI בתוך extra_fields (עד ~1MB לתמונה). הטמעתן ישירות
// בנתוני העמוד ניפחה את דף הבית ל-2.8MB של HTML. במקום זה העמודים הציבוריים
// נושאים כתובת קצרה ל-/api/gemach-image, שמגיש את התמונה עם מטמון CDN —
// הדף נטען מיד והתמונות מגיעות בנפרד, פעם אחת, ונשמרות במטמון.
const BASE64_URI = /^data:[^;,]+;base64,/;

/** פרמטר גרסה לכתובת — תמונה שהוחלפה מקבלת כתובת חדשה ולא נתקעת במטמון */
function imgVersion(src: string): string {
    return src.length.toString(36);
}

function imageEndpointUrl(id: string, src: string, galleryIndex?: number): string {
    const q = new URLSearchParams();
    if (galleryIndex !== undefined) q.set('i', String(galleryIndex));
    q.set('v', imgVersion(src));
    return `/api/gemach-image/${encodeURIComponent(id)}?${q}`;
}

/** מחליף תמונות data-URI בכתובות endpoint. תמונות שהן ממילא כתובת (סטטיות /
 *  חיצוניות) נשארות כמות שהן. לשימוש בכל מה שנשלח לדפדפן בעמודים ציבוריים.
 *  תמונה ראשית שמקורה בגלריה (pickImage נופל ל-images[0]) מקבלת את אותה
 *  כתובת כמו רשומת הגלריה — דף הגמ"ח מסנן כפילויות בהשוואת מחרוזות. */
export function withImageUrls<T extends { id: string; image?: string; gallery?: string[] }>(g: T): T {
    const gallery = g.gallery?.map((src, i) =>
        BASE64_URI.test(src) ? imageEndpointUrl(g.id, src, i) : src,
    );
    let image = g.image;
    if (image && BASE64_URI.test(image)) {
        const gi = g.gallery?.indexOf(image) ?? -1;
        image = gi >= 0 && gallery ? gallery[gi] : imageEndpointUrl(g.id, image);
    }
    return { ...g, image, gallery };
}

/**
 * הצורה שנשלחת ללקוח ברשימות: בלי הטלפון, וגם בלי מספרים שנכתבו בתוך
 * הטקסט. הכרטיסים ממילא לא מציגים טלפון (הוא נחשף רק בעמוד הגמ"ח, אחרי
 * פרסומת), ולכן הוא גם לא נשלח לדפדפן — אחרת המספר היה יושב בקוד המקור
 * של העמוד ועוקף את השער.
 */
export function toListItem(g: Gemach): ListGemach {
    const { phone, ...rest } = g;
    return withImageUrls({
        ...rest,
        description: withoutPhones(g.description) ?? '',
        contact: withoutPhones(g.contact),
        notes: withoutPhones(g.notes),
        arrivalNotes: withoutPhones(g.arrivalNotes),
        hasPhone: Boolean(phone),
    });
}

/**
 * כל הגמ"חים להצגה: מה שב-Strapi (מנוהל/נערך בפאנל) ואחריו הרשימה הסטטית
 * בניכוי פריטים שכבר יובאו — התאמה לפי sourceId ↔ id הסטטי, כדי שלא יופיעו פעמיים.
 * טיוטות לא נכללות — אבל כן חוסמות את התאום הסטטי שלהן, אחרת "החזר לטיוטה"
 * על פריט שיובא היה מחיה את הגרסה הסטטית הישנה מהדלת האחורית.
 */
export async function getMergedGemachim(): Promise<Gemach[]> {
    const strapiGemachim = await getAllGemachimWithDrafts();
    const importedIds = new Set(strapiGemachim.map(g => g.sourceId).filter(Boolean));
    const activeStrapi = strapiGemachim.filter(g => g.status !== 'draft');
    const remainingStatic = staticGemachim.filter(g => !importedIds.has(g.id));
    return [...activeStrapi, ...remainingStatic];
}

/**
 * גמ"ח בודד לדף הפריט. מחפש קודם לפי המזהה שבו הפריט מוצג (documentId של
 * Strapi או id סטטי), ואז לפי sourceId — כדי שקישורים ישנים לפריט סטטי
 * ימשיכו לעבוד גם אחרי שיובא ל-DB וקיבל documentId חדש.
 * כולל טיוטות — הקורא (דף הגמ"ח) אחראי להסתיר טיוטה ממי שאינו אדמין.
 */
export async function findGemachById(id: string): Promise<Gemach | null> {
    const strapiAll = await getAllGemachimWithDrafts();
    const importedIds = new Set(strapiAll.map(g => g.sourceId).filter(Boolean));
    const all = [...strapiAll, ...staticGemachim.filter(g => !importedIds.has(g.id))];
    return all.find(g => g.id === id) ?? all.find(g => g.sourceId === id) ?? null;
}
