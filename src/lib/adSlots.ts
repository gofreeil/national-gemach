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
    | { kind: 'vacant'; slot: RightAd };

export const approvedAds = writable<ApprovedAd[]>([]);

let loadStarted = false;

/** טעינה חד-פעמית של המודעות המאושרות. בטוח לקרוא מכמה מקומות. */
export function loadApprovedAds(): void {
    if (!browser || loadStarted) return;
    loadStarted = true;
    fetch('/api/ads/approved')
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
            if (Array.isArray(data?.ads)) approvedAds.set(data.ads);
        })
        .catch(() => {
            /* כשל שקט — המשבצות נשארות פנויות */
        });
}

/** משבצות התצוגה: מודעות אמיתיות קודם, והיתרה — משבצות פנויות. */
export const adSlots = derived(approvedAds, ($approved): AdSlot[] => {
    const real: AdSlot[] = $approved
        .slice(0, rightAds.length)
        .map((ad) => ({ kind: 'real', ad }));
    const vacant: AdSlot[] = rightAds
        .slice(real.length)
        .map((slot) => ({ kind: 'vacant', slot }));
    return [...real, ...vacant];
});
