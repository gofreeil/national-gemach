// תקציב המשקל של מודעה שלמה — משותף לבונה (/advertise/builder) ולעורך
// דף הנחיתה (/advertise/builder/landing).
//
// כל המודעה — תמונות data-URI + טקסטים — נשלחת ל-Strapi בבקשת JSON אחת
// שמוגבלת ל-~1MB (koa-body). העיקרון: אף פעולה בבילדר לא משאירה את
// הטיוטה מעל התקציב. תמונה חדשה נכנסת רק אם כל המודעה נשארת מתחת
// לתקרה (אם צריך — מפנים מקום בכיווץ התמונות הקיימות), ומי שבאמת אין
// לו מקום נחסם בשלב עצמו עם הסבר — לא בשליחה הסופית.

/** תקרת גוף הבקשה בשליחה (שוליים מתחת ל-1MB של Strapi) */
export const AD_BODY_LIMIT = 900_000;
/** התקציב החי בזמן עריכה — שוליים נוספים לעטיפת השרת ולטקסטים שעוד יתווספו */
export const AD_EFFECTIVE_LIMIT = 860_000;

/** תקרות דחיסה בהעלאה (בייטים של הקובץ אחרי דחיסה) */
export const MAIN_IMAGE_MAX_BYTES = 450 * 1024;
export const SIDE_IMAGE_MAX_BYTES = 300 * 1024; // תמונת נחיתה / מוצר
export const LOGO_MAX_BYTES = 90 * 1024;

// רצפות איכות (אורך data-URI בתווים): מתחת לזה לא יורדים — עדיף לחסום
// את ההעלאה עם הסבר מאשר להגיש תמונה מרוחה.
const MIN_MAIN_CHARS = 160_000;
const MIN_SIDE_CHARS = 110_000;
const MIN_LOGO_CHARS = 40_000;

/** גודל הגוף כפי שיימדד בשליחה בפועל @param {unknown} obj */
export function bodyBytes(obj) {
    return new Blob([JSON.stringify(obj)]).size;
}

/** @param {string} dataUrl */
export function approxDataUrlBytes(dataUrl) {
    const i = dataUrl.indexOf(",");
    const b64 = i >= 0 ? dataUrl.slice(i + 1) : dataUrl;
    return Math.ceil((b64.length * 3) / 4);
}

/** תצוגת משקל ידידותית @param {number} bytes */
export function fmtWeight(bytes) {
    if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
    return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

/** @param {File} file @returns {Promise<string>} */
export function fileToDataUrl(file) {
    return new Promise((res, rej) => {
        const fr = new FileReader();
        fr.onload = () => res(String(fr.result));
        fr.onerror = rej;
        fr.readAsDataURL(file);
    });
}

/** @param {string} src @returns {Promise<HTMLImageElement>} */
function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("image load failed"));
        img.src = src;
    });
}

/**
 * דחיסת קובץ תמונה רגילה (JPEG) אל מתחת לתקרה.
 * @param {File} file
 * @param {number} maxBytes
 */
export async function compressImageToFit(file, maxBytes) {
    const originalBytes = file.size;
    if (file.size <= maxBytes) {
        const dataUrl = await fileToDataUrl(file);
        return { dataUrl, wasCompressed: false, originalBytes, finalBytes: originalBytes };
    }
    const img = await loadImage(await fileToDataUrl(file));

    let w = img.naturalWidth, h = img.naturalHeight;
    const MAX_EDGE = 2400;
    const longest = Math.max(w, h);
    if (longest > MAX_EDGE) {
        const scale = MAX_EDGE / longest;
        w = Math.round(w * scale);
        h = Math.round(h * scale);
    }
    let quality = 0.85;
    let dataUrl = "";
    for (let attempt = 0; attempt < 10; attempt++) {
        const canvas = document.createElement("canvas");
        canvas.width = w; canvas.height = h;
        const c = canvas.getContext("2d");
        if (!c) break;
        c.drawImage(img, 0, 0, w, h);
        dataUrl = canvas.toDataURL("image/jpeg", quality);
        if (approxDataUrlBytes(dataUrl) <= maxBytes) break;
        if (quality > 0.5) {
            quality -= 0.1;
        } else {
            w = Math.round(w * 0.85);
            h = Math.round(h * 0.85);
            quality = 0.7;
        }
    }
    return { dataUrl, wasCompressed: true, originalBytes, finalBytes: approxDataUrlBytes(dataUrl) };
}

