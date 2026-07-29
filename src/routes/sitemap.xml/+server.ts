// ============================================================
// sitemap.xml — מפת האתר הדינמית. מפרטת את כל הגמ"חים הפעילים במאגר
// כדי שגוגל יגלה וימפה כל דף גמ"ח בנפרד, ולא רק את דף הבית.
// טיוטות אינן נכללות (getMergedGemachim מסנן אותן).
// ============================================================

import type { RequestHandler } from './$types';
import { SITE_URL } from '$lib/seo';
import { getMergedGemachim } from '$lib/server/gemachSource';

export const prerender = false;

interface SitemapUrl {
    loc: string;
    changefreq: string;
    priority: string;
    lastmod?: string;
}

/** בריחת תווים אסורים ב-XML (& ' " < >) בתוך <loc> */
function xmlEscape(s: string): string {
    return s
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

export const GET: RequestHandler = async ({ setHeaders }) => {
    let gemachim: Awaited<ReturnType<typeof getMergedGemachim>> = [];
    try {
        gemachim = await getMergedGemachim();
    } catch {
        gemachim = [];   // תקלה ב-DB לא תפיל את מפת האתר — לפחות הדפים הקבועים ייסרקו
    }

    const staticUrls: SitemapUrl[] = [
        { loc: `${SITE_URL}/`, changefreq: 'daily', priority: '1.0' },
        { loc: `${SITE_URL}/gemachim`, changefreq: 'daily', priority: '0.9' },
        { loc: `${SITE_URL}/gemach/add`, changefreq: 'monthly', priority: '0.6' },
        { loc: `${SITE_URL}/advertise`, changefreq: 'monthly', priority: '0.4' },
    ];

    const gemachUrls: SitemapUrl[] = gemachim.map((g) => ({
        loc: `${SITE_URL}/gemach/${encodeURIComponent(g.id)}`,
        changefreq: 'weekly',
        priority: '0.8',
    }));

    const urls = [...staticUrls, ...gemachUrls];

    const xml =
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
        urls
            .map(
                (u) =>
                    `  <url>\n` +
                    `    <loc>${xmlEscape(u.loc)}</loc>\n` +
                    (u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : '') +
                    `    <changefreq>${u.changefreq}</changefreq>\n` +
                    `    <priority>${u.priority}</priority>\n` +
                    `  </url>`,
            )
            .join('\n') +
        `\n</urlset>`;

    setHeaders({
        'Content-Type': 'application/xml',
        'cache-control': 'public, max-age=0, s-maxage=1800, stale-while-revalidate=3600',
    });
    return new Response(xml);
};
