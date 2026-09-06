// ============================================================
// smsCampaigns.ts — תוצאות של הפצות SMS חד-פעמיות (סקריפטים ב-scripts/)
//
// כל הפצה נרשמת כפריט אחד באוסף ה-items המשותף תחת הקטגוריה הפנימית
// __ng_sms_campaign (כמו __ng_config / __ng_admin), עם כל הנמענים
// והסטטוס שלהם ב-extra_fields. הכתיבה נעשית מהסקריפט (scripts/notify-*.mjs
// עם STRAPI_TOKEN); כאן רק הקריאה — לפאנל של הסופר-אדמין באזור האישי.
// ============================================================

import { strapiGet, StrapiContentTypeError } from './strapiClient.js';
import type { StrapiItem } from './db';

export const SMS_CAMPAIGN_CATEGORY = '__ng_sms_campaign';

export type SmsRecipientStatus = 'sent' | 'failed' | 'pending';

export interface SmsCampaignRecipient {
    to: string;
    name: string;
    gemachId?: string;
    status: SmsRecipientStatus;
    at?: string;
    error?: string;
}

export interface SmsCampaign {
    id: string;
    key: string;
    title: string;
    message: string;
    provider: string;
    ranAt: string;
    totals: { gemachim: number; mobiles: number; landlines: number; sent: number; failed: number; pending: number };
    recipients: SmsCampaignRecipient[];
}

function num(v: unknown): number { return typeof v === 'number' && !isNaN(v) ? v : 0; }
function str(v: unknown): string { return typeof v === 'string' ? v : ''; }

function toCampaign(item: StrapiItem): SmsCampaign {
    const x = (item.extra_fields ?? {}) as Record<string, unknown>;
    const t = (x.totals ?? {}) as Record<string, unknown>;
    const recipients: SmsCampaignRecipient[] = Array.isArray(x.recipients)
        ? (x.recipients as Record<string, unknown>[]).map((r) => ({
            to: str(r.to),
            name: str(r.name),
            gemachId: str(r.gemachId) || undefined,
            status: (['sent', 'failed', 'pending'] as const).includes(r.status as SmsRecipientStatus)
                ? (r.status as SmsRecipientStatus) : 'pending',
            at: str(r.at) || undefined,
            error: str(r.error) || undefined,
        }))
        : [];
    return {
        id: item.documentId,
        key: str(x.key) || item.label,
        title: str(x.title) || item.label,
        message: str(x.message),
        provider: str(x.provider),
        ranAt: str(x.ranAt) || item.createdAt,
        totals: {
            gemachim: num(t.gemachim), mobiles: num(t.mobiles), landlines: num(t.landlines),
            sent: num(t.sent), failed: num(t.failed), pending: num(t.pending),
        },
        recipients,
    };
}

/** כל ההפצות, החדשה ראשונה. כשל/אוסף חסר → רשימה ריקה (לא מפיל את הפרופיל). */
export async function listSmsCampaigns(): Promise<SmsCampaign[]> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': SMS_CAMPAIGN_CATEGORY,
            'pagination[limit]':      '50',
            'sort':                   'createdAt:desc',
        });
        return (res.data ?? []).map(toCampaign).sort((a, b) => b.ranAt.localeCompare(a.ranAt));
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) console.error('[national-gemach] listSmsCampaigns failed:', e);
        return [];
    }
}
