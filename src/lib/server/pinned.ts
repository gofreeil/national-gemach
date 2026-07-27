// ============================================================
// pinned.ts — 📌 הרשימה הנעוצה בראש דף הבית
// המזהים נשמרים בהגדרות הפאנל (config.pinned) ולא בדגל featured,
// כדי שאפשר יהיה לנעוץ גם גמ"חים מהרשימה הסטטית שאינם ב-DB.
// לפריטים מנוהלים הדגל featured עדיין מסונכרן, כדי לשמור על הסימון
// בפאנל, על תג "מומלץ" בדף הפריט ועל המיון ב-DB.
// ============================================================

import type { Gemach } from '$lib/gemachData';
import { getPinnedIds, savePinnedIds } from './adminStore';
import { getMergedGemachim } from './gemachSource';
import { patchGemachOrder } from './db';

/** אינדקס לפי מזהה התצוגה, ובנוסף לפי sourceId — כדי שרשימה שנשמרה לפני
 *  שפריט סטטי יובא ל-DB תמשיך להצביע עליו אחרי שקיבל documentId חדש. */
export function indexGemachim(all: Gemach[]): Map<string, Gemach> {
    const byId = new Map<string, Gemach>();
    for (const g of all) byId.set(g.id, g);
    for (const g of all) if (g.sourceId && !byId.has(g.sourceId)) byId.set(g.sourceId, g);
    return byId;
}

/** מנרמל רשימת מזהים למזהי תצוגה קיימים בלבד, בלי כפילויות ובשמירת הסדר */
function normalize(all: Gemach[], ids: string[]): string[] {
    const byId = indexGemachim(all);
    const out: string[] = [];
    const seen = new Set<string>();
    for (const id of ids) {
        const g = byId.get(id);
        if (g && !seen.has(g.id)) { seen.add(g.id); out.push(g.id); }
    }
    return out;
}

/** מזהי הנעוצים בסדר התצוגה. אם הרשימה מעולם לא נשמרה — נופל חזרה
 *  לדגל featured הישן, כך שמה שהיה מוצמד ממשיך להופיע. */
export async function getPinnedIdsResolved(all: Gemach[]): Promise<string[]> {
    const stored = await getPinnedIds();
    if (!stored) return all.filter(g => g.featured).map(g => g.id);
    return normalize(all, stored);
}

/** הגמ"חים הנעוצים, בסדר שנקבע בפאנל */
export async function getPinnedGemachim(all: Gemach[]): Promise<Gemach[]> {
    const byId = indexGemachim(all);
    const ids = await getPinnedIdsResolved(all);
    return ids.map(id => byId.get(id)).filter((g): g is Gemach => !!g);
}

/** מסנכרן את דגל featured לפריט מנוהל. לא קריטי — כישלון לא מפיל את הפעולה. */
async function mirrorFeatured(g: Gemach | undefined, featured: boolean): Promise<void> {
    if (!g?.managed || !!g.featured === featured) return;
    try {
        await patchGemachOrder(g.id, { featured });
    } catch (e) {
        console.error('[national-gemach] mirrorFeatured failed:', e);
    }
}

/** טוען את המאגר המלא לפעולת כתיבה. רשימה ריקה = תקלה בשליפה —
 *  עוצרים, אחרת נירמול הרשימה היה מוחק את כל הנעוצים. */
async function loadForWrite(): Promise<Gemach[]> {
    const all = await getMergedGemachim();
    if (all.length === 0) throw new Error('רשימת הגמ"חים אינה זמינה כרגע');
    return all;
}

export async function pinGemach(id: string): Promise<void> {
    const all = await loadForWrite();
    const g = indexGemachim(all).get(id);
    if (!g) throw new Error('הגמ"ח לא נמצא');
    const ids = await getPinnedIdsResolved(all);
    if (!ids.includes(g.id)) {
        ids.push(g.id);
        await savePinnedIds(ids);
    }
    await mirrorFeatured(g, true);
}

export async function unpinGemach(id: string): Promise<void> {
    const all = await loadForWrite();
    const g = indexGemachim(all).get(id);
    const target = g?.id ?? id;
    const ids = await getPinnedIdsResolved(all);
    await savePinnedIds(ids.filter(x => x !== target));
    await mirrorFeatured(g, false);
}

export async function movePinned(id: string, dir: 'up' | 'down'): Promise<void> {
    const all = await loadForWrite();
    const target = indexGemachim(all).get(id)?.id ?? id;
    const ids = await getPinnedIdsResolved(all);
    const i = ids.indexOf(target);
    const j = dir === 'up' ? i - 1 : i + 1;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    await savePinnedIds(ids);
}
