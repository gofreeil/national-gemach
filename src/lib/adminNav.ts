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
    /** מוצג רק בסרגל הניווט של מסכי /admin — לא כאריח בפאנל שבאזור האישי */
    navOnly?: boolean;
}

/** המסכים שהמשתמש רשאי לראות, לפי תפקיד. owner = הבעלים עצמו, לא כל סופר-אדמין. */
export function adminNav(role: AdminNavRole | null, owner = false): AdminNavItem[] {
    if (!role) return [];
    const isSuper = role === 'super_admin';

    return [
        {
            href: '/admin/gemachim', icon: '🤝', label: 'גמ"חים', exact: false,
            title: 'ניהול גמ"חים',
            desc: 'עריכה, סידור, הצמדה ומחיקה'
        },
        // הוספת גמ"ח אינה מסך ניהול בפני עצמו — הכפתור "➕ הוספת גמ"ח"
        // יושב בראש מסך "ניהול גמ"חים", ומשם מגיעים ל-/admin/gemachim/new.
        {
            href: '/admin/gemachim/complete', icon: '🗺️', label: 'לא מלאים', exact: true,
            title: 'גמ"חים לא מלאים',
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
            // באזור האישי הנתונים כבר פרוסים בכרטיס ה-GA הפתוח — אריח מיותר
            href: '/admin/stats', icon: '📈', label: 'סטטיסטיקה', exact: false, navOnly: true,
            title: 'סטטיסטיקת כניסות',
            desc: 'כמה כניסות היו לאתר בכל חודש'
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

/** האריחים לפאנל הפרוס באזור האישי — בלי מה שמסומן לניווט בלבד */
export function adminTiles(role: AdminNavRole | null, owner = false): AdminNavItem[] {
    return adminNav(role, owner).filter((item) => !item.navOnly);
}
