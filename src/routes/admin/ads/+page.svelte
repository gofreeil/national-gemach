<script lang="ts">
    import type { PageData, ActionData } from './$types';
    import { enhance } from '$app/forms';
    import { invalidateAll } from '$app/navigation';
    import { onMount, onDestroy } from 'svelte';
    import { heMatches } from '$lib/search';
    import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
    import { AD_SLOT_COUNT } from '$lib/rightAdsData';
    import AdCardPreview from '$lib/components/AdCardPreview.svelte';

    let { data, form }: { data: PageData; form: ActionData } = $props();

    type Tab = 'pending' | 'approved' | 'rejected';
    let activeTab = $state<Tab>('pending');
    let searchQuery = $state('');
    // 'display' = הסדר שבו הפרסומות מוצגות באתר (כפי שהשרת מחזיר אותן).
    // רק במיון הזה אפשר להחליף מקום - אחרת החצים היו מזיזים ביחס לתצוגה אחרת.
    let sortOrder = $state<'display' | 'newest' | 'oldest'>('display');
    let canDelete = $derived(data.role === 'super_admin');
    /** מתי הפרסומת פורסמה לאחרונה בכל אתרי הרשת (חותמת שנשמרת על עותק שסונכרן מהרשת) */
    function syndicatedAt(ad: unknown): string {
        const at = (ad as { landing?: { _syndicatedAt?: unknown } } | null)?.landing?._syndicatedAt;
        return typeof at === 'string' ? at : '';
    }
    // תקופות הפרסום שאפשר לקצוב מהטבלה (התקופה נספרת מיום הפרסום)
    const DURATION_OPTIONS = [7, 14, 30, 60, 90, 180, 365];
    // 16 המקומות הממוספרים בטור הפרסומות - בורר המקום בטבלת התזמון
    const SLOT_NUMBERS = Array.from({ length: AD_SLOT_COUNT }, (_, i) => i + 1);
    // צבע קבוע לכל סדרה בסבב, בבורר ובתגי המקום - גם כשהמקום תפוס, כדי
    // שיהיה ברור לאיזו סדרה שייך כל מספר (רקע בהיר בלבד - כהה נשבר בהדגשת המערכת):
    // 1,5,9,13 תכלת · 2,6,10,14 ירוק · 3,7,11,15 צהוב · 4,8,12,16 סגול
    function slotOptionBg(n: number): string {
        if (n % 4 === 1) return '#dbeafe';
        if (n % 4 === 2) return '#dcfce7';
        if (n % 4 === 3) return '#fef9c3';
        return '#f3e8ff';
    }

    // מי תופסת כל מקום בטור - גם מושהית/פגה שומרת את המקום שלה
    let slotOccupants = $derived(new Map(
        data.schedules
            .filter((s) => typeof s.slot === 'number')
            .map((s) => [s.slot as number, { id: s.id, title: s.title }])
    ));
    function shortTitle(t: string): string {
        return t.length > 22 ? t.slice(0, 21) + '…' : t;
    }
    /** תווית אפשרות בבורר המקום - מקום תפוס מסומן עם שם הפרסומת שיושבת בו */
    function slotOptionLabel(n: number, selfId: string): string {
        const occ = slotOccupants.get(n);
        if (!occ) return `${n}`;
        if (occ.id === selfId) return `${n} — המקום הנוכחי`;
        return `${n} ⚠ תפוס: ${shortTitle(occ.title)}`;
    }
    // אזהרה חיה מתחת לבורר ברגע שנבחר מקום תפוס (לפי מזהה השורה)
    let slotWarning = $state<Record<string, string>>({});
    function onSlotPick(e: Event, self: { id: string }) {
        const n = Number((e.currentTarget as HTMLSelectElement).value);
        const occ = slotOccupants.get(n);
        slotWarning = {
            ...slotWarning,
            [self.id]: occ && occ.id !== self.id
                ? `מקום ${n} תפוס ע"י "${shortTitle(occ.title)}" — לחיצה על "העבר" תחליף ביניהן`
                : '',
        };
    }
    // תצוגה מקדימה של הכרטיס כפי שהוא באמת מוצג בטור הפרסומות באתר:
    // ריחוף על הכותרת בטבלת התזמון (דסקטופ) או הקשה עליה (נייד/דסקטופ)
    let approvedById = $derived(new Map(data.approved.map((a) => [a.id, a] as const)));
    let hoverPreview = $state<{ id: string; x: number; y: number } | null>(null);
    let modalPreviewId = $state<string | null>(null);
    const PREVIEW_W = 144, PREVIEW_H = 490; // מידות הכרטיס האמיתי בטור (w-36 × h-[490px])
    function openHoverPreview(e: MouseEvent, id: string) {
        if (!approvedById.has(id)) return;
        // מסך מגע - אין ריחוף אמיתי; ההקשה פותחת את המודאל במקום
        if (window.matchMedia('(hover: none)').matches) return;
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect();
        // הכרטיס צף משמאל לתא, מוצמד לגבולות המסך - מחוץ למכל הגלילה של
        // הטבלה (fixed), אחרת ה-overflow היה חותך אותו
        const y = Math.max(8, Math.min(window.innerHeight - PREVIEW_H - 8, r.top + r.height / 2 - PREVIEW_H / 2));
        const x = Math.max(8, r.left - PREVIEW_W - 16);
        hoverPreview = { id, x, y };
    }

    /** אישור אחרון לפני העברה למקום תפוס - אישור = החלפה, ביטול = כלום לא זז */
    function confirmSlotMove(e: MouseEvent, self: { id: string; title: string; slot?: number | null }) {
        const form = (e.currentTarget as HTMLButtonElement).form;
        const sel = form?.elements.namedItem('slot');
        const n = Number((sel as HTMLSelectElement | null)?.value);
        const occ = slotOccupants.get(n);
        if (!occ || occ.id === self.id) return;
        const ok = confirm(
            `⚠ מקום ${n} כבר תפוס על ידי "${occ.title}".\n\n` +
            `אישור — החלפה: "${self.title}" תעבור למקום ${n}, ו"${occ.title}" תעבור למקום ${self.slot ?? '-'}.\n` +
            `ביטול — ההעברה מתבטלת ושתי הפרסומות נשארות במקומן.`
        );
        if (!ok) e.preventDefault();
    }
    let canReorder = $derived(sortOrder === 'display' && !searchQuery.trim());

    /** מספר המקום של פרסומת מאושרת; לממתינות/נדחות אין מקום */
    function slotOf(ad: unknown, fallback: number): number {
        const s = (ad as { slot?: unknown } | null)?.slot;
        return typeof s === 'number' ? s : fallback;
    }

    // בחירה רב-פריטית
    let selected = $state<Set<string>>(new Set());
    function toggleSelect(id: string) {
        const next = new Set(selected);
        if (next.has(id)) next.delete(id); else next.add(id);
        selected = next;
    }
    function clearSelection() { selected = new Set(); }
    function selectAllVisible(ids: string[]) {
        const next = new Set(selected);
        for (const id of ids) next.add(id);
        selected = next;
    }

    // עריכה בשורה
    let editingId = $state<string | null>(null);
    let editTitle = $state('');
    let editSubtitle = $state('');
    let editCta = $state('');
    let editHover = $state('');
    function startEdit(ad: any) {
        editingId = ad.id;
        editTitle = ad.title ?? '';
        editSubtitle = ad.subtitle ?? '';
        editCta = ad.cta ?? '';
        editHover = ad.hoverText ?? '';
    }
    function cancelEdit() { editingId = null; }

    // רענון אוטומטי כל 30 שניות (כדי לראות פרסומות חדשות שנכנסות).
    //
    // הבדיקה עוברת דרך /admin/ads-review/signal - חתימה של עשרות בייטים -
    // ו-invalidateAll() (שמושך מחדש את כל הפרסומות על התמונות שבהן) רץ רק
    // כשהחתימה השתנתה. קודם הוא רץ בכל פעימה, וטאב אדמין שנשאר פתוח שרף כך
    // מגה-בייטים כל חצי דקה.
    let autoRefresh = $state(true);
    let refreshTimer: ReturnType<typeof setInterval> | null = null;
    let lastRefresh = $state(Date.now());
    let lastSig: string | null = null;
    onMount(() => {
        refreshTimer = setInterval(async () => {
            if (!autoRefresh || document.visibilityState !== 'visible') return;
            try {
                const res = await fetch('/admin/ads/signal');
                if (!res.ok) return;
                const { sig } = (await res.json()) as { sig?: string };
                if (typeof sig !== 'string') return;
                // הפעימה הראשונה רק לומדת את המצב הנוכחי - הדף הרגע נטען
                if (lastSig !== null && sig !== lastSig) {
                    await invalidateAll();
                    lastRefresh = Date.now();
                }
                lastSig = sig;
            } catch { /* תקלת רשת זמנית - ננסה בפעימה הבאה */ }
        }, 30000);
    });
    onDestroy(() => { if (refreshTimer) clearInterval(refreshTimer); });

    // חישוב רשימות מסוננות
    function applyFilter<T extends { title?: string; subtitle?: string; submittedBy?: { email?: string; name?: string }; submittedAt: string }>(list: T[]): T[] {
        const q = searchQuery.trim().toLowerCase();
        const filtered = q
            ? list.filter(a =>
                heMatches(q, a.title, a.subtitle, a.submittedBy?.email, a.submittedBy?.name))
            : list;
        // הסדר מהשרת = סדר התצוגה באתר (מיקום ידני, ואחריו החדשות ביותר)
        if (sortOrder === 'display') return [...filtered];
        return [...filtered].sort((x, y) => {
            const xt = new Date(x.submittedAt).getTime();
            const yt = new Date(y.submittedAt).getTime();
            return sortOrder === 'newest' ? yt - xt : xt - yt;
        });
    }

    let pendingList = $derived(applyFilter(data.pending.filter(p => p.status === 'pending')));
    let rejectedList = $derived(applyFilter(data.pending.filter(p => p.status === 'rejected')));
    let approvedList = $derived(applyFilter(data.approved));

    let visibleList = $derived(
        activeTab === 'pending' ? pendingList :
        activeTab === 'approved' ? approvedList :
        rejectedList
    );

    let visibleSelectedIds = $derived(
        Array.from(selected).filter(id => visibleList.some(a => a.id === id))
    );

    function fmtDate(s?: string) {
        if (!s) return '';
        return new Date(s).toLocaleString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
    }

    // תאריך ושעה בשתי שורות נפרדות בטבלת התזמון - חוסך רוחב כדי שכל
    // הטבלה תיכנס ברוחב המסך בלי גלילה אופקית
    function fmtDay(s?: string) {
        if (!s) return '';
        return new Date(s).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: '2-digit' });
    }
    function fmtTime(s?: string) {
        if (!s) return '';
        return new Date(s).toLocaleTimeString('he-IL', { hour: '2-digit', minute: '2-digit' });
    }
