// ============================================================
// Strapi 5 HTTP Client - national-gemach
// משותף עם אתר "קהילה בשכונה" - אותו STRAPI_URL + STRAPI_TOKEN
// ============================================================

import { env } from '$env/dynamic/private';

const STRAPI_URL   = env.STRAPI_URL   ?? 'http://localhost:1337';
const STRAPI_TOKEN = env.STRAPI_TOKEN ?? '';

const RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 800;

export class StrapiContentTypeError extends Error {
    constructor(path: string, status: number) {
        super(`[Strapi] Content type not registered: ${path} (${status})`);
        this.name = 'StrapiContentTypeError';
    }
}

function getHeaders(): HeadersInit {
    return {
        'Content-Type': 'application/json',
        ...(STRAPI_TOKEN ? { Authorization: `Bearer ${STRAPI_TOKEN}` } : {}),
    };
}

function isRetryable(status: number): boolean {
    return status === 503 || status === 502 || status === 504 || status === 429;
}

function isContentTypeError(status: number, text: string): boolean {
    return status === 404 && (
        text.includes('Route not found') ||
        text.includes('Not Found') ||
        text.includes('url not found')
    );
}

const delay = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function strapiGet<T = unknown>(
    path: string,
    params?: Record<string, string>,
): Promise<T> {
    const url = new URL(STRAPI_URL + path);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

    let lastError: Error | undefined;
    for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
        try {
            const res = await fetch(url.toString(), { headers: getHeaders() });
            if (res.ok) return res.json() as Promise<T>;

            const text = await res.text();
            if (isContentTypeError(res.status, text)) {
                throw new StrapiContentTypeError(path, res.status);
            }
            if (!isRetryable(res.status)) {
                throw new Error(`[Strapi] GET ${path} → ${res.status}: ${text}`);
            }
            lastError = new Error(`[Strapi] GET ${path} → ${res.status}: ${text}`);
        } catch (e) {
            if (e instanceof StrapiContentTypeError) throw e;
            const err = e instanceof Error ? e : new Error(String(e));
            const isHttp = err.message.startsWith('[Strapi] GET') && !err.message.includes('fetch failed');
            if (isHttp) throw err;
            lastError = err;
        }
        if (attempt < RETRY_ATTEMPTS) {
            console.warn(`[Strapi] GET ${path} - retry ${attempt}/${RETRY_ATTEMPTS - 1}`);
            await delay(RETRY_DELAY_MS * attempt);
        }
    }
    throw lastError!;
}

// גודל עמוד לשליפות "הכל". תואם ל-maxLimit של השרת (community-backend/config/api.ts),
// כלומר מספר הבקשות המינימלי האפשרי.
const ALL_PAGE_SIZE = 1000;
// גבול-בטיחות נגד לולאה אינסופית אם השרת מתעלם מ-start (5M רשומות — הרבה מעבר לכל צורך).
const ALL_MAX_PAGES = 5000;

/**
 * שולף את *כל* התוצאות מ-Strapi ללא שום תקרה, ע"י מעבר עמוד-אחר-עמוד.
 *
 * למה: Strapi חוסם כל שאילתה בודדת ב-maxLimit (1000). כלומר בקשה עם
 * limit=2000/5000 לא נכשלת — היא פשוט **נחתכת בשקט** ל-1000, וכל מה שמעבר
 * נעלם בלי שגיאה. כאן אנחנו מדפדפים עם start/limit עד שנגמרות התוצאות,
 * כך שהמאגר יכול לגדול ללא הגבלה (מיליון פריטים ומעלה).
 */
export async function strapiGetAll<T = unknown>(
    path: string,
    params: Record<string, string> = {},
): Promise<T[]> {
    const out: T[] = [];
    for (let page = 0; page < ALL_MAX_PAGES; page++) {
        const res = await strapiGet<{ data: T[] }>(path, {
            ...params,
            'pagination[start]': String(page * ALL_PAGE_SIZE),
            'pagination[limit]': String(ALL_PAGE_SIZE),
        });
        const batch = res.data ?? [];
        out.push(...batch);
        // עמוד חלקי = הגענו לסוף
        if (batch.length < ALL_PAGE_SIZE) return out;
    }
    console.warn(`[Strapi] strapiGetAll ${path} hit the ${ALL_MAX_PAGES}-page safety bound`);
    return out;
}

export async function strapiPost<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(STRAPI_URL + path, {
        method:  'POST',
        headers: getHeaders(),
        body:    JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        if (isContentTypeError(res.status, text)) throw new StrapiContentTypeError(path, res.status);
        throw new Error(`[Strapi] POST ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

export async function strapiPut<T = unknown>(path: string, body: unknown): Promise<T> {
    const res = await fetch(STRAPI_URL + path, {
        method:  'PUT',
        headers: getHeaders(),
        body:    JSON.stringify(body),
    });
    if (!res.ok) {
        const text = await res.text();
        if (isContentTypeError(res.status, text)) throw new StrapiContentTypeError(path, res.status);
        throw new Error(`[Strapi] PUT ${path} → ${res.status}: ${text}`);
    }
    return res.json() as Promise<T>;
}

export async function strapiDelete<T = unknown>(path: string): Promise<T> {
    const res = await fetch(STRAPI_URL + path, {
        method:  'DELETE',
        headers: getHeaders(),
    });
    if (!res.ok) {
        const text = await res.text();
        if (isContentTypeError(res.status, text)) throw new StrapiContentTypeError(path, res.status);
        throw new Error(`[Strapi] DELETE ${path} → ${res.status}: ${text}`);
    }
    // Strapi returns the deleted entity; some configs return 204 with empty body
    const text = await res.text();
    return (text ? JSON.parse(text) : {}) as T;
}
