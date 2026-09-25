// ============================================================
// hiddenStatic.ts — הסתרת גמ"ח מהרשימה הקבועה ($lib/staticGemachim) בלי קוד
//
// פריטי הרשימה הקבועה לא יושבים ב-DB, ולכן אין להם "טיוטה" או "מחיקה".
// האדמין מסתיר אותם מ-/admin/gemachim (בחיפוש), והמזהים נשמרים בהגדרות
// הכלליות (__ng_config). gemachSource מסנן אותם מכל האתר, כולל דף הפריט.
// ============================================================

import { getConfigValue, setConfigValue } from './adminStore';

const KEY = 'hidden_static_ids';

export async function getHiddenStaticIds(): Promise<Set<string>> {
    const raw = await getConfigValue<unknown>(KEY).catch(() => undefined);
    return new Set(Array.isArray(raw) ? raw.map(String) : []);
}

export async function setStaticHidden(id: string, hidden: boolean): Promise<void> {
    const ids = await getHiddenStaticIds();
    if (hidden) ids.add(id); else ids.delete(id);
    await setConfigValue(KEY, [...ids]);
}
