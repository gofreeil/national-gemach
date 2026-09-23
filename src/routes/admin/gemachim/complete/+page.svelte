<script lang="ts">
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { page as pageStore } from '$app/stores';
    import { tick, onMount } from 'svelte';

    let { data, form } = $props();

    // ---- "העבר לסוף הרשימה" — דחיית גמ"חים שאין מה לעשות איתם כרגע ----
    // נשמר ב-localStorage (ולא בשרת) כדי שהסדר ישרוד רענון ושמירות; הדחייה
    // אישית לדפדפן. הטעינה ב-onMount ולא באתחול — שלא תישבר ההידרציה.
    const DEFER_KEY = 'ng_complete_deferred';
    let deferred = $state<string[]>([]);
    onMount(() => {
        try {
            const v = JSON.parse(localStorage.getItem(DEFER_KEY) ?? '[]');
            if (Array.isArray(v)) deferred = v.filter((x) => typeof x === 'string');
        } catch { /* ערך פגום — מתעלמים */ }
    });
    function toggleDefer(id: string) {
        deferred = deferred.includes(id) ? deferred.filter((x) => x !== id) : [...deferred, id];
        localStorage.setItem(DEFER_KEY, JSON.stringify(deferred));
    }
    // הדחויים שוקעים לסוף העמוד הנוכחי; היתר שומרים על סדר השרת
    const orderedItems = $derived([
        ...data.items.filter((g) => !deferred.includes(g.id)),
        ...data.items.filter((g) => deferred.includes(g.id)),
    ]);

    // תוצאת פעולה בקריאה רופפת — נמנע מהצרה של איחוד סוגי ה-ActionData בתבנית.
    const f = $derived(form as { success?: boolean; id?: string; geocoded?: boolean; error?: string; job?: { geocoded: number; notFound: number; pendingGeocode: number; smsSent: number; smsFailed: number } } | null | undefined);
    const job = $derived(f?.job);
    let jobBusy = $state(false);

    const PRECISION_LABEL: Record<string, string> = {
        street: 'לפי רחוב',
        neighborhood: 'לפי שכונה',
        city: 'מרכז היישוב',
    };

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
        batchIds = queue.slice(0, 3).join(',');
        await tick(); // לוודא שערך ה-input הנסתר עודכן ב-DOM לפני השליחה
        geoForm.requestSubmit();
    }
    function stopGeocode() {
        running = false;
    }
</script>

<svelte:head><title>מיקום הגמ"חים במפה – פאנל ניהול</title></svelte:head>

