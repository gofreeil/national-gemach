// טיוטה אוטומטית לטופס הגמ"ח — משותפת לארבעת המסלולים (הוספה ציבורית,
// עריכת בעלים, הוספת אדמין, עריכת אדמין) כדי שכולם יתנהגו אותו דבר.
// ראה $lib/formDraft למנוע האחסון עצמו.

import { onMount } from 'svelte';
import { clearDraft, loadDraft, resumeDraft } from '$lib/formDraft';
import { hasContent, parseGemachForm, type CreateGemachInput } from '$lib/gemachForm';

export function createGemachDraft(key: string, opts: { skip?: () => boolean } = {}) {
    let restored = $state<CreateGemachInput | null>(null);
    // שמירה מופעלת רק אחרי ניסיון השחזור — אחרת רינדור ראשון של טופס ריק
    // היה עלול לדרוס את הטיוטה השמורה לפני שהספקנו לקרוא אותה.
    let ready = $state(false);

    onMount(() => {
        if (!opts.skip?.()) {
            const draft = loadDraft<CreateGemachInput>(key);
            if (hasContent(draft)) restored = draft;
        }
        ready = true;
    });

    return {
        /** הערכים ששוחזרו, או null אם אין טיוטה */
        get restored() { return restored; },
        /** להעברה ל-`use:formDraft` על אלמנט ה-<form> */
        get options() {
            return {
                key,
                serialize: (fd: FormData) => parseGemachForm(fd).input,
                enabled: ready
            };
        },
        /** "התחל מטופס ריק" — מוחק את הטיוטה וממשיך לשמור מכאן */
        discard() {
            clearDraft(key);
            resumeDraft(key);
            restored = null;
        },
        /** נשמר בשרת — לקרוא לפני הניווט, ראה ההסבר ב-formDraft */
        saved() { clearDraft(key); }
    };
}
