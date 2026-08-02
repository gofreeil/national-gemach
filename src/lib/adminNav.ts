// ============================================================
// adminNav.ts — מקור אמת יחיד למסכי פאנל הניהול ולהרשאות שלהם.
// שני צרכנים: סרגל הניווט של /admin, ופאנל הניהול הפרוס בתוך
// האזור האישי (/profile#admin) — כדי שרשימת המסכים והגבלות
// התפקיד (סופר-אדמין / בעלים) לא יתפצלו לשני מקומות.
// ============================================================

// מוגדר כאן ולא מיובא מ-$lib/server/adminStore — הקובץ הזה נטען גם בדפדפן,
// ומודולי server אסורים בייבוא מקוד לקוח. הערכים זהים לטיפוס שם.
export type AdminNavRole = 'super_admin' | 'admin';

export interface AdminNavItem {
    href: string;
    icon: string;
    /** תווית קצרה — לסרגל הניווט האופקי */
    label: string;
    /** כותרת מלאה — לאריח בפאנל הפרוס */
    title: string;
    /** משפט הסבר — לאריח בפאנל הפרוס */
    desc: string;
    /** האם הקישור פעיל רק בהתאמה מדויקת (ולא גם למסלולי-בן) */
    exact: boolean;
    /** מסך הסקירה עצמו — מוצג בניווט, אך לא כאריח (יש כפתור "לפאנל המלא") */
    overview?: boolean;
}

/** המסכים שהמשתמש רשאי לראות, לפי תפקיד. owner = הבעלים עצמו, לא כל סופר-אדמין. */
export function adminNav(role: AdminNavRole | null, owner = false): AdminNavItem[] {
    if (!role) return [];
    const isSuper = role === 'super_admin';

    return [
        {
            href: '/admin', icon: '📊', label: 'סקירה', exact: true, overview: true,
            title: 'סקירה ונתונים',
            desc: 'כניסות לאתר, מוני גמ"חים ומצב הפרסומות'
        },
        {
            href: '/admin/gemachim', icon: '🤝', label: 'גמ"חים', exact: false,
            title: 'ניהול גמ"חים',
            desc: 'עריכה, סידור, הצמדה ומחיקה'
        },
        {
            href: '/admin/gemachim/new', icon: '➕', label: 'הוספת גמ"ח', exact: true,
            title: 'הוספת גמ"ח חדש',
            desc: 'שם, קטגוריה, עיר, טלפון, תגים ועוד'
        },
        {
            href: '/admin/gemachim/complete', icon: '🗺️', label: 'השלמת מפה', exact: true,
            title: 'השלמת פרטים למפה',
            desc: 'כתובת/עיר + גזירת קואורדינטות אוטומטית'
        },
        {
            href: '/admin/pinned', icon: '📌', label: 'נעוצים', exact: false,
            title: 'גמ"חים נעוצים',
            desc: 'הרשימה שבראש דף הבית — נעיצה, הסרה וסידור'
        },
        {
            href: '/admin/discovery', icon: '🛰️', label: 'גילוי חכם', exact: false,
            title: 'גילוי חכם',
            desc: 'איתור גמ"חים חדשים מ-Google ואישור טיוטות'
        },
        {
            href: '/admin/ads', icon: '📢', label: 'ניהול פרסומות', exact: false,
            title: 'ניהול פרסומות',
            desc: 'אישור מודעות, לוח תפוסה ונתוני מפרסמים'
        },
        {
            href: '/admin/claims', icon: '🤝', label: 'תביעות בעלות', exact: false,
            title: 'תביעות בעלות',
            desc: 'אישור בעלים שמבקשים לנהל גמ"ח שהעליתם'
        },
        {
            href: '/admin/stats', icon: '📈', label: 'סטטיסטיקה', exact: false,
            title: 'סטטיסטיקת גולשים',
            desc: 'כמה גולשים נכנסו לאתר בכל חודש'
        },
        ...(isSuper ? [
            {
                href: '/admin/admins', icon: '🔑', label: 'ניהול אדמינים', exact: false,
                title: 'ניהול אדמינים',
                desc: 'הוספת אדמינים לפי מייל / משתמש / טלפון'
            },
        ] : []),
        ...(owner ? [
            {
                href: '/admin/categories', icon: '🏷️', label: 'קטגוריות', exact: false,
                title: 'קטגוריות',
                desc: 'הוספה, עריכה וסידור קטגוריות'
            },
        ] : []),
    ];
}

/** האריחים לפאנל הפרוס — כל המסכים חוץ ממסך הסקירה עצמו */
export function adminTiles(role: AdminNavRole | null, owner = false): AdminNavItem[] {
    return adminNav(role, owner).filter((item) => !item.overview);
}
