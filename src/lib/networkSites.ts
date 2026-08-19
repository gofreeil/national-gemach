// ============================================================
// networkSites.ts - הרשימה הקנונית של כל אתרי רשת "יוצאים לחירות"
// משמשת את רשת הלוגואים במסך הברכה (WelcomeScreen) — כוללת את
// כל האתרים, כולל האתר הנוכחי עצמו. רשימה זהה קיימת בכל המאגרים
// של הרשת — עדכון כאן מחייב עדכון מקביל בכולם.
// (שונה מ-adsData.ts שמשמש לרוטציית פרסומות ומחליף את המודעה העצמית.)
// ============================================================

export interface NetworkSite {
    id: number;
    title: string;
    href: string;
    image: string;
    color: string;
}

export const networkSites: NetworkSite[] = [
    {
        id: 1,
        title: 'בתי הפיוס',
        href: 'https://chachmim.gofreeil.com/',
        image: '/images/bati-hapius.webp',
        color: 'from-orange-600 to-red-600'
    },
    {
        id: 2,
        title: 'הגמ"ח הארצי',
        href: 'https://gemach.gofreeil.com/',
        image: '/images/gemach-harzi.png',
        color: 'from-pink-600 via-fuchsia-600 to-purple-700'
    },
    {
        id: 3,
        title: 'קהילה בשכונה',
        href: 'https://community.gofreeil.com/',
        image: '/images/community-neighborhood.png',
        color: 'from-blue-500 to-purple-600'
    },
    {
        id: 4,
        title: 'ועדי שכונות',
        href: 'https://neighborhoods.gofreeil.com/',
        image: '/images/news/vaadei-shchunot.webp',
        color: 'from-blue-600 to-cyan-600'
    },
    {
        id: 5,
        title: 'מבקר רשויות המדינה',
        href: 'https://criticism.gofreeil.com/',
        image: '/images/mevaker-rashuyot.webp',
        color: 'from-blue-700 to-indigo-700'
    },
    {
        id: 6,
        title: 'דירוג ציבורי',
        href: 'https://rating.gofreeil.com/',
        image: '/images/public-rating.webp',
        color: 'from-indigo-600 to-blue-600'
    },
    {
        id: 7,
        title: 'משאלי העם',
        href: 'https://referendum.gofreeil.com/',
        image: '/images/referendum.webp',
        color: 'from-purple-600 to-indigo-700'
    },
    {
        id: 8,
        title: 'רכישות קבוצתיות',
        href: 'https://groups.gofreeil.com/',
        image: '/images/whatsapp_cta.webp',
        color: 'from-green-800 to-emerald-900'
    },
    {
        id: 9,
        title: 'בעלי מקצוע כשירים',
        href: 'https://index.gofreeil.com/',
        image: '/images/professionals.webp',
        color: 'from-yellow-500 to-orange-500'
    },
    {
        id: 10,
        title: 'חנות החירות',
        href: 'https://shop.gofreeil.com/',
        image: '/images/shop.webp',
        color: 'from-emerald-600 to-teal-700'
    }
];
