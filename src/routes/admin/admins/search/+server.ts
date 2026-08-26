// ============================================================
// חיפוש משתמשים רשומים (לסופר-אדמין) — עבור מסך ניהול האדמינים.
// מחפש ברשימת המשתמשים המאוחדת של ה-Strapi המשותף:
//   1. שאילתת $containsi על username/email (השדות המובטחים בסכמה).
//   2. אם אין תוצאות (למשל חיפוש שם בעברית שלא קיים ב-username) —
//      סריקה מקומית של כל שדות הטקסט ברשומות, בדפדוף מוגבל.
//   3. אין התאמה מדויקת? — התאמה עמומה (מרחק לוינשטיין) על אותם
//      שדות, כדי ששגיאת כתיב ("ahuvhnd1") עדיין תציע את הדומים
//      ("ahuvahnd1@gmail.com"). מוחזר דגל fuzzy להצגת "אולי התכוונת".
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

// ---------- התאמה עמומה (שגיאות כתיב) ----------

/** מרחק לוינשטיין קלאסי, שתי שורות בלבד */
function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a.length) return b.length;
    if (!b.length) return a.length;
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        for (let j = 1; j <= b.length; j++) {
            cur[j] = Math.min(
                prev[j] + 1,
                cur[j - 1] + 1,
                prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
            );
        }
        prev = cur;
    }
    return prev[b.length];
}

/** כמה שגיאות כתיב מרשים לפי אורך החיפוש */
function typoBudget(len: number): number {
    if (len <= 4) return 1;
    if (len <= 7) return 2;
    return 3;
}

/**
 * המרחק העמום המינימלי בין החיפוש לרשומה: מושווה מול כל ערכי הטקסט,
 * מול החלק שלפני ה-@ במיילים, מול פיצול למילים, ומול קידומת באורך
 * החיפוש (כדי שגם הקלדה חלקית עם טעות תיתפס).
 */
function fuzzyDistance(u: StrapiUser, q: string): number {
    const budget = typoBudget(q.length);
    let best = Infinity;
    for (const raw of Object.values(u as unknown as Record<string, unknown>)) {
        if (typeof raw !== 'string' || !raw) continue;
        const v = raw.toLowerCase();
        const candidates = new Set<string>([v]);
        if (v.includes('@')) candidates.add(v.split('@')[0]);
        for (const tok of v.split(/[@._\-\s]+/)) if (tok.length >= 2) candidates.add(tok);
        for (const c of candidates) {
            // גם מול הערך המלא וגם מול קידומת באורך החיפוש
            const d = Math.min(
                levenshtein(q, c),
                c.length > q.length ? levenshtein(q, c.slice(0, q.length)) : Infinity,
                c.length > q.length + 1 ? levenshtein(q, c.slice(0, q.length + 1)) : Infinity
            );
            if (d < best) best = d;
            if (best === 0) return 0;
        }
    }
    return best <= budget ? best : Infinity;
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

        // שלב 2: סריקה מקומית — תופסת גם שמות בעברית ושדות לא-סטנדרטיים.
        // באותו מעבר נאספות גם התאמות עמומות, למקרה שאין אף התאמה מדויקת.
        let isFuzzy = false;
        if (matches.length === 0) {
            const fuzzyHits: { u: StrapiUser; d: number }[] = [];
            for (let start = 0; start < MAX_SCAN; start += PAGE_SIZE) {
                const batch = await fetchUsers({
                    'pagination[start]': String(start),
                    'pagination[limit]': String(PAGE_SIZE)
                });
                for (const u of batch) {
                    if (matchesLocally(u, q)) {
                        matches.push(u);
                    } else {
                        const d = fuzzyDistance(u, q);
                        if (d !== Infinity) fuzzyHits.push({ u, d });
                    }
                }
                if (batch.length < PAGE_SIZE || matches.length >= MAX_RESULTS) break;
            }
            // שלב 3: אין התאמה מדויקת — מציעים את הדומים ביותר
            if (matches.length === 0 && fuzzyHits.length > 0) {
                isFuzzy = true;
                matches = fuzzyHits.sort((a, b) => a.d - b.d).map(h => h.u);
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
        return json({ users, fuzzy: isFuzzy && users.length > 0 });
    } catch (e) {
        console.error('[admin] user search failed:', e);
        return json({ users: [], error: 'החיפוש ברשימת המשתמשים נכשל — אפשר להזין מזהה ידנית' });
    }
};
