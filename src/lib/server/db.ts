// ============================================================
// db.ts - שכבת נתונים לגמ"חים מ-Strapi
// משותף עם אתר "קהילה בשכונה"
// ============================================================

import { strapiGet, strapiPost, StrapiContentTypeError } from './strapiClient.js';
import type { Gemach } from '$lib/gemachData';
import { categories } from '$lib/gemachData';

interface StrapiItem {
    id: number;
    documentId: string;
    label: string;
    category: string;
    description: string | null;
    contact: string | null;
    phone: string | null;
    address: string | null;
    icon: string | null;
    color: string | null;
    neighborhood: string | null;
    city: string | null;
    extra_fields: Record<string, unknown> | null;
    status1: string | null;
    user_id: string | null;
    createdAt: string;
}

const KNOWN_KEYS = new Set(categories.map(c => c.key));

/** ממפה item של Strapi לסכמת Gemach של האתר הארצי */
function mapItemToGemach(item: StrapiItem): Gemach {
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    const rawType = (extra.gmach_type ?? '').toString().trim();

    // Normalize sub-category - use known key if matched, otherwise 'other'
    const subCategory = KNOWN_KEYS.has(rawType) ? rawType : 'other';

    // tags - prefer real tags saved by the publisher, fall back to derived ones
    let tags: string[] = [];
    if (Array.isArray(extra.tags)) {
        tags = (extra.tags as unknown[]).filter(t => typeof t === 'string').map(t => t as string);
    }
    if (tags.length === 0) {
        if (rawType && !KNOWN_KEYS.has(rawType)) tags.push(rawType);
        if (item.neighborhood) tags.push(item.neighborhood);
    }

    return {
        id:            item.documentId,
        name:          item.label ?? '',
        category:      subCategory,
        city:          item.city ?? '',
        neighborhood:  item.neighborhood ?? undefined,
        phone:         item.phone ?? undefined,
        description:   item.description ?? '',
        tags,
    };
}

/** מחזיר את כל הגמ"חים הפעילים מ-Strapi */
export async function getAllGemachim(): Promise<Gemach[]> {
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': 'gmach',
            'filters[status1][$eq]':  'active',
            'sort':                   'createdAt:desc',
            'pagination[limit]':      '1000',
        });
        return (res.data ?? []).map(mapItemToGemach);
    } catch (e) {
        if (e instanceof StrapiContentTypeError) {
            console.warn('[national-gemach] content type not registered, returning []');
            return [];
        }
        console.error('[national-gemach] getAllGemachim failed:', e);
        return [];
    }
}

export interface CreateGemachInput {
    name: string;
    category: string;       // sub-category key (clothing, baby, ...)
    city: string;
    neighborhood?: string;
    address?: string;
    phone: string;
    contact?: string;
    description?: string;
    hours?: string;
    icon?: string;
    logoBase64?: string;
    images?: string[];
    tags?: string[];
}

/** יוצר גמ"ח חדש ב-Strapi (מופיע מיד גם בקהילה) */
export async function createGemach(input: CreateGemachInput): Promise<{ id: string }> {
    const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
        data: {
            label:        input.name,
            category:     'gmach',
            description:  input.description ?? '',
            contact:      input.contact     ?? '',
            phone:        input.phone,
            address:      input.address     ?? '',
            icon:         input.icon        || '🤝',
            color:        'amber',
            neighborhood: input.neighborhood ?? '',
            city:         input.city,
            extra_fields: {
                gmach_type: input.category,
                ...(input.hours      ? { hours:  input.hours }      : {}),
                ...(input.logoBase64 ? { logo:   input.logoBase64 } : {}),
                ...(input.images && input.images.length > 0 ? { images: input.images } : {}),
                ...(input.tags   && input.tags.length   > 0 ? { tags:   input.tags   } : {}),
            },
            status1:      'active',
            publishedAt:  new Date().toISOString(),
        },
    });
    return { id: res.data.documentId };
}
