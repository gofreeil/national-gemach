// ============================================================
// claimsStore.ts — תביעות בעלות על גמ"ח
//
// כשמשתמש מזהה גמ"ח שהאדמין העלה כשלו, הוא שולח "בקשת בעלות". אדמין
// מאשר → הבעלות (user_id) עוברת אליו והוא יכול לערוך. מבנה זהה למודל
// אישור-הפרסומות (adsStore): פריטים ב-items תחת קטגוריה __ng_claim,
// סטטוס ב-status1 (pending/active=מאושר/rejected).
// ============================================================

import { strapiGet, strapiPost, strapiPut, strapiGetAll, StrapiContentTypeError } from './strapiClient.js';
import { setGemachOwner, getRawGemachimByStatus } from './db.js';
import { ownerIdForSession, ownerCandidateKeys, type OwnerSessionLike } from './ownership.js';
import { phoneTail } from './adminStore.js';

const CLAIM_CATEGORY = '__ng_claim';

export type ClaimStatus = 'pending' | 'approved' | 'rejected';

export interface ClaimSubmitter {
    id?: string;
    email?: string;
    name?: string;
    phone?: string;
}

export interface GemachClaim {
    id: string;            // documentId של פריט הבקשה
    gemachId: string;
    gemachName: string;
    status: ClaimStatus;
    submittedBy: ClaimSubmitter;
    ownerIdToSet: string;  // ה-user_id שייכתב לגמ"ח באישור
    submittedAt: string;
    decidedAt?: string;
    decidedBy?: string;
    rejectionReason?: string;
    createdAt: string;
}

interface StrapiItem {
    documentId: string;
    label: string;
    status1: string | null;
    extra_fields: Record<string, unknown> | null;
    createdAt: string;
}

const toStatus = (s1: string | null): ClaimStatus =>
    s1 === 'active' ? 'approved' : s1 === 'rejected' ? 'rejected' : 'pending';
const fromStatus = (s: ClaimStatus): string => (s === 'approved' ? 'active' : s);

function str(v: unknown): string { return v === null || v === undefined ? '' : String(v); }

function mapClaim(item: StrapiItem): GemachClaim {
    const x = (item.extra_fields ?? {}) as Record<string, unknown>;
    const sb = (x.submitted_by ?? {}) as Record<string, unknown>;
    return {
        id: item.documentId,
        gemachId: str(x.gemach_id),
        gemachName: str(x.gemach_name) || item.label || '',
        status: toStatus(item.status1),
        submittedBy: {
            id: sb.id ? str(sb.id) : undefined,
            email: sb.email ? str(sb.email) : undefined,
            name: sb.name ? str(sb.name) : undefined,
            phone: sb.phone ? str(sb.phone) : undefined,
        },
        ownerIdToSet: str(x.owner_id_to_set),
        submittedAt: str(x.submitted_at) || item.createdAt,
        decidedAt: x.decided_at ? str(x.decided_at) : undefined,
        decidedBy: x.decided_by ? str(x.decided_by) : undefined,
        rejectionReason: x.rejection_reason ? str(x.rejection_reason) : undefined,
        createdAt: item.createdAt,
    };
}

// מטמון קצר לבקשות הממתינות (למונה/באנר), כמו ב-adsStore
let pendingCache: { at: number; data: GemachClaim[] } | null = null;
const PENDING_TTL = 60_000;
function invalidate() { pendingCache = null; }

async function fetchAll(): Promise<GemachClaim[]> {
    try {
        const rows = await strapiGetAll<StrapiItem>('/api/items', {
            'filters[category][$eq]': CLAIM_CATEGORY,
            'sort': 'createdAt:desc',
        });
        return rows.map(mapClaim);
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return [];
        console.error('[claims] fetchAll failed:', e);
        return [];
    }
}

export async function listAllClaims(): Promise<GemachClaim[]> {
    return fetchAll();
}

export async function listPendingClaims(): Promise<GemachClaim[]> {
    if (pendingCache && Date.now() - pendingCache.at < PENDING_TTL) return pendingCache.data;
    const pending = (await fetchAll()).filter((c) => c.status === 'pending');
    pendingCache = { at: Date.now(), data: pending };
    return pending;
}

export async function countPendingClaims(): Promise<number> {
    return (await listPendingClaims()).length;
}

/** מזהי הגמ"חים שלמשתמש יש עליהם בקשה ממתינה (למצב "נשלח, ממתין לאישור") */
export async function userPendingClaimGemachIds(user: { email?: string | null }): Promise<Set<string>> {
    const email = (user.email ?? '').trim().toLowerCase();
    if (!email) return new Set();
    const all = await fetchAll();
    return new Set(
        all
            .filter((c) => c.status === 'pending' && (c.submittedBy.email ?? '').toLowerCase() === email)
            .map((c) => c.gemachId),
    );
}

export interface SubmitClaimInput {
    gemachId: string;
    gemachName: string;
    user: { id?: string | null; email?: string | null; name?: string | null; phone?: string | null };
}