/** האם לתמונה יש פיקסלים שקופים (נבדק על הקטנה — מהיר) @param {HTMLImageElement} img */
function imageHasAlpha(img) {
    try {
        const probe = document.createElement("canvas");
        probe.width = 64; probe.height = 64;
        const c = probe.getContext("2d");
        if (!c) return true; // ספק — שומרים על PNG ליתר ביטחון
        c.drawImage(img, 0, 0, 64, 64);
        const data = c.getImageData(0, 0, 64, 64).data;
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] < 250) return true;
        }
        return false;
    } catch {
        return true;
    }
}

/**
 * דחיסת לוגו: מוקטן ל-≤512px; עם שקיפות נשאר PNG (הקטנת מידות בלבד),
 * בלי שקיפות עובר ל-JPEG. לוגו הוא אלמנט קטן בתצוגה — אין סיבה שישקול
 * מאות KB ויגנוב את תקציב המודעה מהתמונות הגדולות.
 * @param {File} file
 */
export async function compressLogoFile(file) {
    const originalBytes = file.size;
    if (file.size <= LOGO_MAX_BYTES) {
        const dataUrl = await fileToDataUrl(file);
        return { dataUrl, wasCompressed: false, originalBytes, finalBytes: originalBytes };
    }
    const img = await loadImage(await fileToDataUrl(file));
    const alpha = file.type === "image/jpeg" ? false : imageHasAlpha(img);
    const longest = Math.max(img.naturalWidth, img.naturalHeight) || 1;

    let dataUrl = "";
    if (alpha) {
        for (const edge of [512, 448, 384, 320, 256, 224, 192, 160, 128]) {
            const scale = Math.min(1, edge / longest);
            const w = Math.max(1, Math.round(img.naturalWidth * scale));
            const h = Math.max(1, Math.round(img.naturalHeight * scale));
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const c = canvas.getContext("2d");
            if (!c) break;
            c.drawImage(img, 0, 0, w, h);
            dataUrl = canvas.toDataURL("image/png");
            if (approxDataUrlBytes(dataUrl) <= LOGO_MAX_BYTES) break;
        }
    } else {
        const scale = Math.min(1, 512 / longest);
        let w = Math.max(1, Math.round(img.naturalWidth * scale));
        let h = Math.max(1, Math.round(img.naturalHeight * scale));
        let quality = 0.85;
        for (let attempt = 0; attempt < 10; attempt++) {
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const c = canvas.getContext("2d");
            if (!c) break;
            c.drawImage(img, 0, 0, w, h);
            dataUrl = canvas.toDataURL("image/jpeg", quality);
            if (approxDataUrlBytes(dataUrl) <= LOGO_MAX_BYTES) break;
            if (quality > 0.5) quality -= 0.1;
            else { w = Math.round(w * 0.85); h = Math.round(h * 0.85); quality = 0.7; }
        }
    }
    if (!dataUrl) dataUrl = await fileToDataUrl(file);
    return { dataUrl, wasCompressed: true, originalBytes, finalBytes: approxDataUrlBytes(dataUrl) };
}

/** דחיסה מחדש של data-URI (JPEG) אל מתחת ליעד — אורך מחרוזת בתווים.
 * @param {string} dataUrl
 * @param {number} maxChars */
export async function recompressDataUrl(dataUrl, maxChars) {
    try {
        const img = await loadImage(dataUrl);
        let w = img.naturalWidth, h = img.naturalHeight;
        let quality = 0.75;
        let out = dataUrl;
        for (let attempt = 0; attempt < 12; attempt++) {
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const c = canvas.getContext("2d");
            if (!c) return dataUrl;
            c.drawImage(img, 0, 0, w, h);
            out = canvas.toDataURL("image/jpeg", quality);
            if (out.length <= maxChars) return out;
            if (quality > 0.45) quality -= 0.1;
            else { w = Math.round(w * 0.8); h = Math.round(h * 0.8); quality = 0.6; }
        }
        return out;
    } catch {
        return dataUrl;
    }
}

/** הקטנת PNG במידות בלבד — שומר שקיפות (ללוגו).
 * @param {string} dataUrl
 * @param {number} maxChars */
