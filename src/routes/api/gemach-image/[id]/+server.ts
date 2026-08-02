import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { findGemachById } from '$lib/server/gemachSource';

// ============================================================
// מגיש את תמונת הגמ"ח (שמורה כ-data URI ב-extra_fields ב-Strapi)
// כקובץ בינארי עם מטמון CDN. כך העמודים הציבוריים נושאים כתובת
// קצרה במקום base64 מוטמע שניפח את ה-HTML למגה-בייטים.
//   /api/gemach-image/<id>        — התמונה הראשית
//   /api/gemach-image/<id>?i=N    — תמונה N מהגלריה
//   ?v=  — גרסה לניפוץ מטמון בלבד (נגזרת מאורך התמונה, ראה gemachSource)
// ============================================================

export const GET: RequestHandler = async ({ params, url }) => {
    const g = await findGemachById(params.id);
    const iRaw = url.searchParams.get('i');
    const src = iRaw === null ? g?.image : g?.gallery?.[Number(iRaw)];
    const m = src ? /^data:([^;,]+);base64,(.+)$/s.exec(src) : null;
    if (!m) throw error(404, 'אין תמונה לגמ"ח זה');

    const body = Buffer.from(m[2], 'base64');
    return new Response(body, {
        headers: {
            'Content-Type': m[1],
            'Content-Length': String(body.length),
            // הדפדפן שעה; ה-CDN של Vercel יממה, ומגיש-ישן-תוך-רענון שבוע.
            // תמונה שהוחלפה ממילא מקבלת כתובת חדשה דרך פרמטר v.
            'Cache-Control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800',
        },
    });
};
