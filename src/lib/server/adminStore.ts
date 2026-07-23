// ============================================================
// adminStore.ts — רשימת האדמינים והגדרות הפאנל
// נשמר באוסף ה-items המשותף תחת קטגוריות פנימיות (__ng_*)
// כדי לא לדרוש שינוי סכמה ב-Strapi. הקטגוריות האלה אינן מוצגות
// באתר "קהילה בשכונה" (הוא מסנן לפי הקטגוריות שלו בלבד).
// ============================================================

import { strapiGet, strapiGetAll, strapiPost, strapiPut, strapiDelete, StrapiContentTypeError } from './strapiClient.js';
import type { CategoryDef } from '$lib/gemachData';
import { categories as defaultCategories } from '$lib/gemachData';

const ADMIN_CATEGORY  = '__ng_admin';
const CONFIG_CATEGORY = '__ng_config';

export type AdminRole = 'super_admin' | 'admin';
export type IdentifierType = 'email' | 'username' | 'phone';

export interface AdminEntry {
    id: string;              // documentId
    identifier: string;      // הערך המנורמל (email/username/phone)
    type: IdentifierType;
    role: AdminRole;
    label?: string;          // שם תצוגה (אופציונלי)
    createdAt?: string;
}

interface StrapiItem {
    documentId: string;
    label: string;
    category: string;
    extra_fields: Record<string, unknown> | null;
    createdAt: string;
}

// ---------- נרמול מזהים ----------

export function normalizeEmail(v: string): string {
    return v.trim().toLowerCase();
}
export function normalizeUsername(v: string): string {
    return v.trim().toLowerCase();
}
/** ספרות בלבד */
export function normalizePhone(v: string): string {
    return v.replace(/\D/g, '');
}
/** 9 הספרות האחרונות — משווה בין פורמט מקומי (05...) לבינ"ל (+972...) */
export function phoneTail(v: string): string {
    const d = normalizePhone(v);
    return d.length >= 9 ? d.slice(-9) : d;
}

/** מזהה את סוג המזהה לפי הערך */
export function detectType(value: string): IdentifierType {
    const v = value.trim();
    if (v.includes('@')) return 'email';
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 6 && digits.length / v.replace(/\s/g, '').length > 0.6) return 'phone';
    return 'username';
}

export function normalizeByType(value: string, type: IdentifierType): string {
    if (type === 'email')    return normalizeEmail(value);
    if (type === 'phone')    return normalizePhone(value);
    return normalizeUsername(value);
}

// ---------- מטמון קצר לרשימת האדמינים ----------
// כדי לא לפגוע ב-Strapi בכל טעינת עמוד (בדיקת ההאדר). מתאפס בכל שינוי.

let rosterCache: { at: number; data: AdminEntry[] } | null = null;
const ROSTER_TTL_MS = 20_000;

function invalidateRoster() { rosterCache = null; }

function mapAdmin(item: StrapiItem): AdminEntry {
    const extra = (item.extra_fields ?? {}) as Record<string, unknown>;
    const type = (extra.id_type as IdentifierType) ?? 'email';
    const role = (extra.role as AdminRole) === 'super_admin' ? 'super_admin' : 'admin';
    return {
        id:         item.documentId,
        identifier: String(item.label ?? '').trim(),
        type,
        role,
        label:      typeof extra.display === 'string' ? extra.display : undefined,
        createdAt:  item.createdAt,
    };
}

/** רשימת האדמינים המנוהלים ב-DB (עם מטמון) */
export async function getAdmins(useCache = true): Promise<AdminEntry[]> {
    if (useCache && rosterCache && Date.now() - rosterCache.at < ROSTER_TTL_MS) {
        return rosterCache.data;
    }
    try {
        const rows = await strapiGetAll<StrapiItem>('/api/items', {
            'filters[category][$eq]': ADMIN_CATEGORY,
            'sort':                   'createdAt:asc',
        });
        const data = rows.map(mapAdmin);
        rosterCache = { at: Date.now(), data };
        return data;
    } catch (e) {
        if (e instanceof StrapiContentTypeError) return [];
        console.error('[national-gemach] getAdmins failed:', e);
        return rosterCache?.data ?? [];
    }
}

