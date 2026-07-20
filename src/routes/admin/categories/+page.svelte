<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';
    import type { CategoryDef } from '$lib/gemachData';

    let { data, form } = $props();

    // עותק ניתן לעריכה. existing = מפתחות שכבר קיימים (לא ניתן לשנות מפתח כדי לא לנתק גמ"חים)
    let list = $state<CategoryDef[]>(data.categories.map(c => ({ ...c })));
    const existingKeys = new Set(data.categories.map(c => c.key));

    let saving = $state(false);
    const flash = $derived($page.url.searchParams.get('flash'));

    function add() {
        list = [...list, { key: '', label: '', icon: '📦' }];
    }
    function remove(i: number) {
        if (list.length <= 1) return;
        list = list.filter((_, idx) => idx !== i);
    }
    function move(i: number, dir: -1 | 1) {
        const j = i + dir;
        if (j < 0 || j >= list.length) return;
        const copy = [...list];
        [copy[i], copy[j]] = [copy[j], copy[i]];
        list = copy;
    }
    const payload = $derived(JSON.stringify(list));
</script>

<svelte:head><title>קטגוריות – פאנל ניהול</title></svelte:head>

<div class="max-w-3xl space-y-4">
    <div class="flex items-center justify-between">
        <h2 class="text-xl font-black text-white">🏷️ ניהול קטגוריות</h2>
    </div>

    {#if flash === 'saved'}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">✅ הקטגוריות נשמרו</div>{/if}
    {#if flash === 'reset'}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">↩️ שוחזרה רשימת ברירת המחדל</div>{/if}
    {#if form?.error}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{form.error}</div>{/if}

    <p class="text-sm text-gray-400">
        הקטגוריות משמשות לסינון ולתצוגה באתר. הסדר כאן קובע את סדר ההצגה.
        מפתח של קטגוריה קיימת נעול — שינויו ינתק את הגמ"חים המשויכים אליה.
    </p>

    <div class="space-y-2">
        {#each list as cat, i (i)}
            <div class="card p-3 flex items-center gap-2">
                <div class="flex flex-col gap-1">
                    <button type="button" onclick={() => move(i, -1)} disabled={i === 0}
                        class="w-6 h-6 rounded bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30">▲</button>
                    <button type="button" onclick={() => move(i, 1)} disabled={i === list.length - 1}
                        class="w-6 h-6 rounded bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30">▼</button>
                </div>
                <input bind:value={cat.icon} maxlength="4" aria-label="אייקון"
                    class="w-14 text-center rounded-lg border border-[#3b5794] bg-[#1e293b] px-2 py-2 text-lg focus:border-purple-500 focus:outline-none" />
                <input bind:value={cat.label} placeholder="שם הקטגוריה" aria-label="שם"
                    class="flex-1 rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
                <input bind:value={cat.key} placeholder="key" aria-label="מפתח" dir="ltr"
                    readonly={existingKeys.has(cat.key)}
                    class="w-32 rounded-lg border border-[#3b5794] bg-[#1e293b] px-3 py-2 text-gray-400 text-sm focus:border-purple-500 focus:outline-none text-left {existingKeys.has(cat.key) ? 'opacity-60' : ''}" />
                <button type="button" onclick={() => remove(i)} disabled={list.length <= 1}
                    class="w-8 h-8 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/60 transition-colors disabled:opacity-30" title="הסר">🗑️</button>
            </div>
        {/each}
    </div>

    <button type="button" onclick={add}
        class="rounded-xl border border-dashed border-[#4c6cb0] text-gray-300 hover:bg-[#1e3260] px-4 py-2.5 text-sm font-bold w-full transition-colors">
        ➕ הוסף קטגוריה
    </button>

    <div class="flex items-center gap-3 pt-3 border-t border-[#3b5794]">
        <form method="POST" action="?/save" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}>
            <input type="hidden" name="categories" value={payload} />
            <button type="submit" disabled={saving}
                class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                {saving ? 'שומר...' : 'שמור קטגוריות'}
            </button>
        </form>
        <form method="POST" action="?/reset" use:enhance={({ cancel }) => { if (!confirm('לשחזר את רשימת ברירת המחדל? השינויים שלך יימחקו.')) cancel(); }}>
            <button type="submit" class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-3 font-bold text-white transition-colors">↩️ שחזר ברירת מחדל</button>
        </form>
    </div>
</div>
