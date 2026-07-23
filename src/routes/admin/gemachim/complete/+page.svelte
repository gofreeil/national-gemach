<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { page as pageStore } from '$app/stores';
    import { tick } from 'svelte';

    let { data, form } = $props();

    // תוצאת פעולה בקריאה רופפת — נמנע מהצרה של איחוד סוגי ה-ActionData בתבנית.
    const f = $derived(form as { success?: boolean; id?: string; geocoded?: boolean; error?: string } | null | undefined);

    function catLabel(key: string) {
        return data.categories.find(c => c.key === key)?.label ?? key;
    }
    function catIcon(key: string) {
        return data.categories.find(c => c.key === key)?.icon ?? '📦';
    }
    function pageHref(p: number) {
        const u = new URLSearchParams($pageStore.url.searchParams);
        u.set('page', String(p));
        return `?${u.toString()}`;
    }

    // ---- גזירת מיקום לכל החסרים (אצווה עם המשך אוטומטי) ----
    let queue = $state<string[]>([]);
    let running = $state(false);
    let okCount = $state(0);
    let failCount = $state(0);
    let totalToDo = $state(0);
    let batchIds = $state('');
    let geoForm: HTMLFormElement;

    const doneCount = $derived(totalToDo - queue.length);
    const pct = $derived(totalToDo ? Math.round((doneCount / totalToDo) * 100) : 0);

    function startGeocode() {
        queue = [...data.geocodableMissingIds];
        totalToDo = queue.length;
        okCount = 0;
        failCount = 0;
        running = true;
        submitNextChunk();
    }
    async function submitNextChunk() {
        if (!running) return;
        if (queue.length === 0) {
            running = false;
            invalidateAll();
            return;
        }
        batchIds = queue.slice(0, 8).join(',');
        await tick(); // לוודא שערך ה-input הנסתר עודכן ב-DOM לפני השליחה
        geoForm.requestSubmit();
    }
    function stopGeocode() {
        running = false;
    }
</script>

<svelte:head><title>השלמת פרטי מיקום – פאנל ניהול</title></svelte:head>

