// ============================================================
// adIntent.ts — לשם מה נכנסו לסטודיו הפרסומות
// ------------------------------------------------------------
//  'edit' - עריכה של המודעה הקיימת. השליחה מחליפה את מה שרץ על האתר.
//  'new'  - רכישת מודעה *נוספת* (הגעה מדף המחירים). השליחה לא נוגעת
//           במודעה הקיימת ושתיהן רצות במקביל.
//
// בלי ההבחנה הזו השרת זיהה "מפרסם חוזר" לפי זהות בלבד, וכל רכישה שנייה
// הרגה את הראשונה - גם כשהמפרסם שילם בכוונה על שתיים.
// ============================================================

export const AD_INTENT_KEY = 'ad_builder_intent_v1';
export type AdIntent = 'edit' | 'new';

export function setAdIntent(intent: AdIntent): void {
    try { localStorage.setItem(AD_INTENT_KEY, intent); } catch { /* ignore */ }
}

/** ברירת המחדל היא 'edit' - ההתנהגות שהייתה לפני שהדגל הזה נוסף */
export function getAdIntent(): AdIntent {
    try { return localStorage.getItem(AD_INTENT_KEY) === 'new' ? 'new' : 'edit'; } catch { return 'edit'; }
}

export function clearAdIntent(): void {
    try { localStorage.removeItem(AD_INTENT_KEY); } catch { /* ignore */ }
}
