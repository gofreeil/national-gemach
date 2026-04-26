// ============================================================
// Strapi 5 HTTP Client — national-gemach
// משותף עם אתר "קהילה בשכונה" — אותו STRAPI_URL + STRAPI_TOKEN
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
            console.warn(`[Strapi] GET ${path} — retry ${attempt}/${RETRY_ATTEMPTS - 1}`);
            await delay(RETRY_DELAY_MS * attempt);
        }
    }
    throw lastError!;
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