</script>

<svelte:head>
    <title>אישור פרסומות - מנהל ראשי</title>
</svelte:head>

<div class="max-w-6xl mx-auto px-3 md:px-4 py-4 md:py-10" dir="rtl">
    <!-- כותרת + ניווט -->
    <header class="mb-5 md:mb-6 flex flex-wrap items-start gap-3 justify-between">
        <div class="min-w-0">
            <h1 class="text-2xl md:text-3xl font-black text-white mb-1">📢 אישור פרסומות</h1>
            <p class="text-xs md:text-sm text-gray-400">פרסומות שנשלחו על־ידי משתמשים - אשר/דחה לפני פרסום באתר.</p>
        </div>
        <div class="flex items-center gap-2 flex-wrap">
            <a href="/admin"
               class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/10">
                ← לוח ניהול
            </a>
            <a href="/profile"
               class="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-gray-300 text-xs font-bold hover:bg-white/10">
                פרופיל
            </a>
            <button type="button"
                    onclick={() => { invalidateAll(); lastRefresh = Date.now(); }}
                    class="px-3 py-1.5 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs font-bold hover:bg-amber-500/25"
                    title="רענן עכשיו">
                🔄 רענן
            </button>
            <label class="text-xs text-gray-400 flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" bind:checked={autoRefresh} class="accent-amber-500" />
                רענון אוטומטי
            </label>
        </div>
    </header>

    {#if data.backendUnavailable}
        <div class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            ⚠️ הבאקאנד (Strapi) לא זמין כרגע - הרשימות והסטטיסטיקות עשויות להיות חלקיות. נסה לרענן בעוד רגע.
        </div>
    {/if}

    <!-- סטטיסטיקות -->
    <section class="grid grid-cols-2 md:grid-cols-5 gap-2 md:gap-3 mb-5">
        <div class="rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-center">
            <div class="text-[10px] md:text-xs text-amber-300 font-bold uppercase tracking-wide">ממתינות</div>
            <div class="text-2xl md:text-3xl font-black text-amber-200">{data.stats.pending}</div>
        </div>
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/5 px-3 py-2.5 text-center">
            <div class="text-[10px] md:text-xs text-emerald-300 font-bold uppercase tracking-wide">פורסמו</div>
            <div class="text-2xl md:text-3xl font-black text-emerald-200">{data.stats.approved}</div>
        </div>
        <div class="rounded-xl border border-red-500/30 bg-red-500/5 px-3 py-2.5 text-center">
            <div class="text-[10px] md:text-xs text-red-300 font-bold uppercase tracking-wide">נדחו</div>
            <div class="text-2xl md:text-3xl font-black text-red-200">{data.stats.rejected}</div>
        </div>
        <div class="rounded-xl border border-blue-500/30 bg-blue-500/5 px-3 py-2.5 text-center">
            <div class="text-[10px] md:text-xs text-blue-300 font-bold uppercase tracking-wide">השבוע נשלחו</div>
            <div class="text-2xl md:text-3xl font-black text-blue-200">{data.stats.submittedThisWeek}</div>
        </div>
        <div class="rounded-xl border border-purple-500/30 bg-purple-500/5 px-3 py-2.5 text-center col-span-2 md:col-span-1">
            <div class="text-[10px] md:text-xs text-purple-300 font-bold uppercase tracking-wide">השבוע אושרו</div>
            <div class="text-2xl md:text-3xl font-black text-purple-200">{data.stats.approvedThisWeek}</div>
        </div>
    </section>

    <!-- הודעות -->
    {#if form?.success}
        <div class="mb-4 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-emerald-200 text-sm font-bold">
            ✅ {form.message}
        </div>
    {/if}
    {#if form && 'error' in form && form.error}
        <div class="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-red-200 text-sm font-bold">
            ❌ {form.error}
        </div>
    {/if}

    <!-- טאבים -->
    <div class="flex gap-1.5 md:gap-2 mb-4 overflow-x-auto pb-1">
        <button type="button" onclick={() => { activeTab = 'pending'; clearSelection(); }}
                class="px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap transition-all
                       {activeTab === 'pending' ? 'bg-amber-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}">
            ⏳ ממתינות ({data.stats.pending})
        </button>
        <button type="button" onclick={() => { activeTab = 'approved'; clearSelection(); }}
                class="px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap transition-all
                       {activeTab === 'approved' ? 'bg-emerald-500 text-black' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}">
            ✅ פורסמו ({data.stats.approved})
        </button>
        <button type="button" onclick={() => { activeTab = 'rejected'; clearSelection(); }}
                class="px-4 py-2 rounded-xl font-black text-sm whitespace-nowrap transition-all
                       {activeTab === 'rejected' ? 'bg-red-500 text-white' : 'bg-white/5 text-gray-300 hover:bg-white/10 border border-white/10'}">
            ❌ נדחו ({data.stats.rejected})
        </button>
    </div>

    <!-- חיפוש + מיון -->
    <div class="flex flex-wrap gap-2 md:gap-3 mb-4">
        <input type="text" bind:value={searchQuery}
               placeholder="🔎 חיפוש לפי כותרת, תיאור או מגיש..."
               class="flex-1 min-w-[200px] px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm placeholder:text-gray-500 focus:outline-none focus:border-amber-400/50" />
        <select bind:value={sortOrder}
                class="px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm focus:outline-none focus:border-amber-400/50">
            <option value="display" style="background:#fff;color:#111">סדר התצוגה באתר</option>
            <option value="newest" style="background:#fff;color:#111">חדש לישן</option>
            <option value="oldest" style="background:#fff;color:#111">ישן לחדש</option>
        </select>
    </div>

    <!-- שורת בחירה רב־פריטית (רק ב-pending) -->
    {#if activeTab === 'pending' && visibleList.length > 0}
        <div class="flex flex-wrap items-center gap-2 mb-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
            <button type="button"
                    onclick={() => selectAllVisible(visibleList.map(a => a.id))}
                    class="text-xs font-bold text-amber-300 hover:text-amber-200">
                בחר הכל ({visibleList.length})
            </button>
            <span class="text-gray-600 text-xs">·</span>
            <button type="button" onclick={clearSelection}
                    class="text-xs font-bold text-gray-400 hover:text-gray-300">
                נקה
            </button>
            {#if visibleSelectedIds.length > 0}
                <span class="text-xs text-gray-300 mr-2">נבחרו {visibleSelectedIds.length}</span>
                <form method="POST" action="?/bulkApprove" use:enhance={() => async ({ update }) => { clearSelection(); await update(); }}
                      class="inline-flex">
                    <input type="hidden" name="ids" value={visibleSelectedIds.join(',')} />
                    <button type="submit"
                            class="px-3 py-1.5 rounded-lg bg-emerald-500 text-black font-black text-xs hover:bg-emerald-400">
                        ✅ אשר את הנבחרים
                    </button>
                </form>
                <form method="POST" action="?/bulkReject" use:enhance={() => async ({ update }) => { clearSelection(); await update(); }}
                      class="inline-flex gap-1">
                    <input type="hidden" name="ids" value={visibleSelectedIds.join(',')} />
                    <input type="text" name="reason" placeholder="סיבת דחייה (אופציונלי)"
                           class="px-2 py-1 rounded-lg bg-black/30 border border-white/10 text-white text-xs w-40" />
                    <button type="submit"
                            class="px-3 py-1.5 rounded-lg bg-red-600 text-white font-black text-xs hover:bg-red-500">
                        ❌ דחה את הנבחרים
                    </button>
                </form>
            {/if}
        </div>
    {/if}

    <!-- רשימה -->
    {#if visibleList.length === 0}
        <div class="text-center py-12 text-gray-500 text-sm italic border border-dashed border-white/10 rounded-2xl">
            {searchQuery ? 'לא נמצאו תוצאות לחיפוש' :
             activeTab === 'pending' ? 'אין פרסומות שממתינות לאישור' :
             activeTab === 'approved' ? 'עוד לא פורסמו פרסומות' : 'אין פרסומות שנדחו'}
        </div>
    {:else}
        <div class="grid gap-3 md:gap-4">
            {#each visibleList as ad, adIndex (ad.id)}
                <article class="rounded-2xl border border-white/10 bg-white/5 p-3 md:p-5">
                    {#if activeTab === 'approved'}
                        <!-- מיקום הפרסומת בטור הפרסומות באתר + החלפת מקום -->
                        <div class="flex items-center gap-2 mb-3 pb-3 border-b border-white/10 flex-wrap">
                            <span class="inline-flex items-center justify-center w-7 h-7 rounded-lg border border-black/20 font-black text-sm"
                                  style="background:{slotOptionBg(slotOf(ad, adIndex + 1))};color:#111">
                                {slotOf(ad, adIndex + 1)}
                            </span>
                            <span class="text-[11px] md:text-xs text-gray-400 font-bold">
                                מקום {slotOf(ad, adIndex + 1)} מתוך {AD_SLOT_COUNT} בטור הפרסומות
                            </span>
                            {#if canReorder}
                                <div class="flex items-center gap-1.5 mr-auto">
                                    <form method="POST" action="?/move" use:enhance>
                                        <input type="hidden" name="id" value={ad.id} />
                                        <input type="hidden" name="dir" value="up" />
                                        <button type="submit" disabled={adIndex === 0}
                                                class="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-gray-200 font-black text-xs hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="העלה מקום אחד למעלה">
                                            ▲ למעלה
                                        </button>
                                    </form>
                                    <form method="POST" action="?/move" use:enhance>
                                        <input type="hidden" name="id" value={ad.id} />
                                        <input type="hidden" name="dir" value="down" />
                                        <button type="submit" disabled={adIndex === visibleList.length - 1}
                                                class="px-3 py-1.5 rounded-lg bg-white/10 border border-white/15 text-gray-200 font-black text-xs hover:bg-white/20 disabled:opacity-30 disabled:cursor-not-allowed"
                                                title="הורד מקום אחד למטה">
                                            ▼ למטה
                                        </button>
                                    </form>
                                </div>
                            {:else}
                                <span class="text-[10px] text-gray-500 mr-auto">
                                    כדי להחליף מקום - בחר מיון "סדר התצוגה באתר" ונקה את החיפוש
                                </span>
                            {/if}
                        </div>
                    {/if}
                    <div class="flex flex-col md:flex-row gap-3 md:gap-4">
                        {#if activeTab === 'pending'}
                            <label class="flex-shrink-0 inline-flex items-start pt-1 cursor-pointer">
                                <input type="checkbox"
                                       checked={selected.has(ad.id)}
                                       onchange={() => toggleSelect(ad.id)}
                                       class="w-5 h-5 accent-amber-500" />
                            </label>
                        {/if}

                        {#if ad.mainImage}
                            <!-- אותו מיקום/זום שהמפרסם קבע בבילדר — המנהל מאשר את מה שבאמת יוצג -->
                            <div class="relative overflow-hidden w-full md:w-40 h-32 md:h-40 rounded-xl border border-white/10 flex-shrink-0">
                                <img src={ad.mainImage} alt={ad.title}
                                     class="w-full h-full object-cover"
                                     use:adImgFit={parseAdImageFit(ad.mainImageFit)} />
                            </div>
                        {/if}

                        <div class="flex-1 min-w-0">
                            {#if editingId === ad.id}
                                <form method="POST" action="?/update" use:enhance={() => async ({ update }) => { editingId = null; await update(); }}
                                      class="space-y-2">
                                    <input type="hidden" name="id" value={ad.id} />
                                    <input type="text" name="title" bind:value={editTitle}
                                           class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-amber-400/40 text-white font-bold text-base" />
                                    <input type="text" name="subtitle" bind:value={editSubtitle}
                                           class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-sm" />
                                    <input type="text" name="cta" bind:value={editCta} placeholder="טקסט CTA"
                                           class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs" />
                                    <!-- textarea ולא input: המפרסם יכול לרדת שורה בטקסט ה-hover,
                                         ו-input היה משטח את ירידות השורה בכל שמירה של האדמין -->
                                    <textarea name="hoverText" bind:value={editHover} placeholder="טקסט hover" rows="2"
                                              class="w-full px-3 py-1.5 rounded-lg bg-black/40 border border-white/10 text-white text-xs resize-y"></textarea>
                                    <div class="flex gap-2">
                                        <button type="submit"
                                                class="px-3 py-1.5 rounded-lg bg-amber-500 text-black font-black text-xs">
                                            💾 שמור
                                        </button>
                                        <button type="button" onclick={cancelEdit}
                                                class="px-3 py-1.5 rounded-lg bg-white/10 text-gray-300 text-xs">
                                            ביטול
                                        </button>
                                    </div>
                                </form>
                            {:else}
                                <!-- המפרסם הקליד קוד-בעלים בבילדר: בקשה לפרסום חינם -
                                     האדמין מוודא את הזכאות לפני האישור -->
                                {#if ad.codeRequested && ad.status === 'pending'}
                                    <div class="mb-2 rounded-lg border border-amber-400/50 bg-amber-500/10 px-2.5 py-1.5">
                                        <p class="text-[11px] md:text-xs font-black text-amber-200 m-0">
                                            🎟 הוזן קוד בעלים - בקשה לפרסום חינם
                                        </p>
                                        <p class="text-[10px] md:text-[11px] text-amber-100/70 m-0 mt-0.5">
                                            מומלץ לוודא את הזכאות לפני האישור.
                                        </p>
                                    </div>
                                {/if}
                                <!-- מפרסם חוזר ששיפר את הפרסומת שלו: לא בקשה חדשה אלא גרסה
                                     מעודכנת, והאישור מחליף את הישנה במקום להוסיף פרסומת שנייה -->
                                {#if ad.replacesAdId && ad.status === 'pending'}
                                    {@const prevLive = data.approved.some(a => a.id === ad.replacesAdId)}
                                    <div class="mb-2 rounded-lg border border-blue-400/40 bg-blue-500/10 px-2.5 py-1.5">
                                        <p class="text-[11px] md:text-xs font-black text-blue-200 m-0">
                                            🔄 עדכון לפרסומת קיימת{ad.replacesTitle ? ` - גרסה קודמת: "${ad.replacesTitle}"` : ''}
                                        </p>
                                        <p class="text-[10px] md:text-[11px] text-blue-100/70 m-0 mt-0.5">
                                            {prevLive
                                                ? 'עם האישור הגרסה הזו נכנסת במקום הישנה, באותו מקום בטור ועם אותו תאריך סיום - הישנה יורדת מהאתר.'
                                                : 'למפרסם אין כרגע פרסומת פעילה על האתר - האישור פשוט יפרסם את הגרסה הזו.'}
                                        </p>
                                    </div>
                                {:else if ad.supersededBy}
                                    <div class="mb-2 rounded-lg border border-gray-500/40 bg-white/5 px-2.5 py-1.5">
                                        <p class="text-[11px] md:text-xs font-black text-gray-300 m-0">
                                            🔄 גרסה ישנה - הוחלפה בגרסה מעודכנת של המפרסם
                                        </p>
                                    </div>
                                {/if}
                                <h3 class="text-base md:text-lg font-black text-white mb-1">{ad.title}</h3>
                                <p class="text-xs md:text-sm text-gray-300 mb-1">{ad.subtitle}</p>
                                {#if ad.cta}
                                    <p class="text-[10px] md:text-xs text-amber-300 mb-2">CTA: {ad.cta}</p>
                                {/if}
                                {#if ad.hoverText}
                                    <p class="text-[10px] md:text-xs text-gray-500 mb-2">Hover: {ad.hoverText}</p>
                                {/if}
                                <div class="text-[10px] md:text-xs text-gray-400 space-y-0.5">
                                    {#if ad.submittedBy?.email}<div>📧 {ad.submittedBy.email}</div>{/if}
                                    <div>📅 נשלח: {fmtDate(ad.submittedAt)}</div>
                                    {#if ad.decidedAt}<div>🕒 הוחלט: {fmtDate(ad.decidedAt)}</div>{/if}
                                    {#if ad.landing?.phone}<div>☎️ {ad.landing.phone}</div>{/if}
                                    {#if ad.landing?.website}<div>🌐 {ad.landing.website}</div>{/if}
                                    {#if ad.landing?.address}<div>📍 {ad.landing.address}</div>{/if}
                                    {#if ad.rejectionReason}<div class="text-red-300">❌ סיבת דחייה: {ad.rejectionReason}</div>{/if}
                                    {#if syndicatedAt(ad)}<div class="text-sky-300">🌐 פורסמה בכל אתרי הרשת: {fmtDate(syndicatedAt(ad))}</div>{/if}
                                </div>
                            {/if}
                        </div>
                    </div>

                    {#if editingId !== ad.id}
                        <details class="mt-3 text-xs text-gray-300">
                            <summary class="cursor-pointer text-amber-300 font-bold">תצוגה מקדימה של דף הנחיתה</summary>
                            <div class="mt-2 p-3 rounded-lg bg-black/40 border border-white/10 space-y-2">
                                {#if ad.landing?.headline}<p class="font-bold text-white">{ad.landing.headline}</p>{/if}
                                {#if ad.landing?.pitch}<p>{ad.landing.pitch}</p>{/if}
                                {#if ad.landing?.advantages?.some((a: string) => a?.trim())}
                                    <ul class="list-disc pr-5">
                                        {#each ad.landing.advantages as a}
                                            {#if a?.trim()}<li>{a}</li>{/if}
                                        {/each}
                                    </ul>
                                {/if}
                                <!-- preview=1: הכרטיס הזה מוצג גם ב"ממתינות" ו"נדחו",
                                     ושם /ads/<id> חסום לציבור. השרת פותח אותו לסופר-אדמין בלבד. -->
                                <a href={`/ads/${ad.id}?preview=1`} target="_blank" rel="noopener noreferrer"
                                   class="inline-block mt-2 px-3 py-1.5 rounded-lg bg-white/10 text-amber-300 font-bold hover:bg-white/15">
                                    פתח את דף הנחיתה המלא →
                                </a>
                            </div>
                        </details>

                        <!-- פעולות לפי טאב -->
                        <div class="mt-4 flex flex-wrap gap-2">
                            {#if activeTab === 'pending'}
                                {@const replacesLive = !!ad.replacesAdId && data.approved.some(a => a.id === ad.replacesAdId)}
                                <form method="POST" action="?/approve" use:enhance>
                                    <input type="hidden" name="id" value={ad.id} />
                                    <button type="submit"
                                            class="px-4 py-2 rounded-xl bg-emerald-500 text-black font-black text-sm hover:bg-emerald-400"
                                            title={replacesLive ? 'אשר את הגרסה החדשה במקום הישנה' : 'אשר ופרסם בטור הפרסומות'}>
                                        {replacesLive ? '✅ אשר והחלף את הישנה' : '✅ אשר ופרסם'}
                                    </button>
                                </form>
                                {#if replacesLive}
                                    <!-- מפרסם שבאמת רוצה שתי פרסומות במקביל, ולא שדרג את הקיימת -->
                                    <form method="POST" action="?/approve" use:enhance>
                                        <input type="hidden" name="id" value={ad.id} />
                                        <input type="hidden" name="keepPrevious" value="1" />
                                        <button type="submit"
                                                class="px-4 py-2 rounded-xl bg-white/5 border border-white/15 text-gray-300 font-black text-sm hover:bg-white/10"
                                                title="הישנה תישאר על האתר וזו תתווסף לידה">
                                            ➕ אשר כפרסומת נוספת
                                        </button>
                                    </form>
                                {/if}
                                <button type="button" onclick={() => startEdit(ad)}
                                        class="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-200 font-black text-sm hover:bg-blue-500/30">
                                    ✏️ ערוך לפני אישור
                                </button>
                                <form method="POST" action="?/reject" use:enhance class="flex gap-2 flex-1 min-w-[220px]">
                                    <input type="hidden" name="id" value={ad.id} />
                                    <input type="text" name="reason" placeholder="סיבת דחייה (אופציונלי)"
                                           class="flex-1 px-3 py-2 rounded-xl bg-black/30 border border-white/10 text-white text-sm" />
                                    <button type="submit"
                                            class="px-4 py-2 rounded-xl bg-red-600 text-white font-black text-sm hover:bg-red-500">
                                        ❌ דחה
                                    </button>
                                </form>
                            {:else if activeTab === 'approved'}
                                <a href={`/ads/${ad.id}`} target="_blank" rel="noopener"
                                   class="px-4 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 font-black text-sm hover:bg-amber-500/25">
                                    פתח דף נחיתה
                                </a>
                                <button type="button" onclick={() => startEdit(ad)}
                                        class="px-4 py-2 rounded-xl bg-blue-500/20 border border-blue-500/40 text-blue-200 font-black text-sm hover:bg-blue-500/30">
                                    ✏️ ערוך
                                </button>
                                <form method="POST" action="?/unapprove" use:enhance>
                                    <input type="hidden" name="id" value={ad.id} />
                                    <button type="submit"
                                            class="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 font-black text-sm hover:bg-amber-500/30"
                                            onclick={(e) => { if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?')) e.preventDefault(); }}>
                                        ⏸ הורד מהאתר
                                    </button>
                                </form>
                                {#if canDelete}
                                    <form method="POST" action="?/remove" use:enhance>
                                        <input type="hidden" name="id" value={ad.id} />
                                        <button type="submit"
                                                class="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 font-black text-sm hover:bg-red-600/30"
                                                onclick={(e) => { if (!confirm('למחוק את הפרסומת לצמיתות?')) e.preventDefault(); }}>
                                            🗑 מחק
                                        </button>
                                    </form>
                                {/if}
                            {:else}
                                <form method="POST" action="?/unreject" use:enhance>
                                    <input type="hidden" name="id" value={ad.id} />
                                    <button type="submit"
                                            class="px-4 py-2 rounded-xl bg-amber-500/20 border border-amber-500/40 text-amber-200 font-black text-sm hover:bg-amber-500/30">
                                        ↩️ החזר לממתינות
                                    </button>
                                </form>
                                {#if canDelete}
                                    <form method="POST" action="?/remove" use:enhance>
                                        <input type="hidden" name="id" value={ad.id} />
                                        <button type="submit"
                                                class="px-4 py-2 rounded-xl bg-red-600/20 border border-red-500/40 text-red-300 font-black text-sm hover:bg-red-600/30"
                                                onclick={(e) => { if (!confirm('למחוק את הפרסומת לצמיתות?')) e.preventDefault(); }}>
                                            🗑 מחק
                                        </button>
                                    </form>
                                {/if}
                            {/if}
                        </div>
                    {/if}
                </article>
            {/each}
        </div>
    {/if}

    <!-- ============================================================ -->
    <!-- תזמון פרסומות פעילות + תאריכי פקיעה                          -->
    <!-- ============================================================ -->
    <section class="mt-10">
        <div class="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div class="flex items-center gap-2">
                <span class="text-2xl">📅</span>
                <h2 class="text-lg font-black text-white">תזמון פרסומות</h2>
                <span class="text-xs font-bold bg-white/10 text-gray-300 border border-white/20 px-2 py-0.5 rounded-full">{data.schedules.length}</span>
            </div>
            <div class="flex items-center gap-2 text-[10px] md:text-xs">
                <span class="inline-flex items-center gap-1 text-emerald-300"><span class="w-2 h-2 rounded-full bg-emerald-400"></span>פעילה</span>
                <span class="inline-flex items-center gap-1 text-amber-300"><span class="w-2 h-2 rounded-full bg-amber-400"></span>≤ 7 ימים</span>
                <span class="inline-flex items-center gap-1 text-red-300"><span class="w-2 h-2 rounded-full bg-red-400"></span>פגה</span>
                <span class="inline-flex items-center gap-1 text-blue-300"><span class="w-2 h-2 rounded-full bg-blue-400"></span>מושהית</span>
            </div>
        </div>

        <!-- מקרא הסדרות בסבב: כל רביעייה מוצגת יחד בטור, והצבע מסמן לאיזו סדרה שייך כל מקום -->
        <div class="flex items-center gap-2 mb-3 flex-wrap text-[10px] md:text-xs font-bold text-gray-300">
            <span>סדרות הסבב (מוצגות יחד):</span>
            <span class="px-2 py-0.5 rounded-full border border-black/20" style="background:#dbeafe;color:#111">1 · 5 · 9 · 13</span>
            <span class="px-2 py-0.5 rounded-full border border-black/20" style="background:#dcfce7;color:#111">2 · 6 · 10 · 14</span>
            <span class="px-2 py-0.5 rounded-full border border-black/20" style="background:#fef9c3;color:#111">3 · 7 · 11 · 15</span>
            <span class="px-2 py-0.5 rounded-full border border-black/20" style="background:#f3e8ff;color:#111">4 · 8 · 12 · 16</span>
        </div>

        {#if data.schedules.length === 0}
            <div class="text-center py-8 text-gray-500 text-sm italic border border-dashed border-white/10 rounded-2xl">
                אין כרגע פרסומות פעילות באתר
            </div>
        {:else}
            <div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table class="w-full text-sm" dir="rtl">
                    <thead class="bg-white/5">
                        <!-- 4 עמודות בלבד - המידע מוערם בכמה שורות בכל תא, כדי שבדסקטופ
                             הכל ייכנס למסך אחד בלי גלילה אופקית -->
                        <tr class="text-[11px] md:text-xs text-gray-400 uppercase tracking-wide">
                            <th class="text-right font-bold px-2 py-2.5">מקום</th>
                            <th class="text-right font-bold px-2 py-2.5">פרסומת ומפרסם</th>
                            <th class="text-right font-bold px-2 py-2.5">תקופה</th>
                            <th class="text-right font-bold px-2 py-2.5">ניהול</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.schedules as s (s.id)}
                            {@const stateColor = s.state === 'paused' ? 'bg-blue-500/15 text-blue-300 border-blue-500/40'
                                : s.state === 'expired' ? 'bg-red-500/15 text-red-300 border-red-500/40'
                                : s.state === 'ending' ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                                : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'}
                            {@const stateLabel = s.state === 'paused' ? 'מושהית'
                                : s.state === 'expired' ? 'פגה'
                                : s.state === 'ending' ? 'פגה בקרוב'
                                : 'פעילה'}
                            {@const daysColor = s.state === 'paused' ? 'text-blue-300'
                                : s.daysLeft < 0 ? 'text-red-300'
                                : s.daysLeft <= 7 ? 'text-amber-300'
                                : 'text-emerald-300'}
                            {@const progress = Math.min(100, Math.max(0, ((s.durationDays - Math.max(0, s.daysLeft)) / s.durationDays) * 100))}
                            <!-- תקופה נוכחית שאינה ברשימה (למשל 45 יום) מתווספת לבורר, כדי שלא תיעלם -->
                            {@const durOptions = DURATION_OPTIONS.includes(s.durationDays)
                                ? DURATION_OPTIONS
                                : [...DURATION_OPTIONS, s.durationDays].sort((a, b) => a - b)}
                            <!-- מקום מעל 12 (גלישה) מתווסף לבורר כדי שלא ייעלם -->
                            {@const slotOptions = s.slot && !SLOT_NUMBERS.includes(s.slot)
                                ? [...SLOT_NUMBERS, s.slot].sort((a, b) => a - b)
                                : SLOT_NUMBERS}
                            <tr class="border-t border-white/10 hover:bg-white/5">
                                <!-- מספר המקום בטור + העברה ישירה למקום אחר (מקום תפוס - מתחלפות).
                                     פריסה אנכית צרה - כדי שכל הטבלה תיכנס ברוחב המסך בלי גלילה -->
                                <td class="px-2 py-2">
                                    <form method="POST" action="?/setSlot" use:enhance class="flex flex-col items-start gap-1">
                                        <input type="hidden" name="id" value={s.id} />
                                        <div class="flex items-center gap-1">
                                            <span class="inline-flex items-center justify-center min-w-6 h-6 px-1 rounded-lg border border-black/20 font-black text-xs"
                                                  style="background:{typeof s.slot === 'number' ? slotOptionBg(s.slot) : '#fff'};color:#111">
                                                {s.slot ?? '-'}
                                            </span>
                                            <select name="slot"
                                                    onchange={(e) => onSlotPick(e, s)}
                                                    class="px-1.5 py-1 rounded-lg bg-black/40 border border-white/15 text-white text-[11px] focus:outline-none focus:border-amber-400/50">
                                                {#each slotOptions as n (n)}
                                                    {@const occ = slotOccupants.get(n)}
                                                    {@const takenByOther = !!occ && occ.id !== s.id}
                                                    <!-- גם מקום תפוס שומר על צבע הסדרה שלו; התפוס מסומן בטקסט אדום מודגש -->
                                                    <option value={n} selected={n === s.slot}
                                                            style="background:{slotOptionBg(n)};color:{takenByOther ? '#b91c1c' : '#111'};font-weight:{takenByOther ? '700' : '400'}">
                                                        {slotOptionLabel(n, s.id)}
                                                    </option>
                                                {/each}
                                            </select>
                                        </div>
                                        <button type="submit"
                                                onclick={(e) => confirmSlotMove(e, s)}
                                                class="px-2 py-1 rounded-lg bg-purple-500/20 border border-purple-500/40 text-purple-200 text-[11px] font-black hover:bg-purple-500/30 whitespace-nowrap"
                                                title="העבר למקום שנבחר; מקום תפוס - תתבקש לאשר החלפה בין השתיים">
                                            ⇄ העבר
                                        </button>
                                        {#if slotWarning[s.id]}
                                            <span class="text-[10px] font-bold text-amber-300 leading-snug max-w-[150px]">
                                                ⚠ {slotWarning[s.id]}
                                            </span>
                                        {/if}
                                    </form>
                                </td>
                                <!-- פרסומת + מפרסם + סטטוס בתא אחד, מוערמים.
                                     ריחוף על הכותרת = תצוגה מקדימה צפה; הקשה = מודאל עם הכרטיס עצמו -->
                                <td class="px-2 py-2">
                                    <button type="button"
                                            onmouseenter={(e) => openHoverPreview(e, s.id)}
                                            onmouseleave={() => hoverPreview = null}
                                            onclick={() => { hoverPreview = null; modalPreviewId = s.id; }}
                                            title="תצוגה מקדימה של הפרסומת כפי שהיא מוצגת באתר"
                                            class="font-bold text-white line-clamp-2 break-words max-w-[160px] leading-snug text-right cursor-pointer underline decoration-dotted decoration-white/30 underline-offset-2 hover:text-amber-300">
                                        {s.title}
                                    </button>
                                    <div class="text-xs text-gray-300 truncate max-w-[160px] mt-0.5">{s.advertiserName || '-'}</div>
                                    <div class="text-[10px] text-gray-500 truncate max-w-[160px]">{s.advertiserEmail}</div>
                                    <span class="inline-block mt-1 text-[11px] font-black border px-2 py-0.5 rounded-full whitespace-nowrap {stateColor}">{stateLabel}</span>
                                </td>
                                <!-- כל נתוני הזמן בתא אחד: פורסם, פג, וכמה נותר מתוך המשך -->
                                <td class="px-2 py-2 text-xs leading-relaxed whitespace-nowrap">
                                    <div class="text-gray-300">פורסם: {fmtDay(s.publishedAt)} <span class="text-[10px] text-gray-500">{fmtTime(s.publishedAt)}</span></div>
                                    <div class="text-gray-300">פג: {fmtDay(s.expiresAt)} <span class="text-[10px] text-gray-500">{fmtTime(s.expiresAt)}</span></div>
                                    <div class="font-black {daysColor} mt-0.5">
                                        {s.daysLeft < 0 ? `${-s.daysLeft}- ימים` : `${s.daysLeft} ימים`}
                                        <span class="font-bold text-gray-500 text-[10px]">מתוך {s.durationDays}</span>
                                    </div>
                                    <div class="mt-1 h-1.5 w-24 rounded-full bg-white/10 overflow-hidden">
                                        <div class="h-full {s.state === 'expired' ? 'bg-red-400' : s.state === 'ending' ? 'bg-amber-400' : 'bg-emerald-400'}"
                                             style="width: {progress}%"></div>
                                    </div>
                                </td>
                                <!-- ניהול הפרסומת ישירות מהשורה: קציבת תקופה, השהיה, הורדה, מחיקה.
                                     רוחב מוגבל - הכפתורים נערמים בשתי שורות במקום להרחיב את הטבלה -->
                                <td class="px-2 py-2">
                                    <div class="flex flex-wrap items-center gap-1.5 max-w-[240px]">
                                        <form method="POST" action="?/setDuration" use:enhance class="flex items-center gap-1">
                                            <input type="hidden" name="id" value={s.id} />
                                            <select name="days"
                                                    class="px-2 py-1 rounded-lg bg-black/40 border border-white/15 text-white text-[11px] focus:outline-none focus:border-amber-400/50">
                                                {#each durOptions as d (d)}
                                                    <option value={d} selected={d === s.durationDays} style="background:#fff;color:#111">{d} ימים</option>
                                                {/each}
                                            </select>
                                            <button type="submit"
                                                    class="px-2.5 py-1 rounded-lg bg-blue-500/20 border border-blue-500/40 text-blue-200 text-[11px] font-black hover:bg-blue-500/30 whitespace-nowrap"
                                                    title="התקופה נספרת מיום הפרסום">
                                                ⏱ קצוב
                                            </button>
                                        </form>

                                        {#if s.state === 'paused'}
                                            <form method="POST" action="?/resume" use:enhance>
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit"
                                                        class="px-2.5 py-1 rounded-lg bg-emerald-500/20 border border-emerald-500/40 text-emerald-200 text-[11px] font-black hover:bg-emerald-500/30 whitespace-nowrap"
                                                        title="הימים השמורים נספרים מהיום">
                                                    ▶ המשך
                                                </button>
                                            </form>
                                        {:else}
                                            <form method="POST" action="?/pause" use:enhance>
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit"
                                                        class="px-2.5 py-1 rounded-lg bg-white/10 border border-white/20 text-gray-200 text-[11px] font-black hover:bg-white/20 whitespace-nowrap"
                                                        title="יורדת מהאתר ושומרת את הימים שנותרו"
                                                        onclick={(e) => { if (!confirm('להשהות את הפרסומת? היא תרד מהאתר והימים שנותרו יישמרו לה.')) e.preventDefault(); }}>
                                                    ⏸ השהה
                                                </button>
                                            </form>
                                        {/if}

                                        <form method="POST" action="?/unapprove" use:enhance>
                                            <input type="hidden" name="id" value={s.id} />
                                            <button type="submit"
                                                    class="px-2.5 py-1 rounded-lg bg-amber-500/15 border border-amber-500/40 text-amber-200 text-[11px] font-black hover:bg-amber-500/25 whitespace-nowrap"
                                                    title="חוזרת לתור האישורים"
                                                    onclick={(e) => { if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?')) e.preventDefault(); }}>
                                                ⤴ הורד
                                            </button>
                                        </form>

                                        {#if canDelete}
                                            <form method="POST" action="?/remove" use:enhance>
                                                <input type="hidden" name="id" value={s.id} />
                                                <button type="submit"
                                                        class="px-2.5 py-1 rounded-lg bg-red-600/20 border border-red-500/40 text-red-300 text-[11px] font-black hover:bg-red-600/30 whitespace-nowrap"
                                                        onclick={(e) => { if (!confirm(`למחוק לצמיתות את "${s.title}"?`)) e.preventDefault(); }}>
                                                    🗑 מחק
                                                </button>
                                            </form>
                                        {/if}
                                    </div>
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}

        {#if data.reminderRun?.sent > 0}
            <p class="mt-2 text-[11px] text-emerald-300/80 italic">
                ✉️ נשלחו {data.reminderRun.sent} תזכורות אוטומטיות למפרסמים בטעינה זו.
            </p>
        {/if}
    </section>

    <!-- ============================================================ -->
    <!-- מפרסמים - קיבוץ לפי אימייל                                  -->
    <!-- ============================================================ -->
    <section class="mt-10 mb-12">
        <div class="flex items-center gap-2 mb-3">
            <span class="text-2xl">👤</span>
            <h2 class="text-lg font-black text-white">מפרסמים</h2>
            <span class="text-xs font-bold bg-white/10 text-gray-300 border border-white/20 px-2 py-0.5 rounded-full">{data.advertisers.length}</span>
        </div>

        {#if data.advertisers.length === 0}
            <div class="text-center py-8 text-gray-500 text-sm italic border border-dashed border-white/10 rounded-2xl">
                עוד אין מפרסמים במערכת
            </div>
        {:else}
            <div class="overflow-x-auto rounded-2xl border border-white/10 bg-white/5">
                <table class="w-full text-sm" dir="rtl">
                    <thead class="bg-white/5">
                        <tr class="text-[11px] md:text-xs text-gray-400 uppercase tracking-wide">
                            <th class="text-right font-bold px-3 py-2.5">שם</th>
                            <th class="text-right font-bold px-3 py-2.5 hidden md:table-cell">חברה</th>
                            <th class="text-right font-bold px-3 py-2.5 hidden md:table-cell">עיר/כתובת</th>
                            <th class="text-right font-bold px-3 py-2.5 hidden lg:table-cell">טלפון</th>
                            <th class="text-right font-bold px-3 py-2.5">סך תשלום</th>
                            <th class="text-right font-bold px-3 py-2.5">פרסומות</th>
                            <th class="text-right font-bold px-3 py-2.5">פעילות</th>
                            <th class="text-right font-bold px-3 py-2.5 hidden md:table-cell">סוג</th>
                        </tr>
                    </thead>
                    <tbody>
                        {#each data.advertisers as a (a.key)}
                            <tr class="border-t border-white/10 hover:bg-white/5">
                                <td class="px-3 py-2 font-bold text-white">
                                    <div class="truncate max-w-[160px]">{a.name || '-'}</div>
                                    <div class="text-[10px] text-gray-500 truncate max-w-[160px]">{a.email}</div>
                                </td>
                                <td class="px-3 py-2 text-gray-300 hidden md:table-cell truncate max-w-[160px]">{a.companyName || '-'}</td>
                                <td class="px-3 py-2 text-gray-300 hidden md:table-cell truncate max-w-[160px]">{a.address || '-'}</td>
                                <td class="px-3 py-2 text-gray-300 hidden lg:table-cell whitespace-nowrap">{a.phone || '-'}</td>
                                <td class="px-3 py-2 font-black text-emerald-300 whitespace-nowrap">
                                    {a.totalPaid > 0 ? `₪${a.totalPaid.toLocaleString('he-IL')}` : '-'}
                                </td>
                                <td class="px-3 py-2 text-gray-300">{a.adsCount}</td>
                                <td class="px-3 py-2 {a.activeCount > 0 ? 'text-emerald-300 font-black' : 'text-gray-500'}">{a.activeCount}</td>
                                <td class="px-3 py-2 hidden md:table-cell">
                                    {#if a.isReturning}
                                        <span class="text-[11px] font-black bg-purple-500/15 text-purple-300 border border-purple-500/40 px-2 py-0.5 rounded-full whitespace-nowrap">🔁 חוזר</span>
                                    {:else}
                                        <span class="text-[11px] font-black bg-blue-500/15 text-blue-300 border border-blue-500/40 px-2 py-0.5 rounded-full whitespace-nowrap">חדש</span>
                                    {/if}
                                </td>
                            </tr>
                        {/each}
                    </tbody>
                </table>
            </div>
        {/if}
    </section>

    <!-- תצוגה מקדימה צפה בריחוף על כותרת בטבלת התזמון (דסקטופ בלבד) -->
    {#if hoverPreview}
        {@const pAd = approvedById.get(hoverPreview.id)}
        {#if pAd}
            <div class="fixed z-40 pointer-events-none drop-shadow-2xl hidden md:block"
                 style="left:{hoverPreview.x}px; top:{hoverPreview.y}px">
                <AdCardPreview ad={pAd} />
            </div>
        {/if}
    {/if}

    <!-- מודאל תצוגה מקדימה בהקשה על הכותרת (נייד ודסקטופ) -->
    {#if modalPreviewId}
        {@const mAd = approvedById.get(modalPreviewId)}
        {#if mAd}
            <!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_static_element_interactions -->
            <div class="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto"
                 role="presentation"
                 onclick={() => modalPreviewId = null}>
                <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
                <div class="flex flex-col items-center gap-3 my-auto"
                     role="dialog" aria-modal="true" aria-label="תצוגה מקדימה של הפרסומת" tabindex="-1"
                     onclick={(e) => e.stopPropagation()}>
                    <AdCardPreview ad={mAd} />
                    <div class="flex items-center gap-2">
                        <a href={`/ads/${mAd.id}`} target="_blank" rel="noopener"
                           class="px-3 py-1.5 rounded-lg bg-amber-500/20 border border-amber-500/40 text-amber-200 text-xs font-black hover:bg-amber-500/30">
                            פתח דף נחיתה
                        </a>
                        <button type="button" onclick={() => modalPreviewId = null}
                                class="px-3 py-1.5 rounded-lg bg-white/10 border border-white/20 text-gray-200 text-xs font-black hover:bg-white/20">
                            ✕ סגור
                        </button>
                    </div>
                </div>
            </div>
        {/if}
    {/if}
</div>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') { modalPreviewId = null; hoverPreview = null; } }} />
