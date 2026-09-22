<script lang="ts">
    // ============================================================
    // GemachFormQuality.svelte — משוב חי על הכרטיס, בתוך טופס הגמ"ח
    // ------------------------------------------------------------
    // למה: כמעט כל שדות הטופס הם רשות, ולכן אפשר לשמור גמ"ח שברשימה מופיע
    // כשם בודד — בלי שהבעלים ידע. הפאנל הזה עונה תוך כדי מילוי על "איך
    // הכרטיס שלי ייראה", ובשמירה הוא עוצר פעם אחת כשהתיאור ריק.
    //
    // איך הוא מחובר לטופס בלי לגעת בשדות: הוא מוצא את ה-<form> העוטף
    // (closest) ומאזין ל-input/change שעולים ממנו. כך הוא עובד בשלושת
    // המסכים (הוספה, עריכת בעלים, פאנל אדמין) בלי לחווט ערכים לכל שדה —
    // וגם לא נופל במלכודת `value={}` ב-Svelte 5, שמוחקת הקלדה ברינדור מחדש.
    // ============================================================
    import { gemachQualityChecks, suggestNotesAsDescription, type GemachFormValues } from '$lib/gemachQuality';

    let host = $state<HTMLDivElement | null>(null);
    let values = $state<GemachFormValues>({});
    /** נעצרה שמירה אחת בגלל תיאור חסר — הלחיצה הבאה תעבור */
    let warned = $state(false);

    const checks = $derived(gemachQualityChecks(values));
    const missing = $derived(checks.filter((c) => !c.done));
    const missingMajor = $derived(missing.filter((c) => c.major));
    const descriptionMissing = $derived(!checks.find((c) => c.key === 'description')?.done);
    const notesText = $derived(suggestNotesAsDescription(values));

    // השדות היחידים שנקראים מהטופס — לא מושכים את כל ה-FormData לכל הקשה
    const FIELDS = ['description', 'image', 'images', 'phone', 'phone2', 'address', 'hours', 'contact', 'notes'];

    function readForm(form: HTMLFormElement): GemachFormValues {
        const fd = new FormData(form);
        const out: GemachFormValues = {};
        for (const k of FIELDS) {
            const v = fd.get(k);
            out[k] = typeof v === 'string' ? v : v ? 'x' : '';
        }
        return out;
    }

    function descriptionField(): HTMLTextAreaElement | null {
        return host?.closest('form')?.querySelector('textarea[name="description"]') ?? null;
    }

    /** כתיבה לשדה מבחוץ חייבת להודיע לטופס: בלי אירוע input הטיוטה
     *  האוטומטית (formDraft) לא תדע שהערך השתנה. */
    function setDescription(text: string) {
        const el = descriptionField();
        if (!el) return;
        el.value = text;
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.focus();
    }

    function focusDescription() {
        const el = descriptionField();
        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        el?.focus({ preventScroll: true });
    }

    $effect(() => {
        const form = host?.closest('form');
        if (!form) return;

        values = readForm(form);
        const onEdit = () => (values = readForm(form));

        // שער השמירה יושב על document בשלב ה-capture — ולא על הטופס עצמו.
        // הסיבה: ב"שלב היעד" כל המאזינים של אותו אלמנט רצים לפי סדר הרישום,
        // גם אלה שנרשמו כ-capture; מאזין על הטופס היה עלול לרוץ אחרי
        // ה-enhance של SvelteKit, שכבר שלח את הטופס. ה-capture על document
        // מקדים תמיד, ולכן stopImmediatePropagation באמת עוצר את השליחה.
        const onSubmit = (e: SubmitEvent) => {
            if (e.target !== form) return;
            values = readForm(form);
            if (!descriptionMissing || warned) return;   // אזהרה אחת בלבד — לא חומה
            e.preventDefault();
            e.stopImmediatePropagation();
            warned = true;
            host?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };

        form.addEventListener('input', onEdit);
        form.addEventListener('change', onEdit);
        document.addEventListener('submit', onSubmit, true);
        return () => {
            form.removeEventListener('input', onEdit);
            form.removeEventListener('change', onEdit);
            document.removeEventListener('submit', onSubmit, true);
        };
    });
</script>

<div bind:this={host} class="md:col-span-2 rounded-2xl border border-[#3b5794] bg-[#1c2f5a] p-4">
    <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
        <h3 class="text-sm font-black text-white">איך הכרטיס שלכם ייראה</h3>
        <span
            class="rounded-full px-2.5 py-0.5 text-xs font-bold {missing.length === 0
                ? 'bg-emerald-900/70 text-emerald-200'
                : 'bg-[#16264d] text-gray-300'}"
        >
            {checks.length - missing.length} מתוך {checks.length} פרטים מולאו
        </span>
    </div>

    {#if missing.length === 0}
        <p class="mt-2 text-sm font-semibold text-emerald-200">
            ✓ הכרטיס מלא — יש בו כל מה שאדם שמחפש גמ"ח צריך לדעת.
        </p>
    {:else}
        <!-- הגלולות הן המפה המהירה; ההסבר נפתח רק למה שבאמת פוגע בכרטיס -->
        <div class="mt-2.5 flex flex-wrap gap-1.5">
            {#each missing as c (c.key)}
                <span
                    class="rounded-full border px-2.5 py-0.5 text-xs font-bold {c.major
                        ? 'border-amber-400/40 bg-amber-950/60 text-amber-100'
                        : 'border-[#3b5794] bg-[#16264d] text-gray-300'}"
                >
                    חסר: {c.label}
                </span>
            {/each}
        </div>

        {#each missingMajor as c (c.key)}
            <p class="mt-2 text-xs leading-relaxed text-gray-200">
                <span class="font-bold text-amber-200">{c.label}</span> — {c.effect}
            </p>
        {/each}
    {/if}

    {#if notesText}
        <!-- המקרה הנפוץ: הטקסט שמתאר את הגמ"ח נכתב ב"הערות", והתיאור —
             השדה שהכרטיס באמת מציג — נשאר ריק. העברה בלחיצה אחת. -->
        <div class="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-blue-500/30 bg-[#16264d] px-3 py-2">
            <span class="text-xs text-gray-200">
                כתבתם בהערות „{notesText.length > 60 ? notesText.slice(0, 60) + '…' : notesText}” — זה מתאים בול לתיאור.
            </span>
            <button
                type="button"
                onclick={() => setDescription(notesText)}
                class="rounded-lg bg-blue-600 px-3 py-1 text-xs font-bold text-white transition hover:bg-blue-500"
            >
                העתיקו לתיאור
            </button>
        </div>
    {/if}

    {#if warned && descriptionMissing}
        <div class="mt-3 rounded-xl border border-amber-400/50 bg-amber-950/60 px-3 py-2.5">
            <p class="text-sm font-bold text-amber-100">רגע לפני השמירה — הכרטיס בלי תיאור</p>
            <p class="mt-1 text-xs leading-relaxed text-amber-50/90">
                ברשימות ובגוגל יופיע השם בלבד, בלי שורה אחת שמסבירה מה יש בגמ"ח.
                שתי שורות מספיקות. לחיצה נוספת על כפתור השמירה תשמור כך בכל זאת.
            </p>
            <button
                type="button"
                onclick={focusDescription}
                class="mt-2 rounded-lg bg-amber-500 px-3 py-1 text-xs font-black text-amber-950 transition hover:bg-amber-400"
            >
                מלאו תיאור עכשיו
            </button>
        </div>
    {/if}
</div>
