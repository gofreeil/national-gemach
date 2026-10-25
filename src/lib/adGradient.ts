// ============================================================
// adGradient.ts — צבע הרצועה והכפתור של פרסומת, בדיוק כמו ב"קהילה בשכונה"
// ------------------------------------------------------------
// באתר הזה הגרדיאנט נשמר כמחרוזת CSS (linear-gradient(135deg, …)),
// ובקהילה בשכונה כזוג מחלקות Tailwind שמצוירות עם bg-gradient-to-br
// (הרצועה) ו-bg-gradient-to-r (הכפתור). זווית 135deg על משבצת צרה
// וגבוהה, וצבעי hex במקום צבעי ה-oklch של Tailwind, יצאו בגוון אחר -
// ולכן פרסומת שהופצה משם נראתה כאן אחרת.
// כאן מתרגמים כל צבע מהפלטה (אותה פלטה של 22 צבעים בשני האתרים)
// בחזרה לזוג המחלקות, והכרטיס מצויר באותן מחלקות בדיוק. מחרוזת שאינה
// בפלטה ממשיכה להיצבע כמו-שהיא (inline).
// הערה: המחלקות כתובות כמחרוזות מלאות - חובה, אחרת Tailwind לא מייצר אותן.
// ============================================================

const CSS_TO_TAILWIND: Record<string, string> = {
    'linear-gradient(135deg, #f59e0b, #ea580c)': 'from-amber-500 to-orange-600',
    'linear-gradient(135deg, #f97316, #ef4444)': 'from-orange-500 to-red-500',
    'linear-gradient(135deg, #facc15, #f59e0b)': 'from-yellow-400 to-amber-500',
    'linear-gradient(135deg, #dc2626, #db2777)': 'from-red-600 to-pink-600',
    'linear-gradient(135deg, #f43f5e, #c026d3)': 'from-rose-500 to-fuchsia-600',
    'linear-gradient(135deg, #be123c, #7f1d1d)': 'from-rose-700 to-red-900',
    'linear-gradient(135deg, #d946ef, #9333ea)': 'from-fuchsia-500 to-purple-600',
    'linear-gradient(135deg, #9333ea, #db2777)': 'from-purple-600 to-pink-600',
    'linear-gradient(135deg, #7c3aed, #4338ca)': 'from-violet-600 to-indigo-700',
    'linear-gradient(135deg, #4f46e5, #2563eb)': 'from-indigo-600 to-blue-600',
    'linear-gradient(135deg, #2563eb, #0891b2)': 'from-blue-600 to-cyan-600',
    'linear-gradient(135deg, #38bdf8, #3b82f6)': 'from-sky-400 to-blue-500',
    'linear-gradient(135deg, #14b8a6, #0891b2)': 'from-teal-500 to-cyan-600',
    'linear-gradient(135deg, #10b981, #0f766e)': 'from-emerald-500 to-teal-700',
    'linear-gradient(135deg, #16a34a, #059669)': 'from-green-600 to-emerald-600',
    'linear-gradient(135deg, #a3e635, #22c55e)': 'from-lime-400 to-green-500',
    'linear-gradient(135deg, #64748b, #374151)': 'from-slate-500 to-gray-700',
    'linear-gradient(135deg, #1f2937, #0f172a)': 'from-gray-800 to-slate-900',
    'linear-gradient(135deg, #fdba74, #f472b6)': 'from-orange-300 to-pink-400',
    'linear-gradient(135deg, #6ee7b7, #2dd4bf)': 'from-emerald-300 to-teal-400',
    'linear-gradient(135deg, #eab308, #b45309)': 'from-yellow-500 to-amber-700',
    'linear-gradient(135deg, #334155, #1e3a8a)': 'from-slate-700 to-blue-900',
};

/** ברירת המחדל כשלמודעה אין גרדיאנט בכלל - אותה ברירת מחדל של הבילדר */
export const DEFAULT_AD_GRADIENT = 'linear-gradient(135deg, #f59e0b, #ea580c)';

function normalize(css: string): string {
    return css.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ')
        .replace(/\(\s+/g, '(').replace(/\s+\)/g, ')');
}

/**
 * זוג מחלקות ה-Tailwind של הגרדיאנט (from-… to-…), או '' כשהצבע אינו
 * מהפלטה. מקבל גם זוג מחלקות שכבר כתוב כך (נתון שהגיע ממקור Tailwind).
 */
export function adGradientClasses(value: string | null | undefined): string {
    const raw = (value ?? '').trim() || DEFAULT_AD_GRADIENT;
    if (!/gradient\(/.test(raw)) {
        const pair = raw.split(/\s+/).filter((c) => /^(from|to)-[a-z]+-\d{2,3}$/.test(c)).join(' ');
        return Object.values(CSS_TO_TAILWIND).includes(pair) ? pair : '';
    }
    return CSS_TO_TAILWIND[normalize(raw)] ?? '';
}

/**
 * מחלקות + style לשכבה צבועה בכרטיס. dir = כיוון הגרדיאנט כמו בקהילה
 * בשכונה: 'br' לרצועה האלכסונית, 'r' לכפתור. צבע שאינו בפלטה נצבע
 * inline כמו-שהוא.
 */
export function adGradientPaint(
    value: string | null | undefined,
    dir: 'br' | 'r',
): { cls: string; style: string } {
    const pair = adGradientClasses(value);
    if (pair) {
        return { cls: `${dir === 'br' ? 'bg-gradient-to-br' : 'bg-gradient-to-r'} ${pair}`, style: '' };
    }
    return { cls: '', style: `background: ${(value ?? '').trim() || DEFAULT_AD_GRADIENT};` };
}
