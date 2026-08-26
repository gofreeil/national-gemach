// ============================================================
// חיפוש משתמשים רשומים (לסופר-אדמין) — עבור מסך ניהול האדמינים.
// מחפש ברשימת המשתמשים המאוחדת של ה-Strapi המשותף:
//   1. שאילתת $containsi על username/email (השדות המובטחים בסכמה).
//   2. אם אין תוצאות (למשל חיפוש שם בעברית שלא קיים ב-username) —
//      סריקה מקומית של כל שדות הטקסט ברשומות, בדפדוף מוגבל.
// ============================================================

import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getAdminContext, requireSuperAdmin } from '$lib/server/admin';
import { strapiGet } from '$lib/server/strapiClient';
import { bestStrapiName, friendlyName, isMachineUsername, type StrapiUser } from '$lib/server/strapiAuth';

const PAGE_SIZE = 1000;   // maxLimit של השרת
const MAX_SCAN  = 5000;   // תקרת רשומות לסריקה המקומית
const MAX_RESULTS = 10;

interface UserHit {
    name: string;
    email: string;
    phone?: string;
    username?: string;
    identifier: string; // הערך שיוזן לשדה המזהה בבחירה
}

async function fetchUsers(params: Record<string, string>): Promise<StrapiUser[]> {
    // users-permissions מחזיר מערך גולמי (בלי מעטפת data)
    const res = await strapiGet<StrapiUser[] | { data?: StrapiUser[] }>('/api/users', params);
    return Array.isArray(res) ? res : (res?.data ?? []);
}

/** האם אחד משדות הטקסט של הרשומה מכיל את מחרוזת החיפוש */
function matchesLocally(u: StrapiUser, q: string): boolean {
    const needle = q.toLowerCase();
    return Object.values(u as unknown as Record<string, unknown>).some(
        v => typeof v === 'string' && v.toLowerCase().includes(needle)
    );
}

function toHit(u: StrapiUser): UserHit | null {
    const email = (u.email ?? '').trim();
    const phone = (u.phone ?? '').trim() || undefined;
    const username = (u.username ?? '').trim();
    const cleanUsername = username && !isMachineUsername(username) ? username : undefined;
    // מזהה מועדף להרשאה: מייל (הכי יציב בהתחברות) > טלפון > שם משתמש
    const identifier = email || phone || cleanUsername || '';
    if (!identifier) return null;
    return {
        name: friendlyName(bestStrapiName(u), email),
        email,
        phone,
        username: cleanUsername,
        identifier
    };
}

export const GET: RequestHandler = async ({ locals, url }) => {
    const { role } = await getAdminContext(locals);
    requireSuperAdmin(role);

    const q = (url.searchParams.get('q') ?? '').trim();
    if (q.length < 2) return json({ users: [] });

    try {
        // שלב 1: שאילתה מסוננת בצד Strapi
        let matches: StrapiUser[] = [];
        try {
            matches = await fetchUsers({
                'filters[$or][0][username][$containsi]': q,
                'filters[$or][1][email][$containsi]':    q,
                'pagination[limit]': String(MAX_RESULTS * 5)
            });
        } catch {
            // סינון לא נתמך בקונפיגורציה הזו — נמשיך לסריקה המקומית
        }

        // שלב 2: סריקה מקומית — תופסת גם שמות בעברית ושדות לא-סטנדרטיים
        if (matches.length === 0) {
            for (let start = 0; start < MAX_SCAN; start += PAGE_SIZE) {
                const batch = await fetchUsers({
                    'pagination[start]': String(start),
                    'pagination[limit]': String(PAGE_SIZE)
                });
                matches.push(...batch.filter(u => matchesLocally(u, q)));
                if (batch.length < PAGE_SIZE || matches.length >= MAX_RESULTS) break;
            }
        }

        const seen = new Set<string>();
        const users: UserHit[] = [];
        for (const u of matches) {
            const hit = toHit(u);
            if (!hit || seen.has(hit.identifier)) continue;
            seen.add(hit.identifier);
            users.push(hit);
            if (users.length >= MAX_RESULTS) break;
        }
        return json({ users });
    } catch (e) {
        console.error('[admin] user search failed:', e);
        return json({ users: [], error: 'החיפוש ברשימת המשתמשים נכשל — אפשר להזין מזהה ידנית' });
    }
};