export async function shrinkDataUrlKeepAlpha(dataUrl, maxChars) {
    try {
        const img = await loadImage(dataUrl);
        let w = img.naturalWidth, h = img.naturalHeight;
        let out = dataUrl;
        for (let attempt = 0; attempt < 10 && out.length > maxChars; attempt++) {
            w = Math.max(64, Math.round(w * 0.75));
            h = Math.max(64, Math.round(h * 0.75));
            const canvas = document.createElement("canvas");
            canvas.width = w; canvas.height = h;
            const c = canvas.getContext("2d");
            if (!c) return out;
            c.drawImage(img, 0, 0, w, h);
            out = canvas.toDataURL("image/png");
            if (w <= 64 && h <= 64) break;
        }
        return out;
    } catch {
        return dataUrl;
    }
}

/**
 * מכווץ את תמונות המודעה (הגדולה קודם) עד שהגוף כולו נכנס מתחת לתקרה.
 * הלוגו אחרון בתור ומכווץ בהקטנת מידות בלבד (שומר שקיפות).
 * עובד על צורת ה-payload של השליחה: { logo, mainImage, landing: { image, products: [{image}] } }.
 * @param {any} payload
 * @param {number} [limit]
 * @returns {Promise<{ ok: boolean, changed: boolean }>}
 */
export async function shrinkAdPayload(payload, limit = AD_BODY_LIMIT) {
    let changed = false;
    let prev = Infinity;
    for (let round = 0; round < 40; round++) {
        const size = bodyBytes(payload);
        if (size <= limit) break;
        if (size >= prev) break; // אין התקדמות — עוצרים במקום להסתחרר
        prev = size;

        /** @type {Array<{ cur: string, floor: number, png: boolean, apply: (v: string) => void }>} */
        const imgs = [];
        /** @param {string} cur @param {number} floor @param {boolean} png @param {(v: string) => void} apply */
        const push = (cur, floor, png, apply) => {
            if (typeof cur === "string" && cur.startsWith("data:image/")) imgs.push({ cur, floor, png, apply });
        };
        push(payload.mainImage, MIN_MAIN_CHARS, false, (v) => { payload.mainImage = v; });
        push(payload.landing?.image, MIN_SIDE_CHARS, false, (v) => { payload.landing.image = v; });
        for (const p of payload.landing?.products ?? []) push(p.image, MIN_SIDE_CHARS, false, (v) => { p.image = v; });
        push(payload.logo, MIN_LOGO_CHARS, true, (v) => { payload.logo = v; });

        const candidates = imgs
            .filter((i) => i.cur.length > i.floor)
            // קודם תמונות ה-JPEG הגדולות; הלוגו (PNG) רק כשאין ברירה אחרת
            .sort((a, b) => (a.png === b.png ? b.cur.length - a.cur.length : a.png ? 1 : -1));
        const big = candidates[0];
        if (!big) break;

        const target = Math.max(big.floor, Math.floor(big.cur.length * 0.6));
        const next = big.png
            ? await shrinkDataUrlKeepAlpha(big.cur, target)
            : await recompressDataUrl(big.cur, target);
        if (next.length < big.cur.length) {
            big.apply(next);
            changed = true;
        } else {
            break; // הדחיסה לא הקטינה — אין טעם להמשיך
        }
    }
    return { ok: bodyBytes(payload) <= limit, changed };
}

/** שם התמונה הכבדה ביותר במודעה — להודעות שגיאה מדויקות.
 * @param {any} payload */
export function heaviestImageLabel(payload) {
    let bestLabel = "";
    let bestLen = -1;
    /** @param {string} label @param {unknown} cur */
    const consider = (label, cur) => {
        if (typeof cur !== "string" || !cur.startsWith("data:image/")) return;
        if (cur.length > bestLen) { bestLen = cur.length; bestLabel = label; }
    };
    consider("התמונה הראשית", payload?.mainImage);
    consider("הלוגו", payload?.logo);
    consider("תמונת דף הנחיתה", payload?.landing?.image);
    (payload?.landing?.products ?? []).forEach((/** @type {any} */ p, /** @type {number} */ i) => {
        consider(`תמונת מוצר ${i + 1}`, p?.image);
    });
    return bestLabel;
}