<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-black text-white">🗺️ השלמת פרטים למפה</h2>
        <a href="/admin/gemachim" class="text-sm text-gray-400 hover:text-white transition-colors">→ לניהול הגמ"חים</a>
    </div>

    <p class="text-sm text-gray-300 leading-relaxed">
        כדי שגמ"ח יופיע על המפה של <b>קהילה בשכונה</b> וייספר במונה "פרטים במפה", דרושה לו
        <b>כתובת/עיר</b> שממנה נגזרות קואורדינטות. מלא כאן את הפרטים החסרים — הקואורדינטות
        נגזרות אוטומטית בכל שמירה.
    </p>

    <!-- סיכום מוכנוּת -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card p-4">
            <div class="text-2xl font-black text-white">{data.summary.managed}</div>
            <div class="text-xs text-gray-400 mt-1">גמ"חים ב-DB</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-emerald-400">{data.summary.ready}</div>
            <div class="text-xs text-gray-400 mt-1">מוכנים למפה (עם מיקום)</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-amber-400">{data.summary.missingCoords}</div>
            <div class="text-xs text-gray-400 mt-1">חסרי קואורדינטות</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-red-400">{data.summary.missingLocation}</div>
            <div class="text-xs text-gray-400 mt-1">בלי כתובת/שכונה</div>
        </div>
    </div>

    <!-- גזירת מיקום אוטומטית לכל החסרים -->
    <div class="card p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h3 class="font-bold text-white">📍 גזירת מיקום לכל החסרים</h3>
                <p class="text-xs text-gray-400 mt-0.5">
                    גוזר קואורדינטות מהכתובת/עיר לכל גמ"ח שיש לו עיר וחסר מיקום ({data.geocodableMissingIds.length} מועמדים).
                    רץ באצוות, ניתן לעצירה.
                </p>
            </div>
            {#if running}
                <button type="button" onclick={stopGeocode} class="rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 px-5 py-2.5 text-sm font-bold hover:bg-red-900/60 transition-colors">⏸️ עצור</button>
            {:else}
                <button type="button" onclick={startGeocode} disabled={data.geocodableMissingIds.length === 0}
                    class="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                    ▶️ גזור מיקום לכל החסרים
                </button>
            {/if}
        </div>
        {#if running || doneCount > 0}
            <div>
                <div class="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{doneCount} / {totalToDo} עובדו · <b class="text-emerald-300">{okCount}</b> נגזרו{#if failCount > 0}, <b class="text-red-300">{failCount}</b> ללא תוצאה{/if}</span>
                    <span>{pct}%</span>
                </div>
                <div class="h-2.5 rounded-full bg-[#1c2f5a] overflow-hidden">
                    <div class="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300" style="width: {pct}%"></div>
                </div>
            </div>
        {/if}
        <!-- טופס נסתר שהאצווה משתמשת בו -->
        <form
            bind:this={geoForm}
            method="POST"
            action="?/geocodeBatch"
            class="hidden"
            use:enhance={() => {
                return async ({ result }) => {
                    if (result.type === 'success' && result.data) {
                        const d = result.data as { done: number; failed: number; processed: string[] };
                        okCount += d.done;
                        failCount += d.failed;
                        const seen = new Set(d.processed);
                        queue = queue.filter(id => !seen.has(id));
                        if (running && queue.length > 0) submitNextChunk();
                        else { running = false; await invalidateAll(); }
                    } else {
                        running = false;
                    }
                };
            }}
        >
            <input type="hidden" name="ids" value={batchIds} />
        </form>
    </div>

    <!-- חיפוש + סינון -->
    <form method="GET" class="flex flex-wrap gap-2">
        <input name="q" value={data.q} placeholder="חיפוש לפי שם, עיר, שכונה או כתובת..."
            class="flex-1 min-w-[200px] rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
        {#if data.onlyMissing}<input type="hidden" name="missing" value="1" />{/if}
        <button class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-2.5 text-sm font-bold text-white transition-colors">חפש</button>
        <a href={data.onlyMissing ? `/admin/gemachim/complete${data.q ? `?q=${encodeURIComponent(data.q)}` : ''}` : `/admin/gemachim/complete?missing=1${data.q ? `&q=${encodeURIComponent(data.q)}` : ''}`}
            class="rounded-xl px-4 py-2.5 text-sm font-bold transition-colors {data.onlyMissing ? 'bg-amber-600 text-white' : 'bg-[#16264d] text-gray-300 hover:bg-[#243a6e]'}">
            {data.onlyMissing ? '✓ רק חסרים' : 'רק חסרים'}
        </a>
    </form>

    {#if data.items.length === 0}
        <div class="card p-10 text-center text-gray-400">
            <div class="text-4xl mb-3">🎉</div>
            <p class="font-bold">אין גמ"חים להצגה{data.onlyMissing ? ' — הכל מושלם!' : ''}.</p>
        </div>
    {:else}
        <p class="text-xs text-gray-500">מציג {data.items.length} מתוך {data.total} · עמוד {data.page}/{data.pages}</p>

        <div class="space-y-2">
            {#each data.items as g (g.id)}
                {@const saved = f?.success && f?.id === g.id}
                <form method="POST" action="?/save" use:enhance
                    class="card p-3 md:p-4 {g._ready ? '' : 'border-amber-500/25'}">
                    <input type="hidden" name="id" value={g.id} />
                    <div class="flex items-start gap-3">
                        <div class="text-2xl pt-1 flex-shrink-0" aria-hidden="true">{g.icon || catIcon(g.category)}</div>
                        <div class="flex-1 min-w-0 space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-bold text-white truncate">{g.name}</h3>
                                <span class="text-[11px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">{catLabel(g.category)}</span>
                                {#if g._ready}
                                    <span class="text-[11px] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">✓ על המפה</span>
                                {:else}
                                    <span class="text-[11px] bg-red-900/40 text-red-300 px-2 py-0.5 rounded-full border border-red-500/20">✗ חסר מיקום</span>
                                {/if}
                                {#if saved && f?.geocoded}<span class="text-[11px] text-emerald-300 font-bold">✅ נשמר + מיקום נגזר</span>{/if}
                                {#if saved && !f?.geocoded}<span class="text-[11px] text-amber-300 font-bold">⚠️ נשמר, אך המיקום לא נגזר — ייתכן שהקואורדינטות הישנות נותרו; בדוק כתובת/עיר ושמור שוב</span>{/if}
                                {#if f?.error && f?.id === g.id}<span class="text-[11px] text-red-300 font-bold">⚠️ {f.error}</span>{/if}
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="city-{g.id}">עיר <span class="text-red-400">*</span></label>
                                    <input id="city-{g.id}" name="city" value={g.city ?? ''} list="complete-cities"
                                        class="w-full rounded-lg border {g.city ? 'border-[#3b5794]' : 'border-red-500/50'} bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="hood-{g.id}">שכונה</label>
                                    <input id="hood-{g.id}" name="neighborhood" value={g.neighborhood ?? ''}
                                        class="w-full rounded-lg border {(!g.address && !g.neighborhood) ? 'border-amber-500/50' : 'border-[#3b5794]'} bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="addr-{g.id}">כתובת (רחוב ומספר)</label>
                                    <input id="addr-{g.id}" name="address" value={g.address ?? ''}
                                        class="w-full rounded-lg border {(!g.address && !g.neighborhood) ? 'border-amber-500/50' : 'border-[#3b5794]'} bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                            </div>

                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                <span class="text-[11px] text-gray-500" dir="ltr">
                                    {#if g._ready}📍 {Number(g.lat).toFixed(5)}, {Number(g.lng).toFixed(5)}{:else}— ללא קואורדינטות —{/if}
                                </span>
                                <button class="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity">
                                    💾 שמור וגזור מיקום
                                </button>
                            </div>
                        </div>
                    </div>
                </form>
            {/each}
        </div>

        <datalist id="complete-cities">
            {#each data.cities as c (c)}<option value={c}></option>{/each}
        </datalist>

        <!-- עימוד -->
        {#if data.pages > 1}
            <div class="flex items-center justify-center gap-2 pt-2">
                {#if data.page > 1}<a href={pageHref(data.page - 1)} class="rounded-lg bg-[#16264d] hover:bg-[#243a6e] px-3 py-1.5 text-sm text-white">→ הקודם</a>{/if}
                <span class="text-sm text-gray-400">עמוד {data.page} מתוך {data.pages}</span>
                {#if data.page < data.pages}<a href={pageHref(data.page + 1)} class="rounded-lg bg-[#16264d] hover:bg-[#243a6e] px-3 py-1.5 text-sm text-white">הבא ←</a>{/if}
            </div>
        {/if}
    {/if}
</div>
