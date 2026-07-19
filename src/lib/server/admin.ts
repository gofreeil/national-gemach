// ============================================================
// admin.ts — קביעת תפקיד (אדמין / סופר-אדמין) והגנת מסלולים
//
// זיהוי לפי אימייל / שם משתמש / טלפון:
//   1. משתני סביבה (bootstrap) — תמיד עובד, גם כשה-DB ריק:
//        NG_SUPER_ADMINS="yahavanter@gmail.com,0501234567,username"
//        NG_ADMINS="..."
//   2. רשימת האדמינים המנוהלת בפאנל (נשמרת ב-Strapi).
// ============================================================

import { error, redirect } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';
import {
    getAdmins,
    normalizeEmail,
    normalizePhone,
    phoneTail,
    type AdminRole
} from './adminStore.js';

export type { AdminRole };

export interface SessionUserLike {
    email?: string | null;
    name?: string | null;    // שם משתמש
    phone?: string | null;
}

function parseEnvList(raw: string | undefined): string[] {
    return (raw ?? '')
        .split(/[,\n;]/)
        .map(s => s.trim())
        .filter(Boolean);
}

// ברירת המחדל לסופר-אדמין — הבעלים. ניתן לעקוף/להוסיף דרך משתני הסביבה.
const ENV_SUPER = parseEnvList(env.NG_SUPER_ADMINS ?? 'yahavanter@gmail.com');
const ENV_ADMIN = parseEnvList(env.NG_ADMINS);

/** רשימות ה-bootstrap מהסביבה — לתצוגה בלבד (לא ניתנות לעריכה מהפאנל) */
export function getBootstrapAdmins(): { superAdmins: string[]; admins: string[] } {
	return { superAdmins: [...ENV_SUPER], admins: [...ENV_ADMIN] };
}

/** בונה את קבוצת המזהים המנורמלים של המשתמש הנוכחי */
function userIdentifiers(user: SessionUserLike): Set<string> {
    const set = new Set<string>();
    if (user.email) set.add('email:' + normalizeEmail(user.email));
    if (user.name)  set.add('user:'  + user.name.trim().toLowerCase());
    if (user.phone) {
        set.add('phone:' + normalizePhone(user.phone));
        set.add('ptail:' + phoneTail(user.phone));
    }
    return set;
}

/** ממיר ערך גולמי (env או roster) לצורת מזהה תואמת-חיפוש */
function candidateKeys(raw: string): string[] {
    const v = raw.trim();
    if (!v) return [];
    if (v.includes('@')) return ['email:' + normalizeEmail(v)];
    const digits = v.replace(/\D/g, '');
    if (digits.length >= 6 && digits.length / v.replace(/\s/g, '').length > 0.6) {
        return ['phone:' + normalizePhone(v), 'ptail:' + phoneTail(v)];
    }
    return ['user:' + v.toLowerCase()];
}

function matchesAny(ids: Set<string>, raw: string): boolean {
    return candidateKeys(raw).some(k => ids.has(k));
}

/**
 * מחזיר את התפקיד של המשתמש, או null אם אינו מורשה.
 * super_admin גובר על admin אם קיימת התאמה לשניהם.
 */
export async function resolveRole(user: SessionUserLike | null | undefined): Promise<AdminRole | null> {
    if (!user || (!user.email && !user.name && !user.phone)) return null;
    const ids = userIdentifiers(user);

    // 1. bootstrap מסביבה
    if (ENV_SUPER.some(v => matchesAny(ids, v))) return 'super_admin';

    // 2. רשימת ה-DB
    let role: AdminRole | null = null;
    try {
        const admins = await getAdmins();
        for (const a of admins) {
            if (matchesAny(ids, a.identifier)) {
                if (a.role === 'super_admin') return 'super_admin';
                role = 'admin';
            }
        }
    } catch { /* ממשיכים ל-env admin */ }
    if (role) return role;

    // 3. bootstrap admin מסביבה
    if (ENV_ADMIN.some(v => matchesAny(ids, v))) return 'admin';

    return null;
}

export async function isAdmin(user: SessionUserLike | null | undefined): Promise<boolean> {
    return (await resolveRole(user)) !== null;
}

/** שולף session מ-locals ומחזיר {user, role}. לשימוש ב-load של /admin. */
export async function getAdminContext(locals: App.Locals): Promise<{
    user: { id?: string; name: string; email: string; phone?: string };
    role: AdminRole;
}> {
    const session = await locals.auth();
    const su = session?.user as (SessionUserLike & { id?: string }) | undefined;
    if (!su) throw redirect(302, '/login?redirect=/admin');
    const role = await resolveRole(su);
    if (!role) throw error(403, 'אין לך הרשאת גישה לפאנל הניהול');
    return {
        user: {
            id:    su.id,
            name:  su.name ?? '',
            email: su.email ?? '',
            phone: su.phone ?? undefined
        },
        role
    };
}

/** מוודא שהמשתמש הוא סופר-אדמין (למסלולי ניהול אדמינים). */
export function requireSuperAdmin(role: AdminRole): void {
    if (role !== 'super_admin') throw error(403, 'פעולה זו מותרת לסופר-אדמין בלבד');
}
