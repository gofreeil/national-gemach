import { redirect } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';
import { listForOwner } from '$lib/server/adsStore';
import { getAdStats, type AdStats } from '$lib/server/adStats';
import { getGemachimByOwner } from '$lib/server/db';
import { getCategories } from '$lib/server/adminStore';
import { ownerCandidateKeys } from '$lib/server/ownership';

// "הנכסים שלי" — כל מה שהמשתמש המחובר מחזיק באתר: הפרסומות ששלח (עם המדדים
// שלהן) והגמ"חים שרשומים על שמו. הכניסה מחייבת התחברות; הזיהוי בשני המקרים
// נעשה מול אותה קבוצת מזהים (ownerCandidateKeys).
export const load: PageServerLoad = async ({ locals, url }) => {
    const session = await locals.auth();
    if (!session?.user) {
        throw redirect(302, `/login?redirect=${encodeURIComponent(url.pathname)}`);
    }

    const keys = ownerCandidateKeys(session.user);

    let ads: Awaited<ReturnType<typeof listForOwner>> = [];
    let loadFailed = false;
    try {
        ads = await listForOwner(keys);
    } catch (e) {
        console.error('[advertise/manage] listForOwner failed:', e);
        loadFailed = true;
    }

    // כשל בשליפת הגמ"חים לא מפיל את הדף — getGemachimByOwner מחזיר [] ומדווח ללוג
    const gemachim = await getGemachimByOwner(keys);

    // בדף הרשימה אין צורך בפירוט היומי — רק בסך הכל לכל מודעה
    const stats = await getAdStats(ads.map((a) => a.id), 0)
        .catch((): Record<string, AdStats> => ({}));

    const categories = await getCategories().catch(() => []);
    const labelOf = (key: string) => categories.find((c) => c.key === key)?.label ?? key;

    return {
        loadFailed,
        user: { name: session.user.name ?? '', email: session.user.email ?? '' },
        // צורה ציבורית בלבד — ownerId (שעשוי להיות מייל) לא יוצא ללקוח
        gemachim: gemachim.map((g) => ({
            id: g.id,
            name: g.name,
            city: g.city,
            categoryLabel: labelOf(g.category),
            image: g.image,
            icon: g.icon,
            status: g.status,
            verified: g.verified,
        })),
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
