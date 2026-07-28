<script lang="ts">
    // עורך שעות פעילות — מקור: "קהילה בשכונה" (הטופס שם כבר מסודר), מותאם
    // לפלטת הנייבי של האתר הזה. הערך נשלח בטופס כ-JSON בשדה `name` (hours),
    // אותו פורמט שנשמר ב-extra_fields.hours ומשותף לשני האתרים.
    import {
        closedOpeningHours,
        parseOpeningHours,
        serializeOpeningHours,
        nextRangeAfter,
        hasOpenDays,
        DAY_SHORT,
        DAY_LONG,
        type OpeningHours,
    } from '$lib/openingHours';

    let { value = '', name = 'hours' }: { value?: string; name?: string } = $props();

    const parsed = parseOpeningHours(value);
    // טקסט חופשי מרשומה ישנה ("א-ה 9:00-13:00") — נשמר כמות שהוא כל עוד
    // המשתמש לא בחר לעבור ללוח המובנה, כדי שעריכה של שדה אחר לא תמחק אותו.
    let legacyText = $state(parsed ? '' : (value ?? '').trim());
    let oh = $state<OpeningHours>(parsed ?? closedOpeningHours());

    // לוח שכל ימיו סגורים נשלח כשדה ריק — שעות פעילות הן רשות, וגמ"ח שאיש
    // לא נגע בשעות שלו לא צריך להיוולד עם לוח שהמערכת המציאה.
    const serialized = $derived(
        legacyText ? legacyText : hasOpenDays(oh) ? serializeOpeningHours(oh) : ''
    );

    const openDayCount = $derived(oh.days.filter((d) => d.open).length);
    const anyOpen = $derived(openDayCount > 0);
    /** היום המייצג במצב "אותן שעות בכל הימים" */
    const rep = $derived(oh.days.find((d) => d.open) ?? oh.days[0]);

    function toggleDay(idx: number) {
        oh.days[idx].open = !oh.days[idx].open;
        // נפתח יום חדש במצב "שעות זהות" — מיישרים אותו לשעות הקיימות
        if (oh.days[idx].open && oh.uniform) {
            const src = oh.days.find((d, i) => i !== idx && d.open);
            if (src) oh.days[idx].ranges = src.ranges.map((r) => ({ ...r }));
        }
    }

    function setUniform(uniform: boolean) {
        oh.uniform = uniform;
        // מעבר ל"שעות זהות" — מחיל את שעות היום הפתוח הראשון על כל הימים
        if (uniform) {
            const first = oh.days.find((d) => d.open) ?? oh.days[0];
            const ranges = first.ranges.map((r) => ({ ...r }));
            for (const d of oh.days) d.ranges = ranges.map((r) => ({ ...r }));
        }
    }

    function setUniformTime(rIdx: number, which: 'from' | 'to', val: string) {
        for (const d of oh.days) if (d.ranges[rIdx]) d.ranges[rIdx][which] = val;
    }

    function addUniformRange() {
        const next = nextRangeAfter(rep.ranges[rep.ranges.length - 1]);
        for (const d of oh.days) d.ranges.push({ ...next });
    }

    function removeUniformRange(rIdx: number) {
        for (const d of oh.days) if (d.ranges.length > 1) d.ranges.splice(rIdx, 1);
    }

    function setDayTime(idx: number, rIdx: number, which: 'from' | 'to', val: string) {
        const r = oh.days[idx].ranges[rIdx];
        if (r) r[which] = val;
    }

    function addDayRange(idx: number) {
        const ranges = oh.days[idx].ranges;
        ranges.push(nextRangeAfter(ranges[ranges.length - 1]));
    }

    function removeDayRange(idx: number, rIdx: number) {
        if (oh.days[idx].ranges.length > 1) oh.days[idx].ranges.splice(rIdx, 1);
    }

    /** מעתיק את שעות היום הנבחר לכל שאר הימים הפתוחים — מילוי יום אחד מספיק */
    function applyDayToAll(idx: number) {
        const src = oh.days[idx].ranges.map((r) => ({ ...r }));
        oh.days.forEach((d, i) => {
            if (i === idx || !d.open) return;
            d.ranges = src.map((r) => ({ ...r }));
        });
    }

    const timeInput =
        'rounded-lg border border-[#3b5794] bg-[#101d3d] px-2.5 py-2 text-white text-sm text-center focus:border-purple-500 focus:outline-none';
</script>

<input type="hidden" {name} value={serialized} />

