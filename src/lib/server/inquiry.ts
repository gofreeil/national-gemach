// ============================================================
// inquiry.ts — "שלחו הודעה לגמ"ח": פנייה של מבקר שמגיעה לבעלים ב-SMS
//
// רק גמ"ח שהבעלים בחר בזה (extra_fields.notify_inquiries — תיבה בטופס
// העריכה) ושיש בכרטיס שלו נייד. הנייד של הבעלים לא נחשף למבקר: ההודעה
// נשלחת מהשרת, והמבקר משאיר טלפון משלו כדי שיחזרו אליו.
//
// הגנות מהצפה: תקרה יומית לגמ"ח (נשמרת ב-Strapi, שורדת בין מופעי שרת),
// תקרה לשעה לכל כתובת IP (בזיכרון — חסם ראשון בלבד), ושדה-מלכודת לבוטים.
// ============================================================

import type { Gemach } from '$lib/gemachData';
import { sendSms, smsEnabled, toMobileE164 } from './sms';
import { takeInquirySlot } from './db';

const MAX_PER_GEMACH_DAY = 10;
const MAX_PER_IP_HOUR = 5;
export const MAX_INQUIRY_CHARS = 300;

const ipHits = new Map<string, number[]>();

function ipAllowed(ip: string): boolean {
    const now = Date.now();
    const recent = (ipHits.get(ip) ?? []).filter((t) => now - t < 3_600_000);
    if (recent.length >= MAX_PER_IP_HOUR) return false;
    recent.push(now);
    ipHits.set(ip, recent);
    return true;
}

/** הנייד שאליו יוצאות הפניות — הראשי, ואם הוא נייח אז הנוסף */
function ownerMobile(g: Gemach): string | null {
    return toMobileE164(g.phone ?? '') ?? toMobileE164(g.phone2 ?? '');
}

/** האם להציג בדף הגמ"ח את תיבת "שלחו הודעה" */
export function canInquire(g: Gemach): boolean {
    return !!g.managed && !!g.notifyInquiries && smsEnabled() && !!ownerMobile(g);
}

export async function sendInquiry(
    g: Gemach,
    v: { name: string; phone: string; message: string; trap: string; ip: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
    // בוט שמילא את השדה הנסתר — "מצליח" בשקט, בלי לשלוח
    if (v.trap) return { ok: true };
    if (!canInquire(g)) return { ok: false, error: 'הגמ"ח הזה לא מקבל הודעות דרך האתר' };

    const name = v.name.trim().slice(0, 40);
    const message = v.message.trim();
    const phone = v.phone.replace(/[^\d+]/g, '');
    if (!message) return { ok: false, error: 'כתבו את ההודעה' };
    if (message.length > MAX_INQUIRY_CHARS) return { ok: false, error: `ההודעה ארוכה מדי (עד ${MAX_INQUIRY_CHARS} תווים)` };
    if (!/^(\+?972|0)\d{8,9}$/.test(phone)) return { ok: false, error: 'השאירו מספר טלפון תקין כדי שיוכלו לחזור אליכם' };

    if (!ipAllowed(v.ip)) return { ok: false, error: 'שלחתם כמה הודעות ברצף — נסו שוב בעוד שעה' };
    if (!(await takeInquirySlot(g.id, MAX_PER_GEMACH_DAY)))
        return { ok: false, error: 'הגמ"ח קיבל היום הרבה הודעות — נסו מחר, או התקשרו' };

    const body =
        `הודעה חדשה לגמ"ח "${g.name}" מאתר הגמ"ח הארצי:\n` +
        `${message}\n` +
        `מאת: ${name ? `${name}, ` : ''}${phone}`;
    await sendSms(ownerMobile(g)!, body);
    return { ok: true };
}
