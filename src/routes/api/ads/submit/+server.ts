import { json, error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { submitAd, normalizeLanding } from '$lib/server/adsStore';
import { isOwnerCode, notifyOwnerCodeUse, notifyOwnerNewAd } from '$lib/server/adsCode';
import { normalizePlanDays } from '$lib/adPlans';

// קליטת פרסומת חדשה מהבילדר — נשמרת ב-Strapi במצב "ממתינה לאישור".
// חובה להיות מחובר: מודעה בלי submitted_by היא מודעה בלי בעלים — המפרסם
// לא יכול לראות את הביצועים שלה, לערוך אותה או לחדש אותה לעולם.
export const POST: RequestHandler = async ({ request, locals }) => {
    const session = await locals.auth();
    if (!session?.user) {
        throw error(401, 'צריך להתחבר לפני השליחה — כך הפרסומת נשמרת על החשבון שלכם ותוכלו לעקוב אחריה ולערוך אותה');
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

    // הקוד מאומת כאן, בשרת — לא סומכים על דגל payment מהדפדפן
    const usedOwnerCode = isOwnerCode(payload.ownerCode);
    const requestedDurationDays = normalizePlanDays(payload.requestedDurationDays);
    try {
        const ad = await submitAd({
            submittedBy: {
                id: String(session.user.id ?? ''),
                email: session.user.email ?? '',
                name: session.user.name ?? '',
            },
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
            // העיצוב מהבילדר (לוגו, רצועה, כותרת) — בלעדיו המודעה מתפרסמת
            // עם ברירות המחדל של האתר ולא עם מה שהמפרסם ראה על המסך
            adStyle: payload.adStyle,
            landing: normalizeLanding(payload.landing),
            // 'new' = המפרסם הגיע מדף המחירים וקנה משבצת נוספת. השליחה לא
            // מתקשרת למודעה הקיימת והאישור לא יוריד אותה.
            standalone: payload.intent === 'new',
        });
        // התראה על *כל* בקשת פרסום — קודם היא נשלחה רק על שימוש בקוד בעלים,
        // כך שמפרסם רגיל הגיש פרסומת ואיש לא ידע עליה. לא חוסמת ולא מפילה.
        // מפרסם ששב לשפר מודעה קיימת מקבל ניסוח משלו: "עדכון" ולא "חדשה".
        await notifyOwnerNewAd({
            adTitle: payload.title,
            durationDays: requestedDurationDays,
            usedOwnerCode,
            submitter: { name: session.user.name, email: session.user.email },
            replacesTitle: ad.replacesTitle,
            replacesLive: ad.replacesStatus === 'approved',
        });
        // התראה נפרדת על שימוש בקוד — נשמרת כדי לא לאבד את ההתראה הייעודית
        if (usedOwnerCode) {
            await notifyOwnerCodeUse({
                adTitle: payload.title,
                durationDays: requestedDurationDays,
                submitter: { name: session.user.name, email: session.user.email },
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
