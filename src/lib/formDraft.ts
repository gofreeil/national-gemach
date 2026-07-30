// ============================================================
// טיוטות טפסים — מה שמילאת לא הולך לאיבוד
//
// כל טופס ארוך באתר שומר את עצמו ל-localStorage תוך כדי הקלדה, ומשחזר את
// עצמו כשחוזרים אליו — אחרי מעבר לדף אחר, סגירת הכרטיסייה, רענון או נפילת
// רשת. המשתמש לא אמור לשלם על יציאה מהדף בעשר דקות של מילוי טופס.
//
// למה localStorage ולא snapshot של SvelteKit: snapshot חי רק בתוך היסטוריית
// הניווט של הכרטיסייה (חזור/קדימה) ומת ברענון או בסגירה. כאן צריך משהו
// ששורד גם סגירת דפדפן.
//
// מה לא נשמר: שדות סיסמה, קודי אימות ופרטי תשלום. ראה SENSITIVE_FIELDS.
// ============================================================

import { browser } from '$app/environment';

const PREFIX = 'ng:draft:';
/** טיוטה מתיישנת — לא רוצים לשחזר טופס משוכח מלפני חודשיים */
const TTL_MS = 14 * 24 * 60 * 60 * 1000;

/** שדות שלעולם לא נשמרים בטיוטה, גם אם הם חלק מהטופס */
const SENSITIVE_FIELDS = /password|passwd|otp|code|cvv|card|credit|token|secret/i;

type Envelope<T> = { at: number; data: T };

function keyOf(name: string): string {
    return PREFIX + name;
}

// מפתחות שנוקו במפורש (בדרך כלל אחרי שמירה מוצלחת). בלי זה היה מרוץ: הניווט
// שאחרי השמירה מפרק את הטופס, ה-flush האחרון היה כותב את הטיוטה בחזרה —
// והמשתמש היה מקבל אותה שוב בכניסה הבאה, כאילו לא שלח כלום.
const suppressed = new Set<string>();

/** שומר טיוטה. חריגה ממכסת האחסון לא מפילה את הטופס — פשוט לא נשמר. */
export function saveDraft<T>(name: string, data: T): void {
    if (!browser || suppressed.has(name)) return;
    try {
        const env: Envelope<T> = { at: Date.now(), data };
        localStorage.setItem(keyOf(name), JSON.stringify(env));
    } catch {
        // QuotaExceeded (בדרך כלל תמונות data-URI כבדות) — מוותרים על הטיוטה
        try { localStorage.removeItem(keyOf(name)); } catch { /* אין מה לעשות */ }
    }
}

/** מחזיר טיוטה שמורה, או null אם אין / פגה / נשברה */
export function loadDraft<T>(name: string): T | null {
    if (!browser) return null;
    try {
        const raw = localStorage.getItem(keyOf(name));
        if (!raw) return null;
        const env = JSON.parse(raw) as Envelope<T>;
        if (!env || typeof env.at !== 'number' || Date.now() - env.at > TTL_MS) {
            clearDraft(name);
            return null;
        }
        return env.data ?? null;
    } catch {
        clearDraft(name);
        return null;
    }
}

/** מוחק טיוטה וחוסם כתיבה נוספת עד לטעינה הבאה של הטופס (ראה `suppressed`) */
export function clearDraft(name: string): void {
    suppressed.add(name);
    if (!browser) return;
    try { localStorage.removeItem(keyOf(name)); } catch { /* אין מה לעשות */ }
}

/** מחזיר שמירה אוטומטית אחרי clearDraft — למי שניקה טופס ורוצה להתחיל מחדש */
export function resumeDraft(name: string): void {
    suppressed.delete(name);
}

/** ברירת המחדל: FormData → אובייקט. שדה שחוזר כמה פעמים נשמר כמערך. */
export function formDataToObject(fd: FormData): Record<string, string | string[]> {
    const out: Record<string, string | string[]> = {};
    for (const [k, v] of fd.entries()) {
        if (typeof v !== 'string') continue;          // קבצים לא נשמרים בטיוטה
        if (SENSITIVE_FIELDS.test(k)) continue;
        const cur = out[k];
        if (cur === undefined) out[k] = v;
        else if (Array.isArray(cur)) cur.push(v);
        else out[k] = [cur, v];
    }
    return out;
}

export interface FormDraftOptions<T> {
    /** מזהה הטיוטה. לטופס עריכה — לכלול את מזהה הרשומה. */
    key: string;
    /** ממיר את תוכן הטופס לאובייקט שיישמר. ברירת מחדל: formDataToObject */
    serialize?: (fd: FormData) => T;
    /** false = לא לשמור (למשל טופס לקריאה בלבד) */
    enabled?: boolean;
}

const DEBOUNCE_MS = 400;

/**
 * `use:formDraft={{ key }}` על אלמנט <form> — שומר את הטופס תוך כדי הקלדה.
 * השמירה נדחית ב-400ms כדי לא לכתוב על כל תו, אבל נכפית מיד כשעוזבים את
 * הדף (pagehide/visibilitychange) — זה בדיוק הרגע שבו התוכן הלך לאיבוד עד היום.
 *
 * הניקוי אינו כאן: את clearDraft קורא הדף אחרי שמירה מוצלחת בשרת, כדי
 * ששמירה שנכשלה תשאיר את הטיוטה במקומה.
 */
export function formDraft<T>(node: HTMLFormElement, options: FormDraftOptions<T>) {
    let opts = options;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // טופס שנטען מחדש = פרק חדש: אם הטיוטה נוקתה בשליחה קודמת, מחזירים שמירה
    resumeDraft(opts.key);

    const snapshot = () => {
        if (opts.enabled === false) return;
        const serialize = opts.serialize ?? (formDataToObject as unknown as (fd: FormData) => T);
        try {
            saveDraft(opts.key, serialize(new FormData(node)));
        } catch { /* טופס בתהליך פירוק — לא נורא */ }
    };

    const flush = () => {
        if (timer) clearTimeout(timer);
        timer = undefined;
        snapshot();
    };

    const schedule = () => {
        if (timer) clearTimeout(timer);
        timer = setTimeout(snapshot, DEBOUNCE_MS);
    };

    // input/change מכסים גם שדות מוסתרים שמעדכן קוד (תגים, תמונות, נושאים)
    // רק אם מישהו יורה אירוע. לכן יש גם MutationObserver על ערכי ה-hidden.
    node.addEventListener('input', schedule);
    node.addEventListener('change', schedule);

    const observer = new MutationObserver(schedule);
    observer.observe(node, { subtree: true, childList: true, attributes: true, attributeFilter: ['value'] });

    // עזיבת הדף — הרגע הקריטי. visibilitychange תופס גם מעבר לאפליקציה אחרת
    // בנייד, ששם המערכת עלולה להרוג את הכרטיסייה בלי pagehide.
    const onLeave = () => flush();
    const onVisibility = () => { if (document.visibilityState === 'hidden') flush(); };
    window.addEventListener('pagehide', onLeave);
    document.addEventListener('visibilitychange', onVisibility);

    return {
        update(next: FormDraftOptions<T>) { opts = next; },
        destroy() {
            flush();   // ניווט פנימי ב-SvelteKit מפרק את הקומפוננטה בלי pagehide
            if (timer) clearTimeout(timer);
            observer.disconnect();
            node.removeEventListener('input', schedule);
            node.removeEventListener('change', schedule);
            window.removeEventListener('pagehide', onLeave);
            document.removeEventListener('visibilitychange', onVisibility);
        }
    };
}
