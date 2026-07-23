// ============================================================
// adGate.ts — פרסומת-ביניים (interstitial) לפני פעולה
// ------------------------------------------------------------
// שני טריגרים בלבד:
//   1. לחיצה על גמ"ח (מעבר לעמוד הגמ"ח)     → gatedNav()
//   2. לחיצה על "גלה טלפון" בעמוד הגמ"ח       → runInterstitial()
// שניהם מציגים פרסומת ל-5 שניות עם מחוון "התוכן נטען…" וספירה-
// לאחור, ורק בסיומה ממשיכים לפעולה (ניווט / חשיפת הטלפון).
//
// ▶ מתג ראשי: ADS_ENABLED — כבוי (false) עד שנעלה קריאייטיבים.
//   כל עוד הוא false, כל הלוגיקה מדולגת וההתנהגות זהה לקודם
//   (קליק על גמ"ח = ניווט רגיל; הטלפון מוצג ישירות).
//   כשמעלים פרסומות: הפוך ל-true (ובמידת הצורך החלף את
//   interstitialAds בקריאייטיבים ייעודיים).
// ============================================================

import { writable } from 'svelte/store';
import { browser } from '$app/environment';
import { goto } from '$app/navigation';
import { ads as networkAds, type Ad } from './adsData';

/** מתג ראשי — הפוך ל-true אחרי שהעלינו פרסומות. */
export const ADS_ENABLED = false;

/** משך הפרסומת בשניות (הספירה-לאחור). */
export const INTERSTITIAL_SECONDS = 5;

/** מאגר הקריאייטיבים לפרסומת-הביניים. כרגע ממחזר את פרסומות רשת
 *  gofreeil הקיימות; אפשר להחליף/להוסיף כאן קריאייטיבים ייעודיים. */
export const interstitialAds: Ad[] = networkAds;

/** האם הפיצ'ר פעיל בפועל: המתג דלוק ויש לפחות פרסומת אחת להציג. */
export function adsReady(): boolean {
    return ADS_ENABLED && interstitialAds.length > 0;
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

    // ריצה קודמת שעדיין פעילה — לסגור ולשחרר את הממתין לה, כדי לא להשאיר Promise תלוי
    if (resolveCurrent) {
        const prev = resolveCurrent;
        resolveCurrent = null;
        clearTimer();
        prev();
    }

    const ad = interstitialAds[pickIndex++ % interstitialAds.length];
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
