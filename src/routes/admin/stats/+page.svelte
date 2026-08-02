<script lang="ts">
    let { data } = $props();

    // GA מחזיר ישן→חדש; מציגים חדש→ישן
    const months = $derived([...(data.months ?? [])].reverse());
    const maxVisitors = $derived(Math.max(1, ...months.map((m) => m.visitors)));

    const fmt = new Intl.NumberFormat('he-IL');
    const now = new Date();
    const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    /** "202608" → "אוגוסט 2026" */
    function monthLabel(ym: string): string {
        const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
        return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d);
    }

    function updatedAgo(ts: number): string {
        const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
        if (mins < 1) return 'עכשיו';
        if (mins < 60) return `לפני ${mins} דק׳`;
        return `לפני ${Math.round(mins / 60)} שע׳`;
    }
</script>

<svelte:head><title>סטטיסטיקת גולשים – פאנל ניהול</title></svelte:head>

<div class="space-y-5">
    <h2 class="text-xl font-black text-white">📈 סטטיסטיקת גולשים</h2>
    <p class="text-sm text-gray-400">
        כמה גולשים נכנסו לאתר בכל חודש (מתוך Google Analytics). הנתונים מתעדכנים אחת לשעה.
        {#if data.updatedAt}<span class="text-gray-500">עודכן {updatedAgo(data.updatedAt)}.</span>{/if}
    </p>

    {#if data.months === null}
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            נתוני Google Analytics אינם זמינים כרגע — נסו לרענן בעוד רגע.
        </div>
    {:else if months.length === 0}
        <div class="card p-5 text-sm text-gray-400">אין עדיין נתונים — הם יופיעו אחרי שהאתר יצבור תנועה.</div>
    {:else}
        <section class="card space-y-3 p-5">
            {#each months as m (m.yearMonth)}
                <div class="flex items-center gap-3">
                    <div class="w-28 flex-shrink-0 text-sm font-bold text-white">
                        {monthLabel(m.yearMonth)}
                        {#if m.yearMonth === currentYm}
                            <span class="mt-0.5 block text-[10px] font-semibold text-emerald-300">● מתעדכן</span>
                        {/if}
                    </div>
                    <div class="h-2.5 flex-1 overflow-hidden rounded-full bg-[#16264d]">
                        <div class="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400"
                            style="width:{Math.max(3, Math.round((m.visitors / maxVisitors) * 100))}%"></div>
                    </div>
                    <div class="w-24 flex-shrink-0 text-left">
                        <div class="text-sm font-black leading-tight text-emerald-300">{fmt.format(m.visitors)} גולשים</div>
                        <div class="text-[11px] leading-tight text-gray-400">{fmt.format(m.pageViews)} צפיות</div>
                    </div>
                </div>
            {/each}
        </section>
    {/if}
</div>
