import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getCategories } from '$lib/server/adminStore';

// מגיש תמונת-נושא של קטגוריה שהועלתה בפאנל (שמורה כ-data URI בקונפיג)
// כקובץ בינארי עם מטמון CDN — במקום להטמיע את ה-base64 בכל עמוד.
// ?v= — גרסה לניפוץ מטמון בלבד (ראה toPublicCategories ב-adminStore).

export const GET: RequestHandler = async ({ params }) => {
    const cats = await getCategories();
    const src = cats.find((c) => c.key === params.key)?.image;
    const m = src ? /^data:([^;,]+);base64,(.+)$/s.exec(src) : null;
    if (!m) throw error(404, 'אין תמונה לקטגוריה זו');

    const body = Buffer.from(m[2], 'base64');
    return new Response(body, {
        headers: {
            'Content-Type': m[1],
            'Content-Length': String(body.length),
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
    });
};