<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-black text-white">🗺️ מיקום הגמ"חים במפה</h2>
        <a href="/admin/gemachim" class="text-sm text-gray-400 hover:text-white transition-colors">→ לניהול הגמ"חים</a>
    </div>

    <p class="text-sm text-gray-300 leading-relaxed">
        המערכת מציבה כל גמ"ח על המפה של <b>קהילה בשכונה</b> לבד, פעם ביום: מהבית המדויק ועד מרכז היישוב.
        יממה אחרי שגמ"ח הוצב במיקום משוער או לא אותר, נשלח SMS לנייד שבכרטיס עם קישור לאשר את המיקום או לדייק אותו במפה.
    </p>

    <!-- סיכום -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card p-4">
            <div class="text-2xl font-black text-emerald-400">{data.summary.exact}</div>
            <div class="text-xs text-gray-400 mt-1">על המפה, מיקום מדויק</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-sky-300">{data.summary.approx}</div>
            <div class="text-xs text-gray-400 mt-1">על המפה, מיקום משוער</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-amber-300">{data.summary.queued}</div>
            <div class="text-xs text-gray-400 mt-1">יוצבו בריצה הבאה</div>
        </div>
        <div class="card p-4">
            <div class="text-2xl font-black text-purple-300">{data.summary.owner}</div>
            <div class="text-xs text-gray-400 mt-1">ממתינים לסימון הבעלים</div>
        </div>
    </div>

    <!-- הריצה האוטומטית + בקשות לבעלים -->
    <div class="card p-4 flex flex-wrap items-center justify-between gap-3">
        <div class="text-xs text-gray-300 space-y-0.5">
            <div>
                ✉️ בקשות אישור/דיוק לבעלים:
                {#if !data.notify.sms}<b class="text-amber-300">אין ספק SMS מוגדר</b>
                {:else if data.notify.off}<b class="text-amber-300">כבויות</b>
                {:else}<b class="text-emerald-300">פעילות</b> (עד 25 ביום, פעם אחת לכל גמ"ח){/if}
            </div>
            {#if job}
                <div class="text-emerald-300">
                    הריצה הסתיימה: {job.geocoded} הוצבו{#if job.notFound}, {job.notFound} לא אותרו{/if}{#if job.pendingGeocode}, {job.pendingGeocode} ימשיכו בריצה הבאה{/if} · {job.smsSent} הודעות נשלחו{#if job.smsFailed}, {job.smsFailed} נכשלו{/if}
                </div>
            {/if}
        </div>
        <div class="flex flex-wrap gap-2">
            <form method="POST" action="?/notify" use:enhance>
                <input type="hidden" name="off" value={data.notify.off ? '0' : '1'} />
                <button class="rounded-lg border border-[#3b5794] bg-[#16264d] px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#243a6e]">
                    {data.notify.off ? '▶️ הפעל בקשות לבעלים' : '⏸️ כבה בקשות לבעלים'}
                </button>
            </form>
            <form method="POST" action="?/runJob" use:enhance={() => { jobBusy = true; return async ({ update }) => { await update(); jobBusy = false; }; }}>
                <button disabled={jobBusy} class="rounded-lg bg-[#1c2f5a] hover:bg-[#2a4379] px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50">
                    {jobBusy ? '⏳ רץ…' : '🔄 הרץ את הריצה היומית עכשיו'}
                </button>
            </form>
        </div>
    </div>

    <!-- הצבה מיידית לכל מי שעוד אין לו פין -->
    <div class="card p-4 space-y-3">
        <div class="flex flex-wrap items-center justify-between gap-3">
            <div>
                <h3 class="font-bold text-white">📍 הצב עכשיו את כל מי שעוד לא במפה</h3>
                <p class="text-xs text-gray-400 mt-0.5">
                    בלי לחכות לריצה היומית ({data.geocodableMissingIds.length} גמ"חים). רץ באצוות, ניתן לעצירה.
                </p>
            </div>
            {#if running}
                <button type="button" onclick={stopGeocode} class="rounded-xl bg-red-900/40 border border-red-500/30 text-red-200 px-5 py-2.5 text-sm font-bold hover:bg-red-900/60 transition-colors">⏸️ עצור</button>
            {:else}
                <button type="button" onclick={startGeocode} disabled={data.geocodableMissingIds.length === 0}
                    class="rounded-xl bg-gradient-to-r from-blue-600 to-emerald-600 px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed">
                    ▶️ הצב עכשיו
                </button>
            {/if}
        </div>
        {#if running || doneCount > 0}
            <div>
                <div class="flex justify-between text-xs text-gray-400 mb-1">
                    <span>{doneCount} / {totalToDo} עובדו · <b class="text-emerald-300">{okCount}</b> הוצבו{#if failCount > 0}, <b class="text-amber-300">{failCount}</b> יחכו לסימון הבעלים{/if}</span>
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
            {data.onlyMissing ? '✓ רק לא מדויקים' : 'רק לא מדויקים'}
        </a>
    </form>

    {#if data.items.length === 0}
        <div class="card p-10 text-center text-gray-400">
            <div class="text-4xl mb-3">🎉</div>
            <p class="font-bold">אין גמ"חים להצגה{data.onlyMissing ? ' — כולם במקום מדויק!' : ''}.</p>
        </div>
    {:else}
        <p class="text-xs text-gray-400">מציג {data.items.length} מתוך {data.total} · עמוד {data.page}/{data.pages}</p>

        <div class="space-y-2">
            {#each orderedItems as g (g.id)}
                {@const saved = f?.success && f?.id === g.id}
                <form method="POST" action="?/save" use:enhance
                    class="card p-3 md:p-4">
                    <input type="hidden" name="id" value={g.id} />
                    <div class="flex items-start gap-3">
                        <div class="text-2xl pt-1 flex-shrink-0" aria-hidden="true">{g.icon || catIcon(g.category)}</div>
                        <div class="flex-1 min-w-0 space-y-2">
                            <div class="flex items-center gap-2 flex-wrap">
                                <h3 class="font-bold text-white truncate">{g.name}</h3>
                                <span class="text-[11px] bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">{catLabel(g.category)}</span>
                                {#if g._state === 'exact'}
                                    <span class="text-[11px] bg-emerald-900/40 text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-500/20">✓ על המפה{g.geo?.ok ? ' · אושר ע"י הבעלים' : ''}</span>
                                {:else if g._state === 'approx'}
                                    <span class="text-[11px] bg-sky-900/40 text-sky-200 px-2 py-0.5 rounded-full border border-sky-500/20">📍 על המפה · {PRECISION_LABEL[g.geo?.p ?? 'city']}</span>
                                {:else if g._state === 'queued'}
                                    <span class="text-[11px] bg-amber-900/30 text-amber-200 px-2 py-0.5 rounded-full border border-amber-500/20">⏳ יוצב אוטומטית</span>
                                {:else}
                                    <span class="text-[11px] bg-purple-900/40 text-purple-200 px-2 py-0.5 rounded-full border border-purple-500/20">✉️ ממתין לסימון הבעלים</span>
                                {/if}
                                {#if g.geo?.asked && !g.geo?.ok}<span class="text-[11px] text-gray-400">בקשה נשלחה {new Date(g.geo.asked).toLocaleDateString('he-IL')}</span>{/if}
                                {#if saved && f?.geocoded}<span class="text-[11px] text-emerald-300 font-bold">✅ נשמר והוצב במפה</span>{/if}
                                {#if saved && !f?.geocoded}<span class="text-[11px] text-amber-300 font-bold">נשמר. הכתובת לא אותרה — אפשר לדקור במפה</span>{/if}
                                {#if f?.error && f?.id === g.id}<span class="text-[11px] text-red-300 font-bold">⚠️ {f.error}</span>{/if}
                            </div>

                            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="city-{g.id}">עיר <span class="text-red-400">*</span></label>
                                    <input id="city-{g.id}" name="city" defaultValue={g.city ?? ''} list="complete-cities"
                                        class="w-full rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="hood-{g.id}">שכונה</label>
                                    <input id="hood-{g.id}" name="neighborhood" defaultValue={g.neighborhood ?? ''}
                                        class="w-full rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                                <div>
                                    <label class="block text-[11px] text-gray-400 mb-0.5" for="addr-{g.id}">כתובת (רחוב ומספר)</label>
                                    <input id="addr-{g.id}" name="address" defaultValue={g.address ?? ''}
                                        class="w-full rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-sm text-white focus:border-purple-500 focus:outline-none" />
                                </div>
                            </div>

                            <div class="flex items-center justify-between gap-2 flex-wrap">
                                <span class="text-[11px] text-gray-400" dir="ltr">
                                    {#if g._ready}📍 {Number(g.lat).toFixed(5)}, {Number(g.lng).toFixed(5)}{:else}— עוד לא במפה —{/if}
                                </span>
                                <span class="flex flex-wrap items-center gap-2">
                                    <!-- type="button" — הכפתור יושב בתוך form השמירה ואסור שישלח אותו -->
                                    <button type="button" onclick={() => toggleDefer(g.id)}
                                        class="rounded-lg border border-[#3b5794] bg-[#16264d] px-3 py-1.5 text-xs font-bold text-gray-300 hover:bg-[#243a6e] hover:text-white transition-colors">
                                        {deferred.includes(g.id) ? '⬆️ החזר מהסוף' : '⬇️ העבר לסוף הרשימה'}
                                    </button>
                                    <a href={g._pinHref} target="_blank" rel="noopener"
                                        class="rounded-lg border border-[#3b5794] bg-[#16264d] px-3 py-1.5 text-xs font-bold text-gray-200 hover:bg-[#243a6e] hover:text-white transition-colors">
                                        🗺️ דקור במפה
                                    </a>
                                    <button class="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-1.5 text-xs font-bold text-white hover:opacity-90 transition-opacity">
                                        💾 שמור ואתר
                                    </button>
                                </span>
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
