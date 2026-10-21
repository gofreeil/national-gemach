// ============================================================
// logoClearance.ts — טקסט הכרטיס עוקף את לוגו המפרסם
// ------------------------------------------------------------
// הלוגו יושב בשכבה מוחלטת מעל התמונה - בעוגן (פינה / מעל ה-CTA) או
// בנקודה שהמפרסם גרר אליה (logoX/logoY) - והכותרת ותת-הכותרת נפרסות
// בלי לדעת עליו. כך הלוגו כיסה מילים שלמות (למשל "הישאר" בפרסומת
// הווצאפ). ריפוד קבוע לא פותר את זה: תת-הכותרת מעוגנת לתחתית התמונה
// וגדלה כלפי מעלה, ולכן איזו שורה נופלת מתחת ללוגו תלוי באורך הטקסט,
// בגודל הגופן שהמפרסם בחר וברוחב המשבצת.
//
// הפתרון: float בלתי-נראה (<span class="logo-avoid">) בתחילת בלוק
// הטקסט, בצד של הלוגו, עם shape-outside שתוחם את ההדרה לשורות של
// הלוגו בלבד - השורות שלידו מתקצרות והשאר נשארות ברוחב מלא. המיקום
// נמדד ב-JS כי ב-CSS אין לו פתרון: הבלוק מעוגן לתחתית, וכל שורה
// שנדחפת מזיזה את ראשו ואיתו את נקודת ה-float. לכן מודדים שוב עד
// שהבלוק מתייצב.
//
// ההדרה מיושרת לרשת השורות של הבלוק. בלי זה אין נקודת שיווי משקל
// כשמילה לא נכנסת ליד הלוגו (לוגו באמצע): השורה קופצת אל מתחת ל-float
// בדיוק בתחתיתו, הבלוק גדל בגובה שאינו כפולה של שורה, ה-float זז איתו
// - וחוזר חלילה. כשה-float מכסה משבצות שורה שלמות, כל שינוי בגובה הוא
// כפולה של גובה שורה, הרשת לא זזה, והמעבר השני כבר יציב.
//
// שימוש: use:logoClearance על מיכל התמונה; הלוגו מסומן ב-data-ad-logo,
// וכל בלוק טקסט שצריך לעקוף אותו מתחיל ב-<span class="logo-avoid">
// (מוסתר ב-CSS עד שהפעולה מציבה אותו). בבלוק שמעוגן לתחתית התמונה
// (תת-הכותרת) ה-span נושא data-anchor="bottom".
// עותק זהה של purchasing_groups/src/lib/logoClearance.js.
// ============================================================
import type { Action } from 'svelte/action';

/** מרווח בין הלוגו לטקסט שעוקף אותו (px) */
const GAP_X = 4;
const GAP_Y = 2;
/** מעברים עם הדרה בצד הלוגו (בדרך כלל 1-2 מספיקים) */
const SIDE_PASSES = 4;
/** תקרת מדידות לבלוק, כולל מעברי הרצועה ברוחב מלא */
const MAX_PASSES = 12;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

interface Box { top: number; bottom: number; left: number; right: number; }

function spacerOf(block: HTMLElement): HTMLElement | null {
    return block.querySelector<HTMLElement>(':scope > .logo-avoid');
}

function reset(block: HTMLElement) {
    const spacer = spacerOf(block);
    if (spacer) spacer.style.cssText = '';
    block.style.removeProperty('--logo-avoid-tri');
}

/**
 * המשולש של השורה הראשונה בתת-הכותרת (float:left ב-::before) -
 * המידות נקראות מה-CSS ולא משוכפלות כאן
 */
function readTriangle(block: HTMLElement) {
    const cs = getComputedStyle(block, '::before');
    if (cs.content === 'none' || cs.float !== 'left') return null;
    const w = parseFloat(cs.width);
    const h = parseFloat(cs.height);
    return w > 0 && h > 0 ? { w, h } : null;
}

