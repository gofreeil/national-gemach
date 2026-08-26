// ============================================================
// חיפוש טקסט עברי סלחני - לוגיקה אחידה לכל חיפוש/סינון/השלמה באתר.
//
// למה: משתמשים מקלידים בסדר טבעי ובכתיב חופשי, בעוד המקורות (מאגר רחובות
// ממשלתי, כותרות פריטים, שמות) שומרים סדר/כתיב אחר. דוגמה קלאסית: הרחוב
// "ויטל חיים" (שם-משפחה קודם) שגולש מחפש כ"חיים ויטאל". חיפוש substring
// נאיבי מפספס. הפתרון:
//   1. נורמליזציה: אותיות קטנות, הסרת גרשיים/מרכאות, איחוד רווחים.
//   2. התאמה לפי מילים בכל סדר (order-independent) - כל מילה שהוקלדה חייבת
//      להופיע (כתחילת/חלק) של מילה כלשהי ביעד.
//   3. שכבת "כתיב רופף": התעלמות מאמות קריאה (א/ו/י) לגישור כתיב מלא/חסר
//      (ויטל↔ויטאל, דוד↔דויד), רק כשההתאמה המדויקת נכשלה.
//
// שתי כניסות עיקריות:
//   heMatches(query, ...fields) → boolean   — לסינון רשימות (רב-שדות)
//   heRank(query, items, getText)  → T[]     — להשלמה/דירוג (typeahead)
// ============================================================

/** ניקוי בסיסי: אותיות קטנות (למחרוזות מעורבות אנגלית), הסרת גרשיים/מרכאות,
 *  איחוד רווחים ו-trim. עברית חסרת case כך שה-toLowerCase לא מזיק לה. */
export function normalizeHe(s: string | null | undefined): string {
    return String(s ?? '')
        .toLowerCase()
        .replace(/["'׳״`]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

/** כתיב רופף: מסיר אמות קריאה (א/ו/י) כדי לגשר על כתיב מלא/חסר. */
export function loosenHe(s: string): string {
    return s.replace(/[אוי]/g, '');
}

/** האם כל מילות q מופיעות (כתחילת/חלק) במילות target - בכל סדר. */
function tokensCover(qTokens: string[], targetTokens: string[]): boolean {
    return (
        qTokens.length > 0 &&
        qTokens.every((qt) => targetTokens.some((tt) => tt.startsWith(qt) || tt.includes(qt)))
    );
}

/**
 * סינון בוליאני לרשימות עם כמה שדות. מאחד את כל השדות ל"ערימת חיפוש" אחת
 * ודורש שכל מילה שהוקלדה תופיע בה (בכל סדר), עם נפילה לכתיב רופף.
 * שאילתה ריקה → true (הכל עובר).
 *
 * @example items.filter(i => heMatches(query, i.label, i.description, i.city))
 */
export function heMatches(query: string, ...fields: (string | null | undefined)[]): boolean {
    const q = normalizeHe(query);
    if (!q) return true;
    const hay = fields.map((f) => normalizeHe(f)).filter(Boolean).join(' ');
    if (!hay) return false;

    const qTokens = q.split(' ').filter(Boolean);
    if (qTokens.every((t) => hay.includes(t))) return true;

    // שכבת כתיב רופף (רק אם ההתאמה המדויקת נכשלה)
    const looseHay = loosenHe(hay);
    const looseTokens = qTokens.map(loosenHe).filter(Boolean);
    return looseTokens.length > 0 && looseTokens.every((t) => looseHay.includes(t));
}

/**
 * ציון התאמה של שאילתה מול מחרוזת יעד יחידה, לצורך דירוג:
 *   0 = היעד מתחיל בשאילתה (הכי טוב)
 *   1 = היעד מכיל את השאילתה כרצף
 *   2 = התאמת מילים בכל סדר
 *   3 = התאמת מילים בכתיב רופף
 *  -1 = אין התאמה
 */
export function heScore(query: string, target: string): number {
    const q = normalizeHe(query);
    if (!q) return 0;
    const ns = normalizeHe(target);
    if (!ns) return -1;
    if (ns.startsWith(q)) return 0;
    if (ns.includes(q)) return 1;

    const qTokens = q.split(' ').filter(Boolean);
    const sTokens = ns.split(' ').filter(Boolean);
    if (tokensCover(qTokens, sTokens)) return 2;

    const qLoose = qTokens.map(loosenHe).filter(Boolean);
    const sLoose = sTokens.map(loosenHe).filter(Boolean);
    if (tokensCover(qLoose, sLoose)) return 3;

    return -1;
}

/** true אם יש התאמה כלשהי בין השאילתה למחרוזת היעד (heScore ≥ 0). */
export function heMatch(query: string, target: string): boolean {
    return heScore(query, target) >= 0;
}

/**
 * דירוג + סינון רשימה לפי טקסט מחולץ מכל פריט. מוחזרת ממוינת מהטובה להתאמה
 * החלשה (מתחיל → מכיל → מילים → רופף); בתוך אותה רמה נשמר הסדר המקורי.
 * שאילתה ריקה → הרשימה כמו שהיא (עד limit).
 *
 * @example heRank(input, streets, s => s, 80)
 */
export function heRank<T>(
    query: string,
    items: readonly T[],
    getText: (item: T) => string,
    limit = 80,
): T[] {
    const q = normalizeHe(query);
    if (!q) return items.slice(0, limit);
    const scored: { item: T; score: number; i: number }[] = [];
    items.forEach((item, i) => {
        const score = heScore(query, getText(item));
        if (score >= 0) scored.push({ item, score, i });
    });
    // מיון יציב: קודם לפי איכות ההתאמה, ואז לפי הסדר המקורי
    scored.sort((a, b) => a.score - b.score || a.i - b.i);
    return scored.slice(0, limit).map((s) => s.item);
}