/** יוצר בקשת בעלות ממתינה. מדלג (created=false) אם כבר קיימת בקשה ממתינה
 *  של אותו משתמש לאותו גמ"ח. */
export async function submitClaim(input: SubmitClaimInput): Promise<{ created: boolean }> {
    const email = (input.user.email ?? '').trim().toLowerCase();
    const ownerIdToSet = ownerIdForSession({ id: input.user.id, email });
    if (!ownerIdToSet) throw new Error('submitClaim: אין מזהה למשתמש');

    const dup = (await fetchAll()).find(
        (c) =>
            c.gemachId === input.gemachId &&
            c.status === 'pending' &&
            (c.submittedBy.email ?? '').toLowerCase() === email,
    );
    if (dup) return { created: false };

    await strapiPost('/api/items', {
        data: {
            label: `תביעת בעלות: ${input.gemachName}`,
            category: CLAIM_CATEGORY,
            description: `בקשת בעלות על גמ"ח מאת ${input.user.name || email}`,
            icon: '🤝',
            status1: 'pending',
            extra_fields: {
                gemach_id: input.gemachId,
                gemach_name: input.gemachName,
                owner_id_to_set: ownerIdToSet,
                submitted_by: {
                    ...(input.user.id ? { id: String(input.user.id) } : {}),
                    email,
                    ...(input.user.name ? { name: input.user.name } : {}),
                    ...(input.user.phone ? { phone: input.user.phone } : {}),
                },
                submitted_at: new Date().toISOString(),
            },
            publishedAt: new Date().toISOString(),
        },
    });
    invalidate();
    return { created: true };
}

async function setDecision(
    claimId: string,
    status: ClaimStatus,
    patch: Record<string, unknown>,
): Promise<GemachClaim> {
    const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${claimId}`);
    if (!cur.data) throw new Error('הבקשה לא נמצאה');
    const extra = { ...((cur.data.extra_fields ?? {}) as Record<string, unknown>), ...patch };
    await strapiPut(`/api/items/${claimId}`, { data: { status1: fromStatus(status), extra_fields: extra } });
    invalidate();
    return mapClaim({ ...cur.data, status1: fromStatus(status), extra_fields: extra });
}

/** מאשר בקשה: מעביר בעלות על הגמ"ח למבקש (user_id) ומסמן את הבקשה כמאושרת. */
export async function approveClaim(claimId: string, opts: { decidedBy: string }): Promise<GemachClaim> {
    const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${claimId}`);
    if (!cur.data) throw new Error('הבקשה לא נמצאה');
    const claim = mapClaim(cur.data);
    if (!claim.gemachId) throw new Error('לבקשה אין מזהה גמ"ח');
    if (!claim.ownerIdToSet) throw new Error('לבקשה אין מזהה-בעלים לכתיבה');

    // מעבירים בעלות — זה מה שמאפשר למבקש לערוך את הגמ"ח (בשני האתרים)
    await setGemachOwner(claim.gemachId, claim.ownerIdToSet);

    return setDecision(claimId, 'approved', {
        decided_at: new Date().toISOString(),
        decided_by: opts.decidedBy,
        rejection_reason: '',
    });
}

export async function rejectClaim(
    claimId: string,
    opts: { reason?: string; decidedBy: string },
): Promise<GemachClaim> {
    return setDecision(claimId, 'rejected', {
        decided_at: new Date().toISOString(),
        decided_by: opts.decidedBy,
        rejection_reason: opts.reason ?? '',
    });
}

/**
 * זיהוי אוטומטי: גמ"חים שהטלפון שלהם תואם לטלפון של המשתמש, שאינם כבר
 * בבעלותו ואין עליהם בקשה ממתינה שלו. משמש להצעה "האם זה שלך?" באזור האישי.
 * ריק אם למשתמש אין טלפון בסשן (נפוץ במשתמש שנרשם עכשיו — ראה auth.ts).
 */
export async function findClaimableByPhone(
    user: { id?: string | null; email?: string | null; phone?: string | null },
): Promise<{ id: string; name: string; city: string }[]> {
    const tail = phoneTail((user.phone ?? '').trim());
    if (!tail || tail.length < 7) return [];

    const keys = ownerCandidateKeys({ id: user.id, email: user.email } as OwnerSessionLike);
    const pendingIds = await userPendingClaimGemachIds({ email: user.email });

    let rows: { documentId: string; label?: string; city?: string | null; phone?: string | null; user_id?: string | null }[];
    try {
        rows = await getRawGemachimByStatus('active');
    } catch {
        return [];
    }

    const out: { id: string; name: string; city: string }[] = [];
    for (const item of rows) {
        if (!item.phone || phoneTail(item.phone) !== tail) continue;
        const oid = (item.user_id ?? '').trim();
        if (oid && (keys.has(oid) || keys.has(oid.toLowerCase()))) continue; // כבר שלו
        if (pendingIds.has(item.documentId)) continue;                        // כבר ביקש
        out.push({ id: item.documentId, name: item.label ?? '', city: item.city ?? '' });
        if (out.length >= 10) break;
    }
    return out;
}
