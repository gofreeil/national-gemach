// ---- מודל שעות פעילות לימים שונים ----
// מקור: "קהילה בשכונה" (src/lib/openingHours.ts). שני האתרים כותבים לאותו שדה
// extra_fields.hours באותו Strapi, ולכן הפורמט חייב להישאר זהה — גמ"ח שנוצר
// שם נערך ומוצג כאן, ולהפך.
//
// נשמר כמחרוזת JSON, עם תאימות לאחור לטקסט חופשי ישן ("א-ה 9:00-13:00")
// ולפורמט הישן של טווח בודד ליום ({from,to} במקום ranges[]).

export interface TimeRange {
    from: string; // "HH:MM"
    to: string;   // "HH:MM"
}

export interface DayHours {
    open: boolean;
    /** טווחי שעות ליום — למשל בוקר וערב. לפחות טווח אחד */
    ranges: TimeRange[];
}

export interface OpeningHours {
    /** האם אותן שעות חלות על כל הימים הפתוחים */
    uniform: boolean;
    /** 7 ימים: 0=ראשון(א) ... 6=שבת(ש) */
    days: DayHours[];
}

/** תוויות קצרות עם גרש, לפי אינדקס יום (0=א ... 6=ש) */
export const DAY_SHORT = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'שבת'];
/** תוויות מלאות */
export const DAY_LONG = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];

const DEFAULT_RANGE: TimeRange = { from: '10:00', to: '18:00' };

export function emptyOpeningHours(): OpeningHours {
    return {
        uniform: true,
        days: Array.from({ length: 7 }, (_, i) => ({
            // ברירת מחדל: א׳-ה׳ פתוחים 10:00-18:00, ו׳-שבת סגורים
            open: i <= 4,
            ranges: [{ ...DEFAULT_RANGE }],
        })),
    };
}

/**
 * לוח ריק לגמרי — כל הימים סגורים.
 * זו נקודת הפתיחה של הטופס באתר הזה (בשונה מ"קהילה בשכונה"): שעות פעילות
 * הן שדה רשות, ולכן אסור שגמ"ח שאיש לא נגע בשעות שלו יישמר עם א׳-ה׳ 10:00-18:00
 * שהמערכת המציאה.
 */
export function closedOpeningHours(): OpeningHours {
    const oh = emptyOpeningHours();
    for (const d of oh.days) d.open = false;
    return oh;
}

/** מציע טווח המשך אחרי הטווח האחרון (למשל 10:00–18:00 → 19:00–21:00) */
export function nextRangeAfter(last: TimeRange | undefined): TimeRange {
    const toMin = (s: string) => {
        const [h, m] = s.split(':').map(Number);
        return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
    };
    const toStr = (min: number) => {
        const clamped = Math.min(min, 23 * 60 + 59);
        return `${String(Math.floor(clamped / 60)).padStart(2, '0')}:${String(clamped % 60).padStart(2, '0')}`;
    };
    const start = last ? toMin(last.to) + 60 : 19 * 60;
    return { from: toStr(start), to: toStr(start + 120) };
}

/** מנרמל ערך גולמי (JSON או טקסט ישן) לאובייקט OpeningHours, או null אם אינו מובנה */
export function parseOpeningHours(value: unknown): OpeningHours | null {
    if (value == null || value === '') return null;
    if (typeof value === 'object') {
        return normalize(value as Partial<OpeningHours>);
    }
    if (typeof value === 'string') {
        const s = value.trim();
        if (!s.startsWith('{')) return null; // טקסט חופשי ישן - לא מובנה
        try {
            return normalize(JSON.parse(s));
        } catch {
            return null;
        }
    }
    return null;
}

type LegacyDay = Partial<DayHours> & { from?: string; to?: string };

function normalizeRanges(src: LegacyDay, fallback: TimeRange[]): TimeRange[] {
    if (Array.isArray(src.ranges)) {
        const clean = src.ranges
            .filter((r) => r && typeof r.from === 'string' && typeof r.to === 'string')
            .map((r) => ({ from: r.from, to: r.to }));
        if (clean.length) return clean;
    }
    // פורמט ישן: from/to ישירות על היום
    if (typeof src.from === 'string' && src.from && typeof src.to === 'string' && src.to) {
        return [{ from: src.from, to: src.to }];
    }
    return fallback.map((r) => ({ ...r }));
}

function normalize(raw: Partial<OpeningHours>): OpeningHours {
    const base = emptyOpeningHours();
    const days: LegacyDay[] = Array.isArray(raw.days) ? raw.days : [];
    return {
        uniform: raw.uniform ?? true,
        days: base.days.map((d, i) => {
            const src: LegacyDay = days[i] ?? {};
            return {
                open: typeof src.open === 'boolean' ? src.open : d.open,
                ranges: normalizeRanges(src, d.ranges),
            };
        }),
    };
}

export function serializeOpeningHours(oh: OpeningHours): string {
    return JSON.stringify(oh);
}

