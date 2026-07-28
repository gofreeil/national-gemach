import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listForOwner } from '$lib/server/adsStore';
import { getAdStats, type AdStats } from '$lib/server/adStats';
import { ownerCandidateKeys } from '$lib/server/ownership';

// "הנכסים שלי" — כל הפרסומות שהמשתמש המחובר שלח, עם המדדים שלהן.
// הכניסה מחייבת התחברות: הזיהוי נעשה מול submitted_by של המודעה.
export const load: PageServerLoad = async ({ locals, url }) => {
    const session = await locals.auth();
    if (!session?.user) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    let ads: Awaited<ReturnType<typeof listForOwner>> = [];
    let loadFailed = false;
    try {
        ads = await listForOwner(ownerCandidateKeys(session.user));
    } catch (e) {
        console.error('[advertise/manage] listForOwner failed:', e);
        loadFailed = true;
    }

    // בדף הרשימה אין צורך בפירוט היומי — רק בסך הכל לכל מודעה
    const stats = await getAdStats(ads.map((a) => a.id), 0)
        .catch((): Record<string, AdStats> => ({}));

    return {
        loadFailed,
        user: { name: session.user.name ?? '', email: session.user.email ?? '' },
        ads: ads.map((a) => ({
            id: a.id,
            title: a.title,
            subtitle: a.subtitle,
            status: a.status,
            gradient: a.gradient,
            mainImage: a.mainImage,
            submittedAt: a.submittedAt,
            editedAt: a.editedAt,
            expiresAt: a.expiresAt,
            durationDays: a.durationDays,
            requestedDurationDays: a.requestedDurationDays,
            rejectionReason: a.rejectionReason,
            totals: stats[a.id]?.totals ?? { impressions: 0, clicks: 0, landing: 0, leads: 0 },
        })),
    };
};
