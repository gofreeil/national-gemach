// ============================================================
// rightAdsData.ts — מקור-אמת יחיד למשבצות הפרסום בתשלום:
//   • טור הפרסומות הימני בדסקטופ (RightAdBanner)
//   • פרסומת-הביניים במסך-מלא בנייד (AdInterstitial דרך adGate)
// כרגע כל המשבצות פנויות ("מקום פרסום זה — יכול להיות שלך")
// ומפנות לדף /advertise. כשמפרסם אמיתי נכנס — מחליפים כאן את
// המשבצת והיא מתעדכנת אוטומטית בשני המקומות.
// הערה: כל מחלקות ה-Tailwind כתובות כמחרוזות מלאות — חובה,
// אחרת ה-JIT לא מייצר אותן.
// ============================================================

export interface RightAd {
    text: string;           // כותרת המודעה
    description: string;    // שורת המשנה
    href: string;           // לאן מוביל הקליק — /advertise למשבצת פנויה
    // מחלקות עיצוב למשבצת בטור הדסקטופ
    borderColor: string;
    bgColor: string;
    hoverBorder: string;
    hoverBg: string;
    textColor: string;
    hoverText: string;
    buttonColor: string;
    // גרדיאנט הרקע של הקריאייטיב בפרסומת-הביניים בנייד
    interstitialColor: string;
}

const vacant = { text: 'מקום פרסום זה', description: 'יכול להיות שלך', href: '/advertise' };

export const rightAds: RightAd[] = [
    {
        ...vacant,
        borderColor: 'border-orange-500/30',
        bgColor: 'bg-orange-900/10',
        hoverBorder: 'hover:border-orange-500',
        hoverBg: 'hover:bg-orange-900/20',
        textColor: 'text-orange-400',
        hoverText: 'group-hover:text-orange-200',
        buttonColor: 'bg-orange-600 hover:bg-orange-500',
        interstitialColor: 'from-orange-600 to-red-700',
    },
    {
        ...vacant,
        borderColor: 'border-blue-500/30',
        bgColor: 'bg-blue-900/10',
        hoverBorder: 'hover:border-blue-500',
        hoverBg: 'hover:bg-blue-900/20',
        textColor: 'text-blue-400',
        hoverText: 'group-hover:text-blue-200',
        buttonColor: 'bg-blue-600 hover:bg-blue-500',
        interstitialColor: 'from-blue-600 to-indigo-700',
    },
    {
        ...vacant,
        borderColor: 'border-green-500/30',
        bgColor: 'bg-green-900/10',
        hoverBorder: 'hover:border-green-500',
        hoverBg: 'hover:bg-green-900/20',
        textColor: 'text-green-400',
        hoverText: 'group-hover:text-green-200',
        buttonColor: 'bg-green-600 hover:bg-green-500',
        interstitialColor: 'from-green-600 to-emerald-700',
    },
    {
        ...vacant,
        borderColor: 'border-amber-500/30',
        bgColor: 'bg-amber-900/10',
        hoverBorder: 'hover:border-amber-500',
        hoverBg: 'hover:bg-amber-900/20',
        textColor: 'text-amber-400',
        hoverText: 'group-hover:text-amber-200',
        buttonColor: 'bg-amber-600 hover:bg-amber-500',
        interstitialColor: 'from-amber-500 to-orange-700',
    },
    {
        ...vacant,
        borderColor: 'border-purple-500/30',
        bgColor: 'bg-purple-900/10',
        hoverBorder: 'hover:border-purple-500',
        hoverBg: 'hover:bg-purple-900/20',
        textColor: 'text-purple-400',
        hoverText: 'group-hover:text-purple-200',
        buttonColor: 'bg-purple-600 hover:bg-purple-500',
        interstitialColor: 'from-purple-600 to-indigo-700',
    },
    {
        ...vacant,
        borderColor: 'border-red-500/30',
        bgColor: 'bg-red-900/10',
        hoverBorder: 'hover:border-red-500',
        hoverBg: 'hover:bg-red-900/20',
        textColor: 'text-red-400',
        hoverText: 'group-hover:text-red-200',
        buttonColor: 'bg-red-600 hover:bg-red-500',
        interstitialColor: 'from-red-600 to-rose-700',
    },
    {
        ...vacant,
        borderColor: 'border-indigo-500/30',
        bgColor: 'bg-indigo-900/10',
        hoverBorder: 'hover:border-indigo-500',
        hoverBg: 'hover:bg-indigo-900/20',
        textColor: 'text-indigo-400',
        hoverText: 'group-hover:text-indigo-200',
        buttonColor: 'bg-indigo-600 hover:bg-indigo-500',
        interstitialColor: 'from-indigo-600 to-blue-700',
    },
    {
        ...vacant,
        borderColor: 'border-teal-500/30',
        bgColor: 'bg-teal-900/10',
        hoverBorder: 'hover:border-teal-500',
        hoverBg: 'hover:bg-teal-900/20',
        textColor: 'text-teal-400',
        hoverText: 'group-hover:text-teal-200',
        buttonColor: 'bg-teal-600 hover:bg-teal-500',
        interstitialColor: 'from-teal-600 to-cyan-700',
    },
    {
        ...vacant,
        borderColor: 'border-pink-500/30',
        bgColor: 'bg-pink-900/10',
        hoverBorder: 'hover:border-pink-500',
        hoverBg: 'hover:bg-pink-900/20',
        textColor: 'text-pink-400',
        hoverText: 'group-hover:text-pink-200',
        buttonColor: 'bg-pink-600 hover:bg-pink-500',
        interstitialColor: 'from-pink-600 to-rose-700',
    },
    {
        ...vacant,
        borderColor: 'border-yellow-500/30',
        bgColor: 'bg-yellow-900/10',
        hoverBorder: 'hover:border-yellow-500',
        hoverBg: 'hover:bg-yellow-900/20',
        textColor: 'text-yellow-400',
        hoverText: 'group-hover:text-yellow-200',
        buttonColor: 'bg-yellow-600 hover:bg-yellow-500',
        interstitialColor: 'from-yellow-500 to-amber-700',
    },
    {
        ...vacant,
        borderColor: 'border-emerald-500/30',
        bgColor: 'bg-emerald-900/10',
        hoverBorder: 'hover:border-emerald-500',
        hoverBg: 'hover:bg-emerald-900/20',
        textColor: 'text-emerald-400',
        hoverText: 'group-hover:text-emerald-200',
        buttonColor: 'bg-emerald-600 hover:bg-emerald-500',
        interstitialColor: 'from-emerald-600 to-teal-700',
    },
    {
        ...vacant,
        borderColor: 'border-fuchsia-500/30',
        bgColor: 'bg-fuchsia-900/10',
        hoverBorder: 'hover:border-fuchsia-500',
        hoverBg: 'hover:bg-fuchsia-900/20',
        textColor: 'text-fuchsia-400',
        hoverText: 'group-hover:text-fuchsia-200',
        buttonColor: 'bg-fuchsia-600 hover:bg-fuchsia-500',
        interstitialColor: 'from-fuchsia-600 to-purple-700',
    },
];

/** כמה מקומות ממוספרים יש בלוח הפרסומות — נגזר מרשימת המשבצות עצמה.
 *  משותף לשרת (הקצאת המספרים ב-adsStore) וללקוח (הלוח ב-adSlots ובורר
 *  המקום במסך הניהול) — כדי שלא ייווצר פער בין המספרים שהמנהל רואה
 *  למה שהאתר מציג. */
export const AD_SLOT_COUNT = rightAds.length;
