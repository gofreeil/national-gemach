// ============================================================
// adSlots.ts — מיזוג המודעות המאושרות (מהבילדר, דרך Strapi) עם
// משבצות "מקום פרסום זה" הפנויות, לשתי במות התצוגה:
//   • הטור הימני בדסקטופ (RightAdBanner)
//   • פרסומת-הביניים בנייד (adGate / AdInterstitial)
// הרשימה נטענת בצד-הלקוח מ-/api/ads/approved (ולא דרך ה-layout),
// כך שהמודעות הן שכבה עצמאית שכשל בה לא נוגע בשאר האתר.
// ============================================================

import { writable, derived } from 'svelte/store';
import { browser } from '$app/environment';
import { rightAds, AD_SLOT_COUNT, type RightAd } from './rightAdsData';
import type { AdStyle } from './adStyle';

/** הצורה הרזה שמחזיר /api/ads/approved (ApprovedAdPublic בשרת) */
export interface ApprovedAd {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    hover: string;
    gradient: string;   // מחרוזת CSS מלאה (linear-gradient(...))
    /** לוגו המפרסם (data URI); ריק כשלא הועלה לוגו בבילדר */
    logo?: string;
    mainImage: string;  // data URI
    /** מיקום+זום מהבילדר; אופציונלי — קאש ישן בדפדפן עוד בלעדיו */
    mainImageFit?: { x: number; y: number; z: number };
    /** העיצוב מהבילדר (לוגו, רצועה, כותרת); חסר במודעות ותיקות */
    adStyle?: AdStyle | null;
    /** מספר המקום בלוח (1..12) — נקבע במסך הניהול; חסר בקאש ישן */
    slot?: number;
}

export type AdSlot =
    | { kind: 'real'; ad: ApprovedAd }
    | { kind: 'vacant'; slot: RightAd; no: number }   // no = מספר המשבצת לתצוגה
    | { kind: 'pending' };                            // שלד — הטעינה הראשונה עוד רצה

export const approvedAds = writable<ApprovedAd[]>([]);

/** האם כבר יש בידינו רשימה אמינה (מהקאש המקומי או מהשרת).
 *  לפני-כן מוצג שלד ניטרלי ולא "מקום פרסום זה" — כדי שהטור לא ייראה
 *  ריק/פנוי לרגע ואז יתמלא בקפיצה. */
export const adsHydrated = writable(false);

// קאש מקומי בדפדפן: הרשימה האחרונה שהתקבלה נשמרת, ומבקר חוזר רואה את
// המודעות מיידית — עוד לפני שתשובת הרשת חוזרת (רלוונטי במיוחד כשהשרת קר).
// התמונות הן data-URI ולכן הרשומה גדולה; חריגת מכסה נבלעת בשקט.
// v2: נוספו הלוגו והעיצוב שהמפרסם קבע. מפתח חדש מוודא שמבקר חוזר לא
// יראה שוב את הגרסה שנשמרה בלעדיהם ותיראה לו כמו מודעה בלי לוגו.
// v3: נוסף מספר המקום (slot) — בלי המפתח החדש מבקר חוזר היה מצייר את
// הלוח מרשימה ישנה בלי מספרים, והמודעות היו נדחסות לראש הלוח.
const CACHE_KEY = 'ng_approved_ads_v3';

function readLocalCache(): ApprovedAd[] | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        const parsed = raw ? JSON.parse(raw) : null;
        return Array.isArray(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function writeLocalCache(ads: ApprovedAd[]): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(ads));
    } catch {
        /* מכסה מלאה / מצב פרטי — פשוט בלי קאש */
    }
}

let loadStarted = false;

/** טעינה חד-פעמית של המודעות המאושרות. בטוח לקרוא מכמה מקומות. */
export function loadApprovedAds(): void {
    if (!browser || loadStarted) return;
    loadStarted = true;
    const cached = readLocalCache();
    if (cached) {
        approvedAds.set(cached);
        adsHydrated.set(true);
    }
    fetch('/api/ads/approved')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            if (Array.isArray(data?.ads)) {
                approvedAds.set(data.ads);
                writeLocalCache(data.ads);
            }
        })
        .catch(() => {
            /* כשל שקט — המשבצות נשארות פנויות */
        })
        .finally(() => adsHydrated.set(true));
}

// הטעינה מתחילה ברגע שהמודול נטען בדפדפן (ה-layout מייבא אותו דרך
// RightAdBanner) — בלי להמתין ל-onMount של רכיב כלשהו. יחד עם ה-preload
// שב-app.html הבקשה כבר באוויר עוד לפני שה-JS הזה בכלל רץ.
if (browser) loadApprovedAds();

/** לוח 12 המקומות בסדר מספרי: מקום שנתפס מציג את המודעה, מקום פנוי
 *  מציג את משבצת "יכול להיות שלך" של אותו מספר — מודעה מאושרת *תופסת*
 *  מקום, וסך הכרטיסים הוא תמיד 12 בדיוק. המספר מגיע מהשרת (נקבע במסך
 *  הניהול); מודעה מקאש ישן בלי מספר ממלאת את המספר הפנוי הנמוך ביותר.
 *  כל עוד אין רשימה (טעינה ראשונה, בלי קאש) — שלדים ניטרליים. */
export const adSlots = derived(
    [approvedAds, adsHydrated],
    ([$approved, $hydrated]): AdSlot[] => {
        if (!$hydrated) return rightAds.map((): AdSlot => ({ kind: 'pending' }));
        const taken = new Set<number>();
        for (const a of $approved) {
            if (typeof a.slot === 'number' && a.slot >= 1) taken.add(a.slot);
        }
        let nextFree = 1;
        const byNum = new Map<number, ApprovedAd>();
        const overflow: AdSlot[] = [];
        for (const a of $approved) {
            let num = typeof a.slot === 'number' && a.slot >= 1 ? a.slot : 0;
            // בלי מספר, או בהתנגשות נדירה — המספר הפנוי הנמוך ביותר
            if (num === 0 || byNum.has(num)) {
                while (taken.has(nextFree)) nextFree++;
                num = nextFree;
                taken.add(num);
            }
            if (num <= AD_SLOT_COUNT) byNum.set(num, a);
            else overflow.push({ kind: 'real', ad: a });
        }
        const cells: AdSlot[] = [];
        for (let n = 1; n <= AD_SLOT_COUNT; n++) {
            const ad = byNum.get(n);
            // תבניות הצבע קבועות למספר: משבצת 7 שומרת על הצבעים שלה
            // גם כשמקומות לפניה נתפסים
            cells.push(
                ad
                    ? { kind: 'real', ad }
                    : { kind: 'vacant', slot: rightAds[(n - 1) % rightAds.length], no: n },
            );
        }
        // מעבר ל-12 (גלישה) — בסוף הלוח, כדי שמודעה לא תיעלם
        return [...cells, ...overflow];
    },
);
