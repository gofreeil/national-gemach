<script lang="ts">
    let { data } = $props();
    const s = $derived(data.stats);
    const role = $derived(data.admin.role as 'super_admin' | 'admin');

    const maxVisits = $derived(Math.max(...data.visits.map(v => v.count), 0));

    /** '2026-07' → '7/26' */
    function fmtMonth(m: string): string {
        const [y, mo] = m.split('-');
        return `${Number(mo)}/${y.slice(2)}`;
    }
</script>

<div class="space-y-6">
    <!-- כרטיסי סטטיסטיקה -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div class="card p-4">
            <div class="text-3xl font-black text-blue-400">{s.managed}</div>
            <div class="text-xs text-gray-400 mt-1">גמ"חים מנוהלים (DB)</div>
        </div>
        <div class="card p-4">
            <div class="text-3xl font-black text-amber-400">{s.featured}</div>
            <div class="text-xs text-gray-400 mt-1">מוצמדים לראש</div>
        </div>
        <div class="card p-4">
            <div class="text-3xl font-black text-purple-400">{s.categories}</div>
            <div class="text-xs text-gray-400 mt-1">קטגוריות</div>
        </div>
        <div class="card p-4">
            <div class="text-3xl font-black text-emerald-400">{s.admins}</div>
            <div class="text-xs text-gray-400 mt-1">אדמינים ב-DB</div>
        </div>
    </div>

    <!-- גרף כניסות חודשיות -->
    <div class="card p-5">
        <h2 class="font-bold text-white">📈 כניסות לאתר לפי חודש</h2>
        <p class="text-xs text-gray-400 mt-1 mb-4">
            צפיות עמוד באתר הציבורי (לא כולל פאנל הניהול), 12 החודשים האחרונים
        </p>
        {#if maxVisits === 0}
            <p class="text-sm text-gray-400">
                עדיין אין נתונים — הספירה מתחילה להצטבר מרגע העלייה לאוויר.
            </p>
        {:else}
            <div class="flex items-stretch gap-1.5">
                {#each data.visits as v (v.month)}
                    <div class="flex-1 min-w-0 flex flex-col items-center" title="{fmtMonth(v.month)}: {v.count} כניסות">
                        <div class="text-[10px] font-bold text-gray-300 mb-1">{v.count || ''}</div>
                        <div class="w-full h-36 flex items-end">
                            <div
                                class="w-full rounded-t-md bg-gradient-to-t from-blue-600 to-purple-400 transition-all"
                                style="height: {v.count === 0 ? '2px' : Math.max(4, Math.round((v.count / maxVisits) * 100)) + '%'}"
                            ></div>
                        </div>
                        <div class="text-[10px] text-gray-400 mt-1 whitespace-nowrap">{fmtMonth(v.month)}</div>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- מצב ייבוא הרשימה הסטטית -->
    {#if s.staticRemaining > 0}
        <div class="card p-5 border-amber-500/30 bg-amber-500/5">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-bold text-amber-200">📥 הרשימה הסטטית עדיין לא הועברה במלואה ל-DB</h2>
                    <p class="text-sm text-gray-400 mt-1">
                        {s.staticImported} מתוך {s.staticTotal} יובאו · נותרו <b class="text-amber-300">{s.staticRemaining}</b>.
                        עד לייבוא, הגמ"חים הסטטיים מוצגים באתר אך אינם ניתנים לעריכה/מחיקה בפאנל.
                    </p>
                </div>
                <a href="/admin/import" class="rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors whitespace-nowrap">
                    למסך הייבוא ←
                </a>
            </div>
        </div>
    {:else}
        <div class="card p-5 border-emerald-500/30 bg-emerald-500/5">
            <h2 class="font-bold text-emerald-200">✅ כל הרשימה הסטטית ({s.staticTotal}) הועברה ל-DB וניתנת לניהול מלא</h2>
        </div>
    {/if}

    <!-- מוכנות למפה של קהילה בשכונה -->
    {#if s.mapMissing > 0}
        <div class="card p-5 border-amber-500/30 bg-amber-500/5">
            <div class="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h2 class="font-bold text-amber-200">🗺️ {s.mapMissing} גמ"חים עדיין ללא מיקום למפה</h2>
                    <p class="text-sm text-gray-400 mt-1">
                        {s.mapReady} מתוך {s.managed} כוללים קואורדינטות ויופיעו על מפת "קהילה בשכונה".
                        השלם כתובת/עיר לשאר כדי שכל גמ"ח יופיע וייספר גם שם.
                    </p>
                </div>
                <a href="/admin/gemachim/complete" class="rounded-xl bg-amber-600 hover:bg-amber-500 px-5 py-2.5 text-sm font-bold text-white transition-colors whitespace-nowrap">
                    להשלמת פרטים ←
                </a>
            </div>
        </div>
    {:else if s.managed > 0}
        <div class="card p-5 border-emerald-500/30 bg-emerald-500/5">
            <h2 class="font-bold text-emerald-200">🗺️ כל {s.managed} הגמ"חים כוללים מיקום ומופיעים על מפת "קהילה בשכונה"</h2>
        </div>
    {/if}

    <!-- קיצורי דרך -->
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <a href="/admin/gemachim/new" class="card p-5 hover:bg-[#1e3260] transition-colors block">
            <div class="text-2xl mb-2" aria-hidden="true">➕</div>
            <div class="font-bold text-white">הוספת גמ"ח חדש</div>
            <div class="text-xs text-gray-400 mt-1">שם, קטגוריה, עיר, טלפון, תגים ועוד</div>
        </a>
        <a href="/admin/gemachim" class="card p-5 hover:bg-[#1e3260] transition-colors block">
            <div class="text-2xl mb-2" aria-hidden="true">🤝</div>
            <div class="font-bold text-white">ניהול גמ"חים</div>
            <div class="text-xs text-gray-400 mt-1">עריכה, סידור, הצמדה ומחיקה</div>
        </a>
        <a href="/admin/gemachim/complete" class="card p-5 hover:bg-[#1e3260] transition-colors block">
            <div class="text-2xl mb-2" aria-hidden="true">🗺️</div>
            <div class="font-bold text-white">השלמת פרטים למפה</div>
            <div class="text-xs text-gray-400 mt-1">כתובת/עיר + גזירת קואורדינטות אוטומטית</div>
        </a>
        <a href="/admin/categories" class="card p-5 hover:bg-[#1e3260] transition-colors block">
            <div class="text-2xl mb-2" aria-hidden="true">🏷️</div>
            <div class="font-bold text-white">קטגוריות</div>
            <div class="text-xs text-gray-400 mt-1">הוספה, עריכה וסידור קטגוריות</div>
        </a>
        {#if role === 'super_admin'}
            <a href="/admin/admins" class="card p-5 hover:bg-[#1e3260] transition-colors block">
                <div class="text-2xl mb-2" aria-hidden="true">🔑</div>
                <div class="font-bold text-white">ניהול אדמינים</div>
                <div class="text-xs text-gray-400 mt-1">הוספת אדמינים לפי מייל / משתמש / טלפון</div>
            </a>
        {/if}
    </div>
</div>