/** האם יש בכלל מה להציג — לוח שכל ימיו סגורים שקול לשדה ריק */
export function hasOpenDays(oh: OpeningHours): boolean {
    return oh.days.some((d) => d.open);
}

function formatRanges(ranges: TimeRange[]): string {
    return ranges.map((r) => `${r.from}–${r.to}`).join(', ');
}

/**
 * שורות תצוגה קריאות, מקבצות ימים רצופים בעלי שעות זהות לטווח - שורה לכל קבוצה.
 * דוגמה: ["א׳–ה׳ 10:00–18:00", "ו׳ 09:00–13:00, 16:00–18:00", "שבת סגור"]
 * אם הערך אינו מובנה (טקסט ישן) - מוחזר כשורה אחת כמו שהוא.
 */
export function formatOpeningHoursLines(value: unknown): string[] {
    const oh = parseOpeningHours(value);
    if (!oh) {
        const s = value == null ? '' : String(value);
        return s.trim() ? [s] : [];
    }
    // לוח שכולו סגור — אין מה להציג (ראו closedOpeningHours)
    if (!hasOpenDays(oh)) return [];

    const keyOf = (d: DayHours) => (d.open ? formatRanges(d.ranges) : 'closed');
    const parts: string[] = [];
    let i = 0;
    while (i < 7) {
        const d = oh.days[i];
        // מצא רצף ימים עם אותו סטטוס ואותן שעות
        let j = i;
        while (j + 1 < 7 && keyOf(oh.days[j + 1]) === keyOf(d)) {
            j++;
        }
        const label = i === j ? DAY_SHORT[i] : `${DAY_SHORT[i]}–${DAY_SHORT[j]}`;
        parts.push(d.open ? `${label} ${formatRanges(d.ranges)}` : `${label} סגור`);
        i = j + 1;
    }
    return parts;
}

/** גרסת שורה-אחת (מופרדת ב-·) — לכרטיסים ולתצוגות צפופות */
export function formatOpeningHours(value: unknown): string {
    return formatOpeningHoursLines(value).join(' · ');
}

const SCHEMA_DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * openingHoursSpecification ל-schema.org (LocalBusiness) — כך גוגל מציג
 * "פתוח/סגור" בתוצאות החיפוש. ריק כשהשעות אינן מובנות.
 */
export function toSchemaOpeningHours(
    value: unknown,
): Array<{ '@type': string; dayOfWeek: string; opens: string; closes: string }> {
    const oh = parseOpeningHours(value);
    if (!oh) return [];
    return oh.days.flatMap((d, i) =>
        d.open
            ? d.ranges.map((r) => ({
                  '@type': 'OpeningHoursSpecification',
                  dayOfWeek: `https://schema.org/${SCHEMA_DAYS[i]}`,
                  opens: r.from,
                  closes: r.to,
              }))
            : [],
    );
}

/** מספר דקות מחצות עבור "HH:MM" (חסין לערכים לא-תקינים) */
function hhmmToMinutes(s: string): number {
    const [h, m] = String(s).split(':').map(Number);
    return (Number.isFinite(h) ? h : 0) * 60 + (Number.isFinite(m) ? m : 0);
}

/**
 * האם הגמ"ח פתוח כרגע לפי שעות הפעילות המובנות.
 * מחזיר:
 *   null  – אין שעות מובנות (טקסט חופשי ישן / ריק) → אין להסיק פתוח/סגור
 *   true  – פתוח כרגע
 *   false – סגור כרגע
 * תומך בטווח שחוצה חצות (למשל 22:00–02:00): החלק שלפני חצות מיוחס ליום ההתחלה,
 * וההמשך שאחרי חצות נבדק גם מול היום הקודם.
 * @param now לבדיקות/דטרמיניזם – ברירת מחדל הזמן הנוכחי.
 */
export function isOpenNow(value: unknown, now: Date = new Date()): boolean | null {
    const oh = parseOpeningHours(value);
    if (!oh || !hasOpenDays(oh)) return null;

    const day = now.getDay();                          // 0=ראשון ... 6=שבת — תואם ל-days[]
    const mins = now.getHours() * 60 + now.getMinutes();

    // טווח רגיל (to>from): [from,to). טווח שחוצה חצות (to<=from): מ-from עד חצות.
    const openTodayIn = (d: DayHours | undefined): boolean =>
        !!d?.open && d.ranges.some((r) => {
            const from = hhmmToMinutes(r.from);
            const to = hhmmToMinutes(r.to);
            return to > from ? mins >= from && mins < to : mins >= from;
        });

    if (openTodayIn(oh.days[day])) return true;

    // המשך טווח-לילה שהתחיל אתמול (22:00–02:00 → פתוח גם ב-01:00 של היום הבא)
    const prev = oh.days[(day + 6) % 7];
    if (prev?.open && prev.ranges.some((r) => {
        const from = hhmmToMinutes(r.from);
        const to = hhmmToMinutes(r.to);
        return to <= from && mins < to;
    })) return true;

    return false;
}
