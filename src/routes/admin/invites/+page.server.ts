import { fail } from '@sveltejs/kit';
import type { Actions, PageServerLoad } from './$types';
import { getAdminContext } from '$lib/server/admin';
import { sendSms, smsEnabled, toMobileE164 } from '$lib/server/sms';
import {
    DEFAULT_TEMPLATE, MAX_SMS_CHARS, PLACEHOLDERS,
    getInviteLog, getInviteTemplate, inviteLinks, inviteTarget, listInviteCandidates,
    recordInviteSent, renderInvite, setInviteTemplate, undoInviteDeclined,
} from '$lib/server/claimInvite';
import { getAllGemachimWithDrafts, setGemachStatus } from '$lib/server/db';

// הזמנות SMS לבעלי גמ"חים לקבל בעלות על הכרטיס — פתוח לכל אדמין.
// השליחה ההמונית רצה מהדפדפן, גמ"ח אחרי גמ"ח (action לכל אחד), כדי לא
// לחרוג מזמן הריצה של פונקציה ולא לדרוס את היומן בכתיבות מקבילות.
export const load: PageServerLoad = async ({ locals, url }) => {
    await getAdminContext(locals);
    let backendUnavailable = false;
    let data: Awaited<ReturnType<typeof listInviteCandidates>> = { candidates: [], owned: 0, noMobile: 0, ownedRows: [] };
    try {
        data = await listInviteCandidates();
    } catch (e) {
        console.error('admin/invites load failed:', e);
        backendUnavailable = true;
    }
    const [template, log] = await Promise.all([getInviteTemplate(), getInviteLog()]);
    // מעקב: גמ"חים שקיבלו הזמנה ויש להם עכשיו בעלים (גם מי שנרשם לפני שהמעקב נוסף)
    const { ownedRows, ...rest } = data;
    const claimedRows = ownedRows.filter((r) => log[r.id]?.at || log[r.id]?.claimedAt);
    // מצב באתר של כל גמ"ח ביומן — כדי שהמעקב יציג שם גם לגמ"ח שהורד (טיוטה)
    // ויאפשר להוריד/להחזיר בלחיצה. חסר = נמחק.
    const siteState: Record<string, { name: string; draft: boolean }> = {};
    try {
        const all = await getAllGemachimWithDrafts();
        for (const g of all) if (log[g.id]) siteState[g.id] = { name: g.name, draft: g.status === 'draft' };
    } catch (e) {
        console.error('admin/invites siteState failed:', e);
    }
    return {
        ...rest,
        claimedRows,
        siteState,
        log,
        template,
        defaultTemplate: DEFAULT_TEMPLATE,
        placeholders: PLACEHOLDERS,
        maxChars: MAX_SMS_CHARS,
        origin: url.origin,
        smsReady: smsEnabled(),
        backendUnavailable,
    };
};

export const actions: Actions = {
    // הסירוב נרשם בטעות — מחזירים את הגמ"ח לרשימה הרגילה
    undoDecline: async ({ request, locals }) => {
        await getAdminContext(locals);
        const id = String((await request.formData()).get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה' });
        try {
            await undoInviteDeclined(id);
            return { message: 'הסירוב בוטל' };
        } catch (e) {
            console.error('invite undoDecline failed:', e);
            return fail(502, { error: 'העדכון נכשל — נסו שוב' });
        }
    },

    // הורדה מהאתר (טיוטה) / החזרה — למשל למי שדחה את ההזמנה וביקש הסרה
    siteStatus: async ({ request, locals }) => {
        await getAdminContext(locals);
        const fd = await request.formData();
        const id = String(fd.get('id') ?? '');
        if (!id) return fail(400, { error: 'חסר מזהה' });
        try {
            await setGemachStatus(id, fd.get('publish') === '1' ? 'active' : 'draft');
            return { message: fd.get('publish') === '1' ? 'הגמ"ח חזר לאתר' : 'הגמ"ח הורד מהאתר' };
        } catch (e) {
            console.error('invite siteStatus failed:', e);
            return fail(502, { error: 'העדכון נכשל — נסו שוב' });
        }
    },

    template: async ({ request, locals }) => {
        await getAdminContext(locals);
        const text = String((await request.formData()).get('template') ?? '');
        try {
            const r = await setInviteTemplate(text);
            if (!r.ok) return fail(400, { error: r.error });
            return { message: text.trim() ? 'הנוסח נשמר ✅' : 'חזרנו לנוסח ברירת המחדל' };
        } catch (e) {
            console.error('invite template save failed:', e);
            return fail(502, { error: 'שמירת הנוסח נכשלה — נסו שוב' });
        }
    },

    // שליחה לגמ"ח אחד. force=1 מאשר שליחה חוזרת למי שכבר קיבל.
    send: async ({ request, locals, url }) => {
        const { user } = await getAdminContext(locals);
        if (!smsEnabled()) return fail(503, { error: 'שליחת SMS אינה מוגדרת בשרת' });
        const fd = await request.formData();
        const id = String(fd.get('id') ?? '');
        const force = fd.get('force') === '1';
        const target = await inviteTarget(id).catch(() => null);
        if (!target) return fail(400, { id, error: 'הגמ"ח כבר לא זכאי (יש לו בעלים / אין נייד / לא פעיל)' });

        const log = await getInviteLog();
        if (log[id]?.declinedAt) return fail(409, { id, error: 'ביקשו לא לקבל הודעות' });
        if (log[id]?.at && !force) return fail(409, { id, error: 'כבר נשלח — אשרו שליחה חוזרת' });

        const template = String(fd.get('template') ?? '').trim() || (await getInviteTemplate());
        const message = renderInvite(template, {
            name: target.contact ?? '',
            gemach: target.label ?? '',
            ...inviteLinks(url.origin, id),
        });
        try {
            await sendSms(target.e164, message);
        } catch (e) {
            console.error('[claim-invite] send failed:', e);
            return fail(502, { id, error: 'השליחה נכשלה — נסו שוב' });
        }
        await recordInviteSent(id, user.email ?? user.name ?? '');
        return { id, sent: true };
    },

    // שליחת בדיקה למספר של האדמין — עם הקישורים של גמ"ח לדוגמה, בלי יומן
    test: async ({ request, locals, url }) => {
        await getAdminContext(locals);
        if (!smsEnabled()) return fail(503, { error: 'שליחת SMS אינה מוגדרת בשרת' });
        const fd = await request.formData();
        const e164 = toMobileE164(String(fd.get('phone') ?? ''));
        if (!e164) return fail(400, { error: 'מספר נייד לא תקין' });
        const id = String(fd.get('id') ?? '');
        const target = await inviteTarget(id).catch(() => null);
        const template = String(fd.get('template') ?? '').trim() || (await getInviteTemplate());
        const message = renderInvite(template, {
            name: target?.contact ?? '',
            gemach: target?.label ?? 'גמ"ח לדוגמה',
            ...inviteLinks(url.origin, target ? id : 'example'),
        });
        try {
            await sendSms(e164, message);
            return { message: 'הודעת בדיקה נשלחה 📲' };
        } catch (e) {
            console.error('[claim-invite] test failed:', e);
            return fail(502, { error: 'שליחת הבדיקה נכשלה' });
        }
    },
};
