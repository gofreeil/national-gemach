// ============================================================
// adsData.ts — נתוני פרסומות משותפים לנייד ודסקטופ
// עדכן כאן בלבד — יתעדכן אוטומטית בכל המקומות
// ============================================================

export interface Ad {
    title: string;
    summary: string;
    url: string;
    color: string;         // Tailwind gradient classes
    image?: string;        // נתיב תמונה (דסקטופ)
    bgStyle?: string;      // background-image style override
    hoverTitle?: string;   // כותרת ב-hover (דסקטופ)
    hoverText?: string;    // טקסט ב-hover (דסקטופ)
    footerText?: string;   // טקסט בפס התחתון (דסקטופ)
    extraClass?: string;   // class נוסף לכרטיס
    comingSoon?: boolean;  // תג "בקרוב"
    imageStyle?: string;   // style לאלמנט התמונה (לדוגמה height)
    imageContain?: boolean;// object-contain במקום object-cover
}

export const ads: Ad[] = [
    {
        title: 'בתי הפיוס',
        summary: 'יש לך סיכסוך? לחץ לפתרון',
        url: 'https://www.melecshop.com/page/peace-on-earth',
        color: 'from-orange-600 to-red-600',
        image: '/images/בתי הפיוס.png',
        hoverTitle: 'בתי הפיוס',
        hoverText: 'מתנדבים לתת לך עזרה מלאה בדין / פיוס בכל סיכסוך',
        footerText: 'יש לך סיכסוך? לחץ לפתרון',
    },
    {
        title: 'ועדי שכונות',
        summary: 'הצטרף לוועד השכונה שלך',
        url: 'https://www.melecshop.com/page/peace-on-earth_VRHH',
        color: 'from-blue-600 to-cyan-600',
        image: '/images/news/ועדי שכונות.png',
        hoverTitle: 'ועדי שכונות',
        hoverText: 'מהפכת משילות העם על המוסדות',
        footerText: 'הכר והצטרף למהפכת המשילות של העם על מוסדותיו!',
    },
    {
        title: 'קבוצת רכישה',
        summary: 'הוזל את ההוצאות החודשיות',
        url: 'https://purchasing-groups.vercel.app/',
        color: 'from-[#3d5a3d] to-[#2d4a2d]',
        image: '/images/whatsapp_cta.png',
        hoverTitle: 'קבוצת רכישה',
        hoverText: 'הוזל את ההוצאות שלך',
        footerText: 'הוזל מיד את ההוצאות החודשיות שלך – כוחנו באחדותנו',
        imageStyle: 'height: 8rem',
    },
    {
        title: 'השקעות קבוצתיות',
        summary: 'הצטרף אל מועדון המשקיעים',
        url: 'https://www.melecshop.com/page/free',
        color: 'from-amber-600 to-orange-600',
        image: '/images/partners/השקעות קבוצתיות.png',
        hoverTitle: 'השקעות קבוצתיות',
        hoverText: 'התחבר עם קבוצת המשקיעים',
        footerText: 'הצטרף אל מועדון המשקיעים של מהפכת הכלכלה המבוזרת!',
    },
    {
        title: 'גידול ביתי',
        summary: 'מערכת לגידול ביתי (בקרוב)',
        url: 'https://www.melecshop.com/page/free',
        color: 'from-teal-500 to-teal-600',
        image: '/images/partners/מערכת לגידול ביתי.png',
        hoverTitle: 'גידול ביתי',
        hoverText: 'מערכת לגידול ביתי',
        footerText: 'מערכת לגידול ביתי',
        comingSoon: true,
    },
    {
        title: 'בעלי מקצוע כשירים',
        summary: 'מחפש בעל מקצוע איכותי?',
        url: 'https://index-chi-sage.vercel.app/',
        color: 'from-yellow-500 to-orange-500',
        image: '/images/בעלי מקצוע כשירים.png',
        hoverTitle: 'בעלי מקצוע כשירים',
        hoverText: 'חתמו על תנאי הקהילה ונותנים לנו הנחות והטבות יחודיות',
        footerText: 'מחפש בעל מקצוע איכותי באזורך?',
    },
    {
        title: 'ביקורת על העיריה',
        summary: 'יש לך תלונה לעיריה?',
        url: 'https://right-to-live.vercel.app/',
        color: 'from-red-600 to-pink-600',
        image: '/images/ביקורת על העיריה.png',
        hoverTitle: 'יותר אתה לא לבד!',
        hoverText: 'מנצחים את הבירוקרטיה!',
        footerText: 'יש לך תלונה לעיריה שמזלזלים בה? - לא עוד',
    },
    {
        title: 'סיוע לנפגעים מינית',
        summary: 'נפגעת? אנו נסייע!',
        url: 'https://www.melecshop.com/page/kids_FNL3',
        color: 'from-purple-600 to-violet-600',
        image: '/images/סיוע לנפגעים.png?v=4',
        hoverTitle: 'נפגעת? אנו נסייע!',
        hoverText: '',
        footerText: 'סיוע לנפגעים מינית',
        imageStyle: 'height: 180px',
        imageContain: true,
        bgStyle: 'background: linear-gradient(to bottom right, #1e3a5f, #164e63)',
    },
];
