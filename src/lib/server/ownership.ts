// ============================================================
// ownership.ts — האם המשתמש המחובר הוא בעל הגמ"ח
//
// ה-user_id בפריטי Strapi נשמר בפורמט לא-אחיד (ראה db.ts ונתוני האמת):
//   • מזהה מספרי של Strapi   — "2"
//   • תבנית <provider>_<id>  — "credentials_mail@x.com" (נוצר באתר "קהילה בשכונה")
// לכן משווים מול קבוצת כל המזהים האפשריים של המשתמש הנוכחי.
// פריטי ייבוא (user_id שמתחיל ב-"sheet:") אינם בבעלות אף משתמש — רק אדמין עורך.
// ============================================================

export interface OwnerSessionLike {
    id?: string | null;
    email?: string | null;
}

const SHEET_PREFIX = 'sheet:';
const PROVIDERS = ['credentials', 'google', 'facebook'];

/** כל צורות המזהה שבהן ה-user_id של פריט עשוי להצביע על המשתמש הזה */
export function ownerCandidateKeys(user: OwnerSessionLike): Set<string> {
    const keys = new Set<string>();
    const id = (user.id ?? '').toString().trim();
    const email = (user.email ?? '').trim().toLowerCase();
    if (id) {
        keys.add(id);
        for (const p of PROVIDERS) keys.add(`${p}_${id}`);
    }
    if (email) {
        keys.add(email);
        for (const p of PROVIDERS) keys.add(`${p}_${email}`);
    }
    return keys;
}

/**
 * מזהה-הבעלים שנכתב לפריט שהמשתמש הזה יוצר/מאמץ.
 * תבנית credentials_<email> היא זו שבה "קהילה בשכונה" מזהה בעלות — כך אותו
 * משתמש עורך את הגמ"ח בשני האתרים. נפילה-אחורה למזהה המספרי של Strapi אם
 * משום-מה אין מייל בסשן. '' = אין מזהה שמיש.
 */
export function ownerIdForSession(user: OwnerSessionLike): string {
    const email = (user.email ?? '').trim().toLowerCase();
    if (email) return `credentials_${email}`;
    return (user.id ?? '').toString().trim();
}

// ------------------------------------------------------------
// התאמת פרטי-קשר לבקשת בעלות: הצעת "זה הגמ"ח שלי" מוצגת רק למשתמש
// שהפרטים שלו (טלפון / מייל / שם) באמת מופיעים בפרטי הגמ"ח — לא לכל מחובר.
// ------------------------------------------------------------

export interface ClaimMatchUser extends OwnerSessionLike {
    name?: string | null;
    phone?: string | null;
}

export interface ClaimMatchGemach {
    name?: string;
    contact?: string;
    contact2?: string;
    phone?: string;
    phone2?: string;
    link?: string;
    notes?: string;
    description?: string;
}

/** ספרות בלבד, קידומת בינלאומית 972 → 0 מקומי */
function normalizePhone(s: string): string {
    let d = s.replace(/\D/g, '');
    if (d.startsWith('972')) d = '0' + d.slice(3);
    return d;
}

/** טקסט להשוואת שמות: בלי גרשיים/פיסוק, רווחים מכווצים, אותיות קטנות */
function normalizeText(s: string): string {
    return s.replace(/["'״׳().,\-–—/\\]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * האם פרטי המשתמש המחובר תואמים לפרטי הגמ"ח:
 *   • הטלפון שלו זהה לאחד מטלפוני הגמ"ח (השוואת ספרות), או
 *   • המייל שלו מופיע בקישור/הערות/תיאור, או
 *   • שמו מופיע בשם הגמ"ח או באנשי הקשר (לפחות שתי מילים משמו,
 *     או המילה היחידה כששמו בן מילה אחת).
 * ההתאמה היא רק שער לתצוגת ההצעה — הבקשה עצמה עדיין ממתינה לאישור אדמין.
 */
export function isClaimMatch(user: ClaimMatchUser, g: ClaimMatchGemach): boolean {
    const userPhone = normalizePhone(user.phone ?? '');
    if (userPhone.length >= 9) {
        for (const p of [g.phone, g.phone2]) {
            if (p && normalizePhone(p) === userPhone) return true;
        }
    }

    const email = (user.email ?? '').trim().toLowerCase();
    if (email) {
        const hay = [g.link, g.notes, g.description].filter(Boolean).join(' ').toLowerCase();
        if (hay.includes(email)) return true;
    }

    const words = normalizeText(user.name ?? '').split(' ').filter(w => w.length >= 2);
    if (words.length) {
        const hayWords = new Set(
            normalizeText([g.name, g.contact, g.contact2].filter(Boolean).join(' ')).split(' ')
        );
        const hits = words.filter(w => hayWords.has(w)).length;
        if (hits >= Math.min(2, words.length)) return true;
    }

    return false;
}

/** האם ה-user_id של הפריט שייך למשתמש הנוכחי. sheet:/ריק → תמיד false. */
export function isGemachOwner(
    user: OwnerSessionLike | null | undefined,
    ownerId: string | null | undefined,
): boolean {
    if (!user) return false;
    const oid = (ownerId ?? '').trim();
    if (!oid || oid.startsWith(SHEET_PREFIX)) return false;
    const keys = ownerCandidateKeys(user);
    return keys.has(oid) || keys.has(oid.toLowerCase());
}
