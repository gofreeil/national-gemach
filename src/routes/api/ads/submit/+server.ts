import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitAd, normalizeLanding } from '$lib/server/adsStore';
import { isOwnerCode, notifyOwnerCodeUse } from '$lib/server/adsCode';
import { normalizePlanDays } from '$lib/adPlans';

// קליטת פרסומת חדשה מהבילדר — נשמרת ב-Strapi במצב "ממתינה לאישור".
// אין דרישת התחברות (כמו במקור) — הסינון האמיתי הוא האישור הידני ב-/admin/ads.
export const POST: RequestHandler = async ({ request, locals }) => {
    let payload: any;
    try {
        payload = await request.json();
    } catch {
        throw error(400, 'גוף הבקשה חייב להיות JSON תקין');
    }

    for (const k of ['title', 'subtitle', 'mainImage', 'gradient']) {
        if (!payload?.[k] || typeof payload[k] !== 'string') {
            throw error(400, `חסר שדה: ${k}`);
        }
    }
    if (!payload.landing || typeof payload.landing !== 'object') {
        throw error(400, 'חסר אובייקט landing');
    }

    const session = await locals.auth();
    // הקוד מאומת כאן, בשרת — לא סומכים על דגל payment מהדפדפן
    const usedOwnerCode = isOwnerCode(payload.ownerCode);
    const requestedDurationDays = normalizePlanDays(payload.requestedDurationDays);
    try {
        const ad = await submitAd({
            submittedBy: session?.user
                ? {
                    id: String(session.user.id ?? ''),
                    email: session.user.email ?? '',
                    name: session.user.name ?? '',
                }
                : undefined,
            title: payload.title,
            subtitle: payload.subtitle,
            payment: usedOwnerCode ? 'code' : 'pending',
            requestedDurationDays,
            hoverText: payload.hoverText ?? '',
            cta: payload.cta ?? '',
            gradient: payload.gradient,
            logo: payload.logo ?? '',
            mainImage: payload.mainImage,
            mainImageFit: payload.mainImageFit,
            landing: normalizeLanding(payload.landing),
        });
        // התראה לבעלים על שימוש בקוד — לא חוסמת ולא מפילה את ההגשה
        if (usedOwnerCode) {
            await notifyOwnerCodeUse({
                adTitle: payload.title,
                durationDays: requestedDurationDays,
                submitter: session?.user ? { name: session.user.name, email: session.user.email } : null,
            });
        }
        return json({ ok: true, id: ad.id, status: ad.status });
    } catch (err) {
        console.error('ads/submit failed:', err);
        // תקרת koa-body של Strapi (~1MB) — שגיאה שהמפרסם יכול לתקן בעצמו
        if (err instanceof Error && err.message.includes('→ 413')) {
            throw error(413, 'התמונות כבדות מדי — הקטינו תמונה ונסו שוב');
        }
        throw error(502, 'השליחה נכשלה — נסו שוב בעוד רגע');
    }
};
