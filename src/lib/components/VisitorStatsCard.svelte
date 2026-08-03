<script lang="ts">
    // ============================================================
    // כרטיס "סטטיסטיקת כניסות" (נתוני Google Analytics) — רכיב משותף.
    // מוצג פרוס בשלושה מקומות: /admin (סקירה), /profile#admin (האזור
    // האישי) ו-/admin/stats (המסך הייעודי) — כדי שהנתונים יהיו מול
    // העיניים בלי לחיצה נוספת.
    // מציג מספר אחד לכל חודש — צפיות (screenPageViews); מונה ה"כניסות"
    // (activeUsers) הוסר מהתצוגה לבקשת הבעלים כי הכפילות בלבלה.
    // הטיפוס מוגדר כאן מקומית — אסור לייבא מ-$lib/server לקוד לקוח.
    // ============================================================
    interface MonthRow {
        /** YYYYMM כפי שמוחזר מ-GA, למשל "202608" */
        yearMonth: string;
        visitors: number;
        pageViews: number;
    }

    let {
        months,
        updatedAt = null,
        nested = false,
    }: {
        /** null = GA לא זמין; [] = אין עדיין נתונים */
        months: MonthRow[] | null;
        updatedAt?: number | null;
        /** true כשהכרטיס יושב בתוך כרטיס כהה אחר (למשל באזור האישי) */
        nested?: boolean;
    } = $props();

    // GA מחזיר ישן→חדש; הגרף נשאר כרונולוגי, הפירוט מוצג חדש→ישן
    const chartMonths = $derived(months ?? []);
    const listMonths = $derived([...(months ?? [])].reverse());
    const maxViews = $derived(Math.max(1, ...chartMonths.map((m) => m.pageViews)));

    const fmt = new Intl.NumberFormat('he-IL');
    const now = new Date();
    const currentYm = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;

    /** "202608" → "אוגוסט 2026" */
    function monthLabel(ym: string): string {
        const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
        return new Intl.DateTimeFormat('he-IL', { month: 'long', year: 'numeric' }).format(d);
    }

    /** "202608" → "8/26" (לציר החודשים של הגרף) */
    function monthShort(ym: string): string {
        return `${Number(ym.slice(4, 6))}/${ym.slice(2, 4)}`;
    }

    function updatedAgo(ts: number): string {
        const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
        if (mins < 1) return 'עכשיו';
        if (mins < 60) return `לפני ${mins} דק׳`;
        return `לפני ${Math.round(mins / 60)} שע׳`;
    }
</script>

<div class="space-y-3 rounded-2xl border border-[#3b5794] {nested ? 'bg-[#1c2f5a]' : 'bg-[#16264d]'} p-4">
    <div>
        <h2 class="text-base font-black text-white">📈 סטטיסטיקת כניסות</h2>
        <p class="mt-0.5 text-xs text-gray-400">
            כמה צפיות היו לאתר בכל חודש (מתוך Google Analytics). הנתונים מתעדכנים אחת לשעה.
            {#if updatedAt}<span class="text-gray-500">עודכן {updatedAgo(updatedAt)}.</span>{/if}
        </p>
    </div>

    {#if months === null}
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">
            נתוני Google Analytics אינם זמינים כרגע — נסו לרענן בעוד רגע.
        </div>
    {:else if chartMonths.length === 0}
        <p class="text-sm text-gray-400">אין עדיין נתונים — הם יופיעו אחרי שהאתר יצבור תנועה.</p>
    {:else}
        <!-- גרף עמודות — צפיות לפי חודש, כרונולוגי. מוצג רק כשיש לפחות
             שני חודשים להשוואה; חודש בודד הוא סתם מלבן ענק שכבר מיוצג בפירוט. -->
        {#if chartMonths.length > 1}
            <div class="flex items-stretch justify-center gap-1.5">
                {#each chartMonths as m (m.yearMonth)}
                    <div class="flex min-w-0 max-w-16 flex-1 flex-col items-center" title="{monthLabel(m.yearMonth)}: {fmt.format(m.pageViews)} צפיות">
                        <div class="mb-1 text-[10px] font-bold tabular-nums text-gray-300">{fmt.format(m.pageViews)}</div>
                        <div class="flex h-24 w-full items-end">
                            <div
                                class="w-full rounded-t-md bg-gradient-to-t from-emerald-600 to-teal-400 transition-all {m.yearMonth === currentYm ? 'shadow-[0_0_12px_rgba(16,185,129,0.5)]' : ''}"
                                style="height: {Math.max(4, Math.round((m.pageViews / maxViews) * 100))}%"
                            ></div>
                        </div>
                        <div class="mt-1 whitespace-nowrap text-[10px] {m.yearMonth === currentYm ? 'font-bold text-emerald-300' : 'text-gray-400'}">
                            {monthShort(m.yearMonth)}
                        </div>
                    </div>
                {/each}
            </div>
        {/if}

        <!-- פירוט חודשי — חדש→ישן -->
        <div class="space-y-2 {chartMonths.length > 1 ? 'border-t border-white/10 pt-3' : ''}">
            {#each listMonths as m (m.yearMonth)}
                <div class="flex items-center gap-3">
                    <div class="w-24 flex-shrink-0 text-xs font-bold text-white">
                        {monthLabel(m.yearMonth)}
                        {#if m.yearMonth === currentYm}
                            <span class="mt-0.5 block text-[10px] font-semibold text-emerald-300">● מתעדכן</span>
                        {/if}
                    </div>
                    <div class="h-2 flex-1 overflow-hidden rounded-full bg-[#16264d]">
                        <div
                            class="h-full rounded-full bg-gradient-to-l from-emerald-500 to-teal-400"
                            style="width:{Math.max(3, Math.round((m.pageViews / maxViews) * 100))}%"
                        ></div>
                    </div>
                    <div class="w-20 flex-shrink-0 text-left text-xs font-black text-emerald-300">
                        {fmt.format(m.pageViews)} צפיות
                    </div>
                </div>
            {/each}
        </div>
    {/if}
</div>
