// ============================================================
// ownerAssets.ts — "הנכסים שלי": הפרסומות והגמ"חים של המשתמש המחובר.
// ------------------------------------------------------------
// אותה שליפה משרתת את /advertise/manage ואת האזור האישי (/profile), כדי
// ששתי התצוגות לא ייפרדו זו מזו. הזיהוי בשני המקרים נעשה מול אותה קבוצת
// מזהים (ownerCandidateKeys), והצורה המוחזרת ציבורית בלבד — ownerId
// (שעשוי להיות מייל) לא יוצא ללקוח.
// ============================================================

import { listForOwner } from './adsStore';
import { getAdStats, type AdStats } from './adStats';
import { getGemachimByOwner } from './db';
import { getCategories } from './adminStore';
import { ownerCandidateKeys, type OwnerSessionLike } from './ownership';

export interface OwnerGemachView {
    id: string;
    name: string;
    city: string;
    categoryLabel: string;
    image?: string;
    icon?: string;
    status?: string;
    verified?: boolean;
}

export interface OwnerAdView {
    id: string;
    title: string;
    subtitle: string;
    status: string;
    gradient: string;
    mainImage: string;
    mainImageFit: { x: number; y: number; z: number };
    submittedAt: string;
    editedAt: string | null;
    expiresAt: string | null;
    durationDays: number | null;
    requestedDurationDays: number | null;
    rejectionReason: string;
    totals: AdStats['totals'];
}

export interface OwnerAssets {
    /** שליפת הפרסומות נכשלה — הדף מציג הודעה במקום רשימה ריקה מטעה */
    loadFailed: boolean;
    gemachim: OwnerGemachView[];
    ads: OwnerAdView[];
}

export async function getOwnerAssets(user: OwnerSessionLike): Promise<OwnerAssets> {
    const keys = ownerCandidateKeys(user);

    let ads: Awaited<ReturnType<typeof listForOwner>> = [];
    let loadFailed = false;
    try {
        ads = await listForOwner(keys);
    } catch (e) {
        console.error('[ownerAssets] listForOwner failed:', e);
        loadFailed = true;
    }

    // כשל בשליפת הגמ"חים לא מפיל את הדף — getGemachimByOwner מחזיר [] ומדווח ללוג
    const gemachim = await getGemachimByOwner(keys);

    // ברשימה אין צורך בפירוט היומי — רק בסך הכל לכל מודעה
    const stats = await getAdStats(ads.map((a) => a.id), 0)
        .catch((): Record<string, AdStats> => ({}));

    const categories = await getCategories().catch(() => []);
    const labelOf = (key: string) => categories.find((c) => c.key === key)?.label ?? key;

    return {
        loadFailed,
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
            mainImageFit: a.mainImageFit,
            submittedAt: a.submittedAt,
            editedAt: a.editedAt,
            expiresAt: a.expiresAt,
            durationDays: a.durationDays,
            requestedDurationDays: a.requestedDurationDays,
            rejectionReason: a.rejectionReason,
            totals: stats[a.id]?.totals ?? { impressions: 0, clicks: 0, landing: 0, leads: 0 },
        })),
    };
}
