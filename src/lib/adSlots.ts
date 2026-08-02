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
import { rightAds, type RightAd } from './rightAdsData';

/** הצורה הרזה שמחזיר /api/ads/approved (ApprovedAdPublic בשרת) */
export interface ApprovedAd {
    id: string;
    title: string;
    subtitle: string;
    cta: string;
    hover: string;
    gradient: string;   // מחרוזת CSS מלאה (linear-gradient(...))
    mainImage: string;  // data URI
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
const CACHE_KEY = 'ng_approved_ads_v1';

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

/** משבצות התצוגה: מודעות אמיתיות קודם, והיתרה — משבצות פנויות.
 *  כל עוד אין רשימה (טעינה ראשונה, בלי קאש) — שלדים ניטרליים. */
export const adSlots = derived(
    [approvedAds, adsHydrated],
    ([$approved, $hydrated]): AdSlot[] => {
        if (!$hydrated) return rightAds.map((): AdSlot => ({ kind: 'pending' }));
        const real: AdSlot[] = $approved
            .slice(0, rightAds.length)
            .map((ad) => ({ kind: 'real', ad }));
        const vacant: AdSlot[] = rightAds
            .slice(real.length)
            .map((slot, i) => ({ kind: 'vacant', slot, no: real.length + i + 1 }));
        return [...real, ...vacant];
    },
);
