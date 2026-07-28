import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { recordAdEvents, AD_METRICS, type AdMetric } from '$lib/server/adStats';
import { listApproved } from '$lib/server/adsStore';

// קליטת אירועי מדידה של הפרסומות (חשיפה/קליק/דף נחיתה/פנייה).
// נקרא מ-$lib/adTrack בצד הלקוח, לרוב דרך navigator.sendBeacon.
// נספרות רק מודעות שמוצגות בפועל — כך מזהה שרירותי לא מנפח מדדים.
const MAX_EVENTS = 25;

export const POST: RequestHandler = async ({ request }) => {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return json({ ok: false }, { status: 400 });
    }

    const raw = (body as { events?: unknown })?.events;
    const incoming = Array.isArray(raw) ? raw.slice(0, MAX_EVENTS) : [];
    if (incoming.length === 0) return json({ ok: true, counted: 0 });

    const live = new Set((await listApproved()).map((a) => a.id));
    const events = incoming
        .filter((e): e is { id: string; metric: AdMetric } =>
            typeof (e as any)?.id === 'string' &&
            live.has((e as any).id) &&
            AD_METRICS.includes((e as any)?.metric),
        )
        .map((e) => ({ id: e.id, metric: e.metric }));

    if (events.length > 0) recordAdEvents(events);
    return json({ ok: true, counted: events.length });
};
