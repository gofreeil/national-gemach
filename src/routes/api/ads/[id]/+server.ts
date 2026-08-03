import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAd, isAdOwner, updateAdContent, normalizeLanding } from '$lib/server/adsStore';
import { ownerCandidateKeys } from '$lib/server/ownership';

// עריכה מחדש של מודעה קיימת בידי המפרסם שהעלה אותה (דשבורד הנכס →
// הבונה → שלב השליחה). תוכן בלבד: הסטטוס, התוקף, המסלול והתשלום
// נשארים כפי שהאדמין קבע, ורק edited_at מתעדכן.
export const PUT: RequestHandler = async ({ params, request, locals }) => {
    const session = await locals.auth();
    if (!session?.user) throw error(401, 'צריך להתחבר כדי לערוך פרסומת');

    const ad = await getAd(params.id);
    if (!ad) throw error(404, 'הפרסומת לא נמצאה');
    if (!isAdOwner(ownerCandidateKeys(session.user), ad)) {
        throw error(403, 'אין לך הרשאה לערוך את הפרסומת הזו');
    }

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

    try {
        await updateAdContent(params.id, {
            title: payload.title,
            subtitle: payload.subtitle,
            hoverText: payload.hoverText ?? '',
            cta: payload.cta ?? '',
            gradient: payload.gradient,
            logo: payload.logo ?? '',
            mainImage: payload.mainImage,
            mainImageFit: payload.mainImageFit,
            landing: normalizeLanding(payload.landing),
        });
    } catch (err) {
        console.error('ads PUT failed:', err);
        // תקרת koa-body של Strapi (~1MB) — שגיאה שהמפרסם יכול לתקן בעצמו
        if (err instanceof Error && err.message.includes('→ 413')) {
            throw error(413, 'התמונות כבדות מדי — הקטינו תמונה ונסו שוב');
        }
        throw error(502, 'העדכון נכשל — נסו שוב בעוד רגע');
    }

    return json({ ok: true, id: params.id, status: ad.status });
};
