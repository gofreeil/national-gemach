// ============================================================
// adGate.ts — פרסומת-ביניים (interstitial) לפני פעולה
// ------------------------------------------------------------
// שני טריגרים בלבד:
//   1. לחיצה על גמ"ח (מעבר לעמוד הגמ"ח)     → gatedNav()
//   2. לחיצה על "גלה טלפון" בעמוד הגמ"ח       → runInterstitial()
// שניהם מציגים פרסומת ל-5 שניות עם מחוון "התוכן נטען…" וספירה-
// לאחור, ורק בסיומה ממשיכים לפעולה (ניווט / חשיפת הטלפון).
//
// הקריאייטיבים הם המודעות בתשלום של הטור הימני (לפי סדר המשבצות),
// ואחריהן קריאייטיב אחד שמזמין לפרסם אצלנו — ואז הסבב חוזר להתחלה.
// הפרסומת מוצגת רק במסכים שבהם הטור הימני אינו נראה (מתחת ל-xl/1280px)
// — בדסקטופ רחב המודעות ממילא על המסך כל הזמן.
// ============================================================

import { writable, get } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import type { Ad } from './adsData';
import { rightAds } from './rightAdsData';
import { approvedAds, loadApprovedAds } from './adSlots';

/** מתג ראשי — כיבוי חירום של כל מנגנון פרסומת-הביניים. */
export const ADS_ENABLED = true;

/** משך הפרסומת בשניות (הספירה-לאחור). */
export const INTERSTITIAL_SECONDS = 5;

/** ההזמנה לפרסם — קריאייטיב אחד ויחיד שסוגר את הסבב.
 *  קודם 12 המשבצות הפנויות של הטור הימני נכנסו לכאן כ-12 קריאייטיבים
 *  נפרדים, וכך גולש בנייד ראה "מקום פרסום זה" בעשר לחיצות רצופות לפני
 *  שחזר למודעה בתשלום. בטור הימני 12 המשבצות הן מלאי למכירה; בנייד
 *  מוצגת פרסומת אחת בכל פעם, ולכן די בהזמנה אחת אחרי המודעות המלאות.
 *  image ריק ⇒ AdInterstitial מציג 📢 במקום תמונה. */
const inviteAd: Ad = {
    id: 1,
    title: rightAds[0].text,
    description: rightAds[0].description,
    cta: 'לפרטים',
    href: rightAds[0].href,
    image: '',
    color: rightAds[0].interstitialColor,
};

/** מאגר הקריאייטיבים כרגע: המודעות בתשלום לפי סדר המשבצות, ואחריהן
 *  ההזמנה לפרסם. הסבב חוזר להתחלה מיד אחריה. */
function currentInterstitialAds(): Ad[] {
    const real: Ad[] = get(approvedAds).map((a, i) => ({
        id: 1000 + i,
        adId: a.id,   // המזהה האמיתי ב-Strapi — למדידת חשיפות/קליקים
        title: a.title,
        description: a.subtitle,
        cta: a.cta || 'לפרטים',
        hover: a.hover || undefined,
        href: `/ads/${a.id}`,
        image: a.mainImage,
        color: '',
        gradientCss: a.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)',
    }));
    return [...real, inviteAd];
}

/** הטור הימני מוסתר מתחת ל-xl (1280px) — שם הפרסומת עוברת למסך-מלא. */
function rightColumnHidden(): boolean {
    return browser && window.matchMedia('(max-width: 1279.98px)').matches;
}

/** האם הפיצ'ר פעיל בפועל: המתג דלוק והטור הימני לא נראה. */
export function adsReady(): boolean {
    return ADS_ENABLED && rightColumnHidden();
}

export interface InterstitialState {
    open: boolean;
    ad: Ad | null;
    total: number;      // סך השניות
    remaining: number;  // שניות שנותרו (מעוגל כלפי מעלה) — ל"עוד X שניות"
    progress: number;   // 0..1 — חלק הזמן שחלף, לפס ההתקדמות
}

const IDLE: InterstitialState = {
    open: false, ad: null, total: INTERSTITIAL_SECONDS, remaining: INTERSTITIAL_SECONDS, progress: 0
};

/** מצב הפרסומת הגלובלי — הרכיב AdInterstitial.svelte מאזין לו. */
export const interstitial = writable<InterstitialState>(IDLE);

let rafId = 0;
let resolveCurrent: (() => void) | null = null;
let pickIndex = 0;   // מסובב על מאגר הקריאייטיבים כדי שלא תמיד תוצג אותה פרסומת

function clearTimer() {
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
}

function finish() {
    clearTimer();
    interstitial.set(IDLE);
    const r = resolveCurrent;
    resolveCurrent = null;
    r?.();
}

/** מציג פרסומת ל-INTERSTITIAL_SECONDS שניות ומחזיר Promise שנפתר בסיומה.
 *  אם הפיצ'ר כבוי (או שאנחנו ב-SSR) — נפתר מיד בלי להציג דבר. */
export function runInterstitial(): Promise<void> {
    if (!browser || !adsReady()) return Promise.resolve();
    loadApprovedAds(); // בטוח לקרוא שוב — טעינה חד-פעמית

    // ריצה קודמת שעדיין פעילה — לסגור ולשחרר את הממתין לה, כדי לא להשאיר Promise תלוי
    if (resolveCurrent) {
        const prev = resolveCurrent;
        resolveCurrent = null;
        clearTimer();
        prev();
    }

    const pool = currentInterstitialAds();
    const ad = pool[pickIndex++ % pool.length];
    const total = INTERSTITIAL_SECONDS;
    const start = performance.now();

    return new Promise<void>((resolve) => {
        resolveCurrent = resolve;
        interstitial.set({ open: true, ad, total, remaining: total, progress: 0 });

        const tick = () => {
            const elapsed = (performance.now() - start) / 1000;
            const progress = Math.min(1, elapsed / total);
            const remaining = Math.max(0, Math.ceil(total - elapsed));
            interstitial.update((s) => ({ ...s, progress, remaining }));
            if (progress >= 1) { finish(); return; }
            rafId = requestAnimationFrame(tick);
        };
        rafId = requestAnimationFrame(tick);
    });
}

/** מטפל-קליק ל-<a> של מעבר לעמוד גמ"ח: אם הפיצ'ר פעיל — עוצר את הניווט,
 *  מציג פרסומת, ואז ממשיך ל-href. אם כבוי — לא עושה כלום (קישור רגיל).
 *  לא מיירט לחיצות עם מקש-משנה / כפתור-אמצעי (פתיחה בלשונית חדשה נשמרת). */
export function gatedNav(e: MouseEvent, href: string): void {
    if (!adsReady() || e.defaultPrevented) return;
    if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    runInterstitial().then(() => goto(href));
}
