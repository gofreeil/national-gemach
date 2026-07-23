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