{#if legacyText}
    <!-- רשומה ישנה עם טקסט חופשי: לא דורסים אותה בלי שהמשתמש ביקש -->
    <div class="rounded-xl border border-[#3b5794] bg-[#1e293b] p-3 space-y-2">
        <input
            bind:value={legacyText}
            aria-label="שעות פעילות"
            class="w-full rounded-xl border border-[#3b5794] bg-[#101d3d] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
            placeholder="א-ה 9:00-13:00"
        />
        <button
            type="button"
            onclick={() => (legacyText = '')}
            class="text-xs font-bold text-blue-300 underline underline-offset-2 transition-colors hover:text-blue-200"
        >
            🗓️ מעבר ללוח שעות מסודר (ימים ושעות)
        </button>
    </div>
{:else}
    <div class="rounded-xl border border-[#3b5794] bg-[#1e293b] p-3 md:p-4 space-y-3">
        <!-- בחירת ימים פתוחים -->
        <p class="text-xs text-gray-400">
            אילו ימים הגמ"ח פתוח?
            <span class="text-gray-500">לחצו על יום כדי לפתוח או לסגור אותו — גם ו׳ ושבת</span>
        </p>
        <div class="grid grid-cols-7 gap-1.5">
            {#each DAY_SHORT as d, dIdx (dIdx)}
                {@const isOpen = oh.days[dIdx].open}
                <button
                    type="button"
                    onclick={() => toggleDay(dIdx)}
                    class="h-9 rounded-lg border-2 text-xs font-bold transition-all {isOpen
                        ? 'border-transparent bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-md'
                        : 'border-dashed border-[#4c6cb0] bg-[#101d3d] text-gray-400 hover:border-[#6b8ad6] hover:bg-[#243a6e] hover:text-white'}"
                    aria-pressed={isOpen}
                    title="{DAY_LONG[dIdx]} {isOpen ? 'פתוח — לחיצה תסגור' : 'סגור — לחיצה תפתח'}"
                >{d}</button>
            {/each}
        </div>

        {#if anyOpen}
            <!-- מתג: שעות זהות לכל הימים / שעה לכל יום -->
            <div class="mx-auto flex w-full max-w-[320px] gap-1 rounded-full border border-[#3b5794] bg-[#101d3d] p-1">
                <button
                    type="button"
                    onclick={() => setUniform(true)}
                    class="flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all {oh.uniform
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'}"
                >אותן שעות בכל הימים</button>
                <button
                    type="button"
                    onclick={() => setUniform(false)}
                    class="flex-1 rounded-full px-3 py-1.5 text-xs font-bold transition-all {!oh.uniform
                        ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow'
                        : 'text-gray-400 hover:text-white'}"
                >שעות שונות לפי יום</button>
            </div>

            {#if oh.uniform}
                <!-- טווחי שעות משותפים לכל הימים הפתוחים -->
                <div class="space-y-2">
                    {#each rep.ranges as r, rIdx (rIdx)}
                        <div class="flex items-center justify-center gap-2">
                            <div class="flex items-center gap-2" dir="ltr">
                                <input
                                    type="time"
                                    value={r.from}
                                    onchange={(e) => setUniformTime(rIdx, 'from', e.currentTarget.value)}
                                    class={timeInput}
                                    style="color-scheme: dark;"
                                    aria-label="שעת פתיחה — טווח {rIdx + 1}"
                                />
                                <span class="font-bold text-gray-400">–</span>
                                <input
                                    type="time"
                                    value={r.to}
                                    onchange={(e) => setUniformTime(rIdx, 'to', e.currentTarget.value)}
                                    class={timeInput}
                                    style="color-scheme: dark;"
                                    aria-label="שעת סגירה — טווח {rIdx + 1}"
                                />
                            </div>
                            {#if rep.ranges.length > 1}
                                <button
                                    type="button"
                                    onclick={() => removeUniformRange(rIdx)}
                                    class="h-7 w-7 shrink-0 rounded-full border border-[#3b5794] text-sm leading-none text-gray-500 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
                                    aria-label="הסרת טווח {rIdx + 1}"
                                    title="הסרת טווח שעות"
                                >✕</button>
                            {/if}
                        </div>
                    {/each}
                    <div class="flex justify-center">
                        <button
                            type="button"
                            onclick={addUniformRange}
                            class="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[#4c6cb0] px-3 py-1.5 text-xs font-bold text-gray-300 transition-colors hover:border-[#6b8ad6] hover:bg-[#243a6e] hover:text-white"
                        ><span class="text-base leading-none">＋</span> הוספת טווח שעות</button>
                    </div>
                    <p class="text-center text-[11px] leading-relaxed text-gray-500">
                        סגורים בצהריים? לחצו על ＋ והוסיפו טווח נוסף — למשל 9:00–13:00 וגם 16:00–19:00
                    </p>
                </div>
            {:else}
                <!-- טווחי שעות נפרדים לכל יום פתוח -->
                <div class="divide-y divide-[#3b5794]">
                    {#each DAY_SHORT as d, dIdx (dIdx)}
                        {#if oh.days[dIdx].open}
                            <div class="flex gap-2 py-2 md:justify-center md:gap-3">
                                <div class="flex w-12 shrink-0 flex-col items-start gap-0.5 pt-2">
                                    <span class="text-sm font-bold text-gray-200">{d}</span>
                                    {#if openDayCount > 1}
                                        <button
                                            type="button"
                                            onclick={() => applyDayToAll(dIdx)}
                                            class="whitespace-nowrap text-[10px] font-bold text-gray-500 underline underline-offset-2 transition-colors hover:text-purple-300"
                                            title="החלת השעות של יום {DAY_LONG[dIdx]} על כל הימים הפתוחים"
                                        >⧉ לכולם</button>
                                    {/if}
                                </div>
                                <div class="flex min-w-0 flex-1 flex-col gap-1.5 md:flex-none">
                                    {#each oh.days[dIdx].ranges as r, rIdx (rIdx)}
                                        <div class="flex items-center gap-1.5">
                                            <div class="flex min-w-0 flex-1 items-center gap-1.5 md:flex-none" dir="ltr">
                                                <input
                                                    type="time"
                                                    value={r.from}
                                                    onchange={(e) => setDayTime(dIdx, rIdx, 'from', e.currentTarget.value)}
                                                    class="{timeInput} min-w-0 flex-1 md:w-28 md:flex-none"
                                                    style="color-scheme: dark;"
                                                    aria-label="שעת פתיחה {DAY_LONG[dIdx]} — טווח {rIdx + 1}"
                                                />
                                                <span class="shrink-0 font-bold text-gray-400">–</span>
                                                <input
                                                    type="time"
                                                    value={r.to}
                                                    onchange={(e) => setDayTime(dIdx, rIdx, 'to', e.currentTarget.value)}
                                                    class="{timeInput} min-w-0 flex-1 md:w-28 md:flex-none"
                                                    style="color-scheme: dark;"
                                                    aria-label="שעת סגירה {DAY_LONG[dIdx]} — טווח {rIdx + 1}"
                                                />
                                            </div>
                                            {#if rIdx === oh.days[dIdx].ranges.length - 1}
                                                <button
                                                    type="button"
                                                    onclick={() => addDayRange(dIdx)}
                                                    class="h-7 w-7 shrink-0 rounded-full border border-dashed border-[#4c6cb0] text-base leading-none text-gray-300 transition-colors hover:border-[#6b8ad6] hover:bg-[#243a6e] hover:text-white"
                                                    aria-label="הוספת טווח שעות ליום {DAY_LONG[dIdx]}"
                                                    title="הוספת טווח שעות ליום זה"
                                                >＋</button>
                                            {:else}
                                                <span class="w-7 shrink-0"></span>
                                            {/if}
                                            {#if oh.days[dIdx].ranges.length > 1}
                                                <button
                                                    type="button"
                                                    onclick={() => removeDayRange(dIdx, rIdx)}
                                                    class="h-7 w-7 shrink-0 rounded-full border border-[#3b5794] text-sm leading-none text-gray-500 transition-colors hover:border-red-400/50 hover:bg-red-500/10 hover:text-red-300"
                                                    aria-label="הסרת טווח {rIdx + 1} ביום {DAY_LONG[dIdx]}"
                                                    title="הסרת טווח שעות"
                                                >✕</button>
                                            {:else}
                                                <span class="w-7 shrink-0"></span>
                                            {/if}
                                        </div>
                                    {/each}
                                </div>
                            </div>
                        {/if}
                    {/each}
                </div>
                <p class="text-center text-[11px] leading-relaxed text-gray-500">
                    מלאו את השעות של יום אחד ולחצו "⧉ לכולם" כדי להעתיק אותן לכל הימים בבת אחת ·
                    לחיצה על ＋ ליד יום מוסיפה לו טווח שעות נוסף — למשל פתוח בבוקר וגם בערב
                </p>
            {/if}
        {:else}
            <p class="py-1 text-center text-xs text-gray-500">לא נבחרו ימים — הגמ"ח יוצג ללא שעות פעילות</p>
        {/if}
    </div>
{/if}