/** מציב את ה-float של בלוק אחד מול הלוגו */
function clearBlock(block: HTMLElement, logo: Box, rel: (el: Element) => Box, mediaBottom: number) {
    const spacer = spacerOf(block);
    if (!spacer) return;
    // בפריסה הטבעית הלוגו לא נוגע בטקסט - אין מה לעקוף
    const b0 = rel(block);
    if (logo.bottom + GAP_Y <= b0.top || logo.top - GAP_Y >= b0.bottom
        || logo.right <= b0.left || logo.left >= b0.right) return;

    const tri = readTriangle(block);
    // גובה שורה - יחידת הרשת שאליה ההדרה מיושרת (0 = בלי יישור)
    const lh = parseFloat(getComputedStyle(block).lineHeight) || 0;
    const snap = (y: number, round: (n: number) => number) =>
        (lh ? round(y / lh + (round === Math.floor ? 1e-3 : -1e-3)) * lh : y);
    // עד איפה ה-float רשאי לרדת. float שגולש מתחת לשורה האחרונה מגדיל
    // את המיכל המוחלט (הוא BFC ומכיל אותו): בבלוק שמעוגן לתחתית זה דוחף
    // את כל הטקסט למעלה, ולכן התקרה היא הקצה הקבוע - תחתית הטקסט הטבעית.
    // בבלוק שמעוגן לראש (הכותרת) הטקסט גדל כלפי מטה בחופשיות.
    const limit = spacer.dataset.anchor === 'bottom' ? b0.bottom : mediaBottom;

    for (let pass = 0; pass < MAX_PASSES; pass++) {
        const b = rel(block);
        const width = b.right - b.left;
        // משבצות השורה שהלוגו נוגע בהן, בקואורדינטות של הבלוק
        const y0 = Math.max(0, snap(logo.top - GAP_Y - b.top, Math.floor));
        const y1 = Math.min(snap(logo.bottom + GAP_Y - b.top, Math.ceil), limit - b.top);
        if (y1 <= y0) {
            reset(block);
            return;
        }

        // לוגו באמצע שמשאיר לידו טור צר עלול להיכנס למחזור בלי נקודת
        // שיווי משקל: השורות הצרות מגביהות את הבלוק מעל הלוגו, מעליו הן
        // שוב רחבות, הבלוק מתכווץ - וחוזר חלילה. אם הצד לא התייצב, ההדרה
        // הופכת לרצועה ברוחב מלא: מספר השורות קבוע, הבלוק רק גדל עד
        // שהוא עוטף את הלוגו, וההתכנסות מובטחת
        const full = pass >= SIDE_PASSES;
        const wRight = full ? width : clamp(b.right - logo.left + GAP_X, 0, width);
        const wLeft = full ? width : clamp(logo.right + GAP_X - b.left, 0, width);
        // הצד הקרוב למרכז הלוגו. float ימני לצד המשולש השמאלי צריך
        // מקום לשניהם בשורה העליונה - אחרת הדפדפן מוריד אותו מתחת למשולש
        let right = !full && (logo.left + logo.right) / 2 > (b.left + b.right) / 2;
        if (right && tri && tri.w + wRight > width) right = false;

        let w: number, h: number, shape: string;
        if (right) {
            w = wRight;
            h = y1;
            shape = `inset(${y0}px 0 0 0)`;
            block.style.removeProperty('--logo-avoid-tri');
        } else if (tri) {
            // המשולש והלוגו באותו צד: שני float-ים שמאליים היו נערמים זה
            // ליד זה, ולכן float אחד עם צורה משולבת מחליף את ה-::before
            w = Math.max(tri.w, wLeft);
            h = Math.max(tri.h, y1);
            shape = `polygon(0 0, ${tri.w}px 0, 0 ${tri.h}px, 0 ${y0}px, ${wLeft}px ${y0}px, ${wLeft}px ${y1}px, 0 ${y1}px)`;
            block.style.setProperty('--logo-avoid-tri', 'none');
        } else {
            w = wLeft;
            h = y1;
            shape = `inset(${y0}px 0 0 0)`;
        }
        spacer.style.cssText =
            `display:block;float:${right ? 'right' : 'left'};width:${w}px;height:${h}px;shape-outside:${shape};`;

        // הבלוק לא זז ולא גדל - ה-float נמצא בדיוק מול הלוגו. בודקים את
        // שני הקצוות: תת-הכותרת גדלה כלפי מעלה, הכותרת כלפי מטה
        const a = rel(block);
        if (Math.abs(a.top - b.top) < 0.5 && Math.abs(a.bottom - b.bottom) < 0.5) return;
    }
}

function layout(node: HTMLElement) {
    const blocks = [...node.querySelectorAll('.logo-avoid')]
        .map((s) => s.parentElement)
        .filter((el): el is HTMLElement => el !== null);
    blocks.forEach(reset);
    const logo = node.querySelector('[data-ad-logo]');
    // המשבצת מוסתרת (נייד) - אין מה למדוד; ResizeObserver יקרא שוב כשתוצג
    if (!logo || !node.offsetWidth) return;

    // הכרטיס מוגדל ב-hover (scale) - כל המידות מומרות לפיקסלים של הפריסה
    const box = node.getBoundingClientRect();
    const k = box.width / node.offsetWidth || 1;
    const rel = (el: Element): Box => {
        const r = el.getBoundingClientRect();
        return {
            top: (r.top - box.top) / k,
            bottom: (r.bottom - box.top) / k,
            left: (r.left - box.left) / k,
            right: (r.right - box.left) / k,
        };
    };
    const logoBox = rel(logo);
    for (const block of blocks) clearBlock(block, logoBox, rel, box.height / k);
}

/**
 * הפרמטר הוא רק מפתח: כל שינוי בו (פרסומת אחרת, טקסט או מיקום לוגו
 * שנערכו) מפעיל מדידה מחדש.
 */
export const logoClearance: Action<HTMLElement, unknown> = (node) => {
    let raf = 0;
    const run = () => {
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => layout(node));
    };
    // רוחב המשבצת משתנה בין דסקטופ לטאבלט; ResizeObserver גם קורא מיד
    const ro = new ResizeObserver(run);
    ro.observe(node);
    // הגופן נטען ב-swap: הפריסה עם גופן הגיבוי שונה, ולכן מודדים שוב
    document.fonts?.addEventListener('loadingdone', run);
    return {
        update: run,
        destroy() {
            cancelAnimationFrame(raf);
            ro.disconnect();
            document.fonts?.removeEventListener('loadingdone', run);
        },
    };
};
