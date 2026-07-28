// ============================================================
// adOwner.ts — עזרי תצוגה לדשבורד המפרסם (/advertise/manage)
// סטטוס, תוקף, אחוזי הקלקה ותאריכים בעברית — מקום אחד לשני העמודים
// (רשימת הנכסים ודף הנכס הבודד).
// ============================================================

export type AdStatusKind = 'pending' | 'approved' | 'rejected';

/** מתחת לזה מוצגת קריאה לחידוש הפרסום */
export const RENEW_WARNING_DAYS = 7;

export interface StatusView {
    label: string;
    hint: string;
    /** ערכת צבע לגלולה — הדף מתרגם לקלאסים */
    tone: 'amber' | 'emerald' | 'rose' | 'slate';
}

/** מספר הימים שנותרו לפרסום. null = בלי תוקף (טרם אושרה). */
export function daysLeft(expiresAt: string | null | undefined): number | null {
    if (!expiresAt) return null;
    const ts = Date.parse(expiresAt);
    if (Number.isNaN(ts)) return null;
    return Math.ceil((ts - Date.now()) / (24 * 60 * 60 * 1000));
}

export function isExpired(status: AdStatusKind, expiresAt: string | null | undefined): boolean {
    const left = daysLeft(expiresAt);
    return status === 'approved' && left !== null && left <= 0;
}

export function needsRenewal(status: AdStatusKind, expiresAt: string | null | undefined): boolean {
    const left = daysLeft(expiresAt);
    return status === 'approved' && left !== null && left > 0 && left <= RENEW_WARNING_DAYS;
}

export function statusView(status: AdStatusKind, expiresAt?: string | null): StatusView {
    if (status === 'rejected') {
        return { label: 'נדחתה', hint: 'המודעה לא אושרה לפרסום', tone: 'rose' };
    }
    if (status === 'pending') {
        return { label: 'ממתינה לאישור', hint: 'נבדקת אצלנו — בדרך כלל תוך יום', tone: 'amber' };
    }
    if (isExpired('approved', expiresAt)) {
        return { label: 'פג תוקף', hint: 'הפרסום הסתיים והמודעה ירדה מהאתר', tone: 'slate' };
    }
    const left = daysLeft(expiresAt);
    return {
        label: 'באוויר',
        hint: left === null ? 'המודעה מוצגת באתר' : `נותרו ${left} ימי פרסום`,
        tone: 'emerald',
    };
}

/** "28.07.2026" — ריק אם אין תאריך */
export function fmtDate(iso: string | null | undefined): string {
    if (!iso) return '';
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    return d.toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** אחוז ההקלקה — "4.2%" (ריק כשאין חשיפות בכלל) */
export function ctr(clicks: number, impressions: number): string {
    if (!impressions) return '—';
    return `${((clicks / impressions) * 100).toFixed(1)}%`;
}
