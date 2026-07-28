// ============================================================
// adTrack.ts — מדידת הפרסומות בצד הלקוח
// ------------------------------------------------------------
// המדדים מגיעים לדשבורד המפרסם (/advertise/manage/[id]).
//   • חשיפה (impressions) — נצברת ונשלחת במקובץ: מודעה נספרת פעם אחת
//     לכל ביקור, והשליחה היא אחת ל-20 שניות או ביציאה מהעמוד. כך סבב
//     המודעות בטור הימני לא מייצר בקשה כל 14 שניות.
//   • קליק / דף נחיתה / פנייה — נשלחים מיד (sendBeacon, שורד ניווט).
// כל הכתיבות שקטות: כשל מדידה לא נוגע בחוויית המשתמש.
// ============================================================

import { browser } from '$app/environment';

export type AdMetric = 'impressions' | 'clicks' | 'landing' | 'leads';

interface AdEvent {
    id: string;
    metric: AdMetric;
}

const ENDPOINT = '/api/ads/track';
const BATCH_MS = 20_000;

/** מודעות שנספרו כבר בביקור הזה — לא סופרים חשיפה כפולה לאותה מודעה */
const seenThisVisit = new Set<string>();
/** חשיפות שעוד לא נשלחו */
const queued = new Set<string>();
let timer: ReturnType<typeof setTimeout> | undefined;
let exitHooked = false;

function send(events: AdEvent[]): void {
    if (!browser || events.length === 0) return;
    const payload = JSON.stringify({ events });
    try {
        if (navigator.sendBeacon) {
            const blob = new Blob([payload], { type: 'application/json' });
            if (navigator.sendBeacon(ENDPOINT, blob)) return;
        }
    } catch {
        /* נופלים ל-fetch */
    }
    void fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: payload,
        keepalive: true,
    }).catch(() => {
        /* כשל שקט */
    });
}

function flushImpressions(): void {
    if (timer) {
        clearTimeout(timer);
        timer = undefined;
    }
    if (queued.size === 0) return;
    const events: AdEvent[] = [...queued].map((id) => ({ id, metric: 'impressions' }));
    queued.clear();
    send(events);
}

function hookExit(): void {
    if (!browser || exitHooked) return;
    exitHooked = true;
    // pagehide תופס סגירה/ניווט מחוץ לאתר; visibilitychange תופס מעבר-לשוניות
    // ומינימיזציה בנייד, שם pagehide לא בהכרח נורה.
    window.addEventListener('pagehide', flushImpressions);
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'hidden') flushImpressions();
    });
}

/** המודעה נראתה על המסך. חוזרת בשקט אם היא כבר נספרה בביקור הזה. */
export function markAdSeen(id: string | undefined | null): void {
    if (!browser) return;
    const adId = (id ?? '').trim();
    if (!adId || seenThisVisit.has(adId)) return;
    seenThisVisit.add(adId);
    queued.add(adId);
    hookExit();
    if (!timer) timer = setTimeout(flushImpressions, BATCH_MS);
}

/** אירוע נקודתי — נשלח מיד, וגורר איתו את החשיפות שממתינות. */
export function trackAdEvent(id: string | undefined | null, metric: AdMetric): void {
    if (!browser) return;
    const adId = (id ?? '').trim();
    if (!adId) return;
    flushImpressions();
    send([{ id: adId, metric }]);
}

/** קליק על המודעה (טור ימני / פרסומת-ביניים) */
export function trackAdClick(id: string | undefined | null): void {
    trackAdEvent(id, 'clicks');
}

/** צפייה בדף הנחיתה /ads/[id] */
export function trackAdLanding(id: string | undefined | null): void {
    trackAdEvent(id, 'landing');
}

/** פנייה: טלפון / וואטסאפ / אתר / מייל בדף הנחיתה */
export function trackAdLead(id: string | undefined | null): void {
    trackAdEvent(id, 'leads');
}