/** מוסיף אדמין לרשימה. מחזיר את הרשומה שנוצרה. */
export async function addAdmin(rawIdentifier: string, role: AdminRole, display?: string): Promise<AdminEntry> {
    const type = detectType(rawIdentifier);
    const identifier = normalizeByType(rawIdentifier, type);
    if (!identifier) throw new Error('מזהה ריק');

    // מניעת כפילות
    const existing = await getAdmins(false);
    const dup = existing.find(a => a.type === type && normalizeByType(a.identifier, type) === identifier);
    if (dup) {
        if (dup.role !== role) await setAdminRole(dup.id, role);
        return { ...dup, role };
    }

    const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
        data: {
            label:        identifier,
            category:     ADMIN_CATEGORY,
            description:  `[SYSTEM] הרשאת ${role === 'super_admin' ? 'סופר-אדמין' : 'אדמין'} — הגמ"ח הארצי`,
            icon:         '🔑',
            extra_fields: { id_type: type, role, ...(display ? { display } : {}) },
            status1:      'active',
            publishedAt:  new Date().toISOString(),
        },
    });
    invalidateRoster();
    return mapAdmin(res.data);
}

export async function setAdminRole(documentId: string, role: AdminRole): Promise<void> {
    let extra: Record<string, unknown> = {};
    try {
        const cur = await strapiGet<{ data: StrapiItem | null }>(`/api/items/${documentId}`);
        extra = (cur.data?.extra_fields ?? {}) as Record<string, unknown>;
    } catch { /* noop */ }
    await strapiPut(`/api/items/${documentId}`, { data: { extra_fields: { ...extra, role } } });
    invalidateRoster();
}

export async function removeAdmin(documentId: string): Promise<void> {
    await strapiDelete(`/api/items/${documentId}`);
    invalidateRoster();
}

// ---------- הגדרות כלליות (config) ----------

let configCache: Record<string, unknown> | null = null;
let configItemId: string | null = null;
let configLoadedAt = 0;
const CONFIG_TTL_MS = 20_000;

async function loadConfig(force = false): Promise<Record<string, unknown>> {
    if (!force && configCache && Date.now() - configLoadedAt < CONFIG_TTL_MS) return configCache;
    try {
        const res = await strapiGet<{ data: StrapiItem[] }>('/api/items', {
            'filters[category][$eq]': CONFIG_CATEGORY,
            'pagination[limit]':      '1',
        });
        const item = (res.data ?? [])[0];
        configItemId = item?.documentId ?? null;
        configCache  = (item?.extra_fields ?? {}) as Record<string, unknown>;
        configLoadedAt = Date.now();
        return configCache;
    } catch (e) {
        if (!(e instanceof StrapiContentTypeError)) console.error('[national-gemach] loadConfig failed:', e);
        configCache = configCache ?? {};
        return configCache;
    }
}

async function saveConfig(patch: Record<string, unknown>): Promise<void> {
    const current = await loadConfig(true);
    const merged = { ...current, ...patch };
    if (configItemId) {
        await strapiPut(`/api/items/${configItemId}`, { data: { extra_fields: merged } });
    } else {
        const res = await strapiPost<{ data: StrapiItem }>('/api/items', {
            data: {
                label:        'national-gemach-config',
                category:     CONFIG_CATEGORY,
                description:  '[SYSTEM] הגדרות הפאנל של הגמ"ח הארצי',
                icon:         '⚙️',
                extra_fields: merged,
                status1:      'active',
                publishedAt:  new Date().toISOString(),
            },
        });
        configItemId = res.data.documentId;
    }
    configCache = merged;
    configLoadedAt = Date.now();
}

/** רשימת הקטגוריות בפועל — מהגדרות אם נשמרו, אחרת ברירת המחדל המובנית */
export async function getCategories(): Promise<CategoryDef[]> {
    const cfg = await loadConfig();
    const stored = cfg.categories;
    if (Array.isArray(stored) && stored.length > 0) {
        // גיבוי תמונת-נושא לפי מפתח: קונפיג שנשמר לפני שהתמונות נוספו לא יכיל image,
        // ובכל זאת נציג את תמונת ברירת המחדל (אם קיימת לאותו מפתח).
        const imageByKey = new Map(defaultCategories.map(c => [c.key, c.image]));
        return (stored as unknown[])
            .filter(c => c && typeof c === 'object' && 'key' in (c as object))
            .map(c => {
                const o = c as Record<string, unknown>;
                const key = String(o.key);
                const image = (typeof o.image === 'string' && o.image) ? o.image : imageByKey.get(key);
                return {
                    key,
                    label: String(o.label ?? o.key),
                    icon: String(o.icon ?? '📦'),
                    ...(image ? { image } : {}),
                };
            });
    }
    return defaultCategories;
}

export async function saveCategories(list: CategoryDef[]): Promise<void> {
    await saveConfig({ categories: list });
}
