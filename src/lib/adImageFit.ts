// ============================================================
// adImageFit.ts — מיקום + זום של התמונה הראשית בפרסומת
// ------------------------------------------------------------
// הבילדר שומר לכל מודעה fit יחיד { x, y, z }:
//   x/y — נקודת המיקוד באחוזים (50/50 = מרכז), כמו object-position.
//   z   — זום יחסית ל-cover: 1 = מילוי המשבצת (ברירת המחדל),
//         גדול מ-1 = תקריב, קטן מ-1 = התרחקות (נחשף יותר מהתמונה,
//         עם שוליים ריקים על רקע הכרטיס הכהה).
//
// למה לא object-fit לבד: ‎cover‎ חותך תמיד למשבצת ואין לו "פחות
// מ-cover"; ‎transform:scale‎ מקטין רק את מה שכבר נחתך. לכן הפעולה
// (adImgFit) ממדדת את המשבצת ואת התמונה וקובעת width/left/top
// מפורשים — אותה סמנטיקה של object-position, מוכללת לכל זום.
// ה-fit נשמר עם המודעה (extra_fields.main_image_fit) ומוחל גם
// בתצוגות האמיתיות, כך שהדמו בבילדר הוא באמת "מה שרואים".
// ============================================================

export interface AdImageFit {
    x: number;
    y: number;
    z: number;
}

export const DEFAULT_AD_FIT: AdImageFit = { x: 50, y: 50, z: 1 };
export const AD_ZOOM_MIN = 0.4;
export const AD_ZOOM_MAX = 3;

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** מנרמל fit מקלט לא-בטוח (Strapi / localStorage / דפדפן) לערכים חוקיים. */
export function parseAdImageFit(raw: unknown): AdImageFit {
    if (!raw || typeof raw !== 'object') return { ...DEFAULT_AD_FIT };
    const o = raw as Record<string, unknown>;
    const num = (v: unknown, fallback: number) =>
        typeof v === 'number' && isFinite(v) ? v : fallback;
    return {
        x: clamp(num(o.x, 50), 0, 100),
        y: clamp(num(o.y, 50), 0, 100),
        z: clamp(num(o.z, 1), AD_ZOOM_MIN, AD_ZOOM_MAX),
    };
}

/** פעולת Svelte על <img> בתוך עוטף position:relative + overflow:hidden.
 *  לפני שהתמונה/המשבצת נמדדו נשאר ה-CSS הקיים (object-cover) — ולכן
 *  ב-SSR ובטעינה הראשונה אין קפיצה; המדידה מחליפה אותו באותו מראה. */
export function adImgFit(node: HTMLImageElement, fit: AdImageFit) {
    let current = fit;

    function apply() {
        const box = node.parentElement;
        if (!box) return;
        const W = box.clientWidth;
        const H = box.clientHeight;
        const w = node.naturalWidth;
        const h = node.naturalHeight;
        if (!W || !H || !w || !h) return;
        const { x, y, z } = parseAdImageFit(current);
        const k = Math.max(W / w, H / h) * z;
        const dw = w * k;
        const dh = h * k;
        node.style.position = 'absolute';
        node.style.width = `${dw}px`;
        node.style.height = `${dh}px`;
        node.style.left = `${((W - dw) * x) / 100}px`;
        node.style.top = `${((H - dh) * y) / 100}px`;
        // inset-0 / dir=rtl היו מושכים לצד הנגדי; left+top הם הקובעים
        node.style.right = 'auto';
        node.style.bottom = 'auto';
        node.style.maxWidth = 'none';
        node.style.maxHeight = 'none';
        node.style.objectFit = 'fill';
    }

    node.addEventListener('load', apply);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(apply) : null;
    if (ro && node.parentElement) ro.observe(node.parentElement);
    apply();

    return {
        update(next: AdImageFit) {
            current = next;
            apply();
        },
        destroy() {
            node.removeEventListener('load', apply);
            ro?.disconnect();
        },
    };
}
