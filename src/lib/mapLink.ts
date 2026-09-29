// ============================================================
// mapLink.ts — קישורים בטקסט חופשי, בעיקר קישורי מפה (Google Maps / Waze)
// שבעלים מדביקים ב"הוראות הגעה". משותף לתצוגה (קישור לחיץ ומקוצר — כתובת
// ארוכה כמו maps.app.goo.gl/... גלשה מחוץ לכרטיס בנייד) ולשרת (geocode.ts
// מציב את הפין לפי הקישור, כי הוא מדויק יותר מכל גיאוקודינג של הכתובת).
// ============================================================

/** כתובת בתוך טקסט; פיסוק בסוף משפט לא נכלל בה */
const URL_RE = /https?:\/\/[^\s<>"']+[^\s<>"'.,;:!?)\]]/gi;

const MAP_HOST = /^https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|(?:www\.|ul\.)?waze\.com)(?:[/?#]|$)/i;

export const isMapLink = (url: string): boolean => MAP_HOST.test(url);

/** קישור המפה הראשון בטקסט, או null */
export function firstMapLink(text: string | null | undefined): string | null {
    for (const m of (text ?? '').matchAll(URL_RE)) if (isMapLink(m[0])) return m[0];
    return null;
}

export interface TextPart {
    text: string;
    href?: string;
}

/** מפרק טקסט לקטעים; כתובת הופכת לקישור — קישור מפה מוצג כ"פתיחה במפה" */
export function linkParts(text: string): TextPart[] {
    const out: TextPart[] = [];
    let last = 0;
    for (const m of text.matchAll(URL_RE)) {
        const at = m.index ?? 0;
        if (at > last) out.push({ text: text.slice(last, at) });
        const href = m[0];
        out.push({ href, text: isMapLink(href) ? '🗺️ פתיחה במפה' : href.replace(/^https?:\/\/(www\.)?/i, '') });
        last = at + href.length;
    }
    if (last < text.length) out.push({ text: text.slice(last) });
    return out;
}
