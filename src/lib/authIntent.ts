// "הבקשה הראשונה" של מי שנשלח להירשם/להתחבר באמצע פעולה.
//
// אורח שלוחץ על פעולה שדורשת חשבון נשלח להתחברות עם יעד חזרה. בסיום ההרשמה/התחברות
// הוא נוחת ביעד עם ?welcome=..., ומסך הפתיחה (WelcomeScreen) מציג:
// "השלמת את ההרשמה! כעת תועבר לבקשתך הראשונה — <תיאור>" ונסגר אל הבקשה עצמה.
// תיאור יש רק ליעדים שהם פעולה; דף הבית, דפי עיון והאזור האישי אינם "בקשה".

const ROUTE_LABELS: Array<[RegExp, string]> = [
    [/^\/gemach\/claim$/, 'שיוך הגמ"ח שפרסמת לחשבון שלך'],
    [/^\/gemach\/add$/, 'הוספת גמ"ח חדש'],
    [/^\/gemach\/[^\/]+\/edit$/, 'עריכת הגמ"ח'],
    [/^\/advertise\/manage(\/|$)/, 'ניהול המודעות שלך'],
    [/^\/advertise(\/|$)/, 'בניית מודעה'],
    [/^\/admin(\/|$)/, 'ממשק הניהול'],
];

/** תיאור הבקשה לפי נתיב היעד (כולל query), או null כשהיעד אינו בקשה */
export function describeReturn(pathAndSearch: string): string | null {
    let path: string;
    try { path = new URL(pathAndSearch, 'http://x').pathname.replace(/\/+$/, '') || '/'; } catch { return null; }
    for (const [re, label] of ROUTE_LABELS) if (re.test(path)) return label;
    return null;
}
