<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';

    let { data } = $props();

    let running = $state(false);
    let remaining = $state(data.remaining);
    let importedRun = $state(0);
    let failedRun = $state(0);
    let error = $state('');
    let formEl: HTMLFormElement;

    const doneAll = $derived(remaining <= 0);
    const totalDone = $derived(data.total - remaining);
    const pct = $derived(data.total ? Math.round((totalDone / data.total) * 100) : 100);

    function start() {
        error = '';
        importedRun = 0;
        failedRun = 0;
        running = true;
        formEl.requestSubmit();
    }
    function stop() {
        running = false;
    }
</script>

<svelte:head><title>ייבוא נתונים – פאנל ניהול</title></svelte:head>

<div class="max-w-2xl space-y-5">
    <h2 class="text-xl font-black text-white">📥 ייבוא הרשימה הסטטית ל-DB</h2>

    <div class="card p-5 space-y-3">
        <p class="text-sm text-gray-300 leading-relaxed">
            פעולה זו מעבירה את <b>{data.total}</b> הגמ"חים המיובאים (מהגיליון) אל מסד הנתונים המשותף,
            כדי שיהיו ניתנים לעריכה, סידור ומחיקה בפאנל. הייבוא מתבצע באצוות של {data.batchSize},
            <b>ניתן לעצירה והמשכה</b>, ולא יוצר כפילויות (מדלג על מה שכבר יובא).
        </p>
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-200">
            ⚠️ הפריטים נכתבים למאגר המשותף עם אתר "קהילה בשכונה" ויופיעו גם שם. מומלץ להריץ פעם אחת.
        </div>

        <!-- מד התקדמות -->
        <div>
            <div class="flex justify-between text-sm text-gray-400 mb-1">
                <span>{totalDone} / {data.total} יובאו</span>
                <span>{pct}%</span>
            </div>
            <div class="h-3 rounded-full bg-[#1c2f5a] overflow-hidden">
                <div class="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300" style="width: {pct}%"></div>
            </div>
        </div>

        {#if importedRun > 0 || failedRun > 0}
            <p class="text-sm text-gray-400">בריצה הנוכחית: <b class="text-emerald-300">{importedRun}</b> יובאו{#if failedRun > 0}, <b class="text-red-300">{failedRun}</b> נכשלו{/if}.</p>
        {/if}
        {#if error}
            <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{error}</div>
        {/if}

        <form
            bind:this={formEl}
            method="POST"
            action="?/batch"
            use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === 'failure') {
                        error = (result.data?.error as string) ?? 'הייבוא נכשל';
                        running = false;
                        return;
                    }
                    if (result.type === 'success' && result.data) {
                        const d = result.data as { imported: number; failed: number; remaining: number; done: boolean };
                        importedRun += d.imported;
                        failedRun += d.failed;
                        remaining = d.remaining;
                        // המשך אוטומטי כל עוד יש התקדמות
                        if (running && !d.done && d.imported > 0) {
                            formEl.requestSubmit();
                        } else {
                            running = false;
                            if (!d.done && d.imported === 0) error = 'הייבוא נעצר — אצווה ללא התקדמות. בדוק את חיבור השרת.';
                            await invalidateAll();
                        }
                    }
                };
            }}
        >
            {#if doneAll}
                <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-200 font-bold text-center">
                    ✅ הכל יובא! כל {data.total} הגמ"חים מנוהלים כעת ב-DB.
                </div>
            {:else if running}
                <button type="button" onclick={stop}
                    class="w-full rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 px-6 py-3 font-bold hover:bg-red-900/60 transition-colors">
                    ⏸️ עצור (נותרו {remaining})
                </button>
            {:else}
                <button type="button" onclick={start}
                    class="w-full rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-6 py-3 font-bold text-white transition hover:opacity-90">
                    {totalDone > 0 ? `▶️ המשך ייבוא (נותרו ${remaining})` : '▶️ התחל ייבוא'}
                </button>
            {/if}
        </form>
    </div>

    <a href="/admin/gemachim" class="inline-block text-sm text-gray-400 hover:text-white">→ למסך ניהול הגמ"חים</a>
</div>
