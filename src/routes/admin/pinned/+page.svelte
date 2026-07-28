<script lang="ts">
    import { enhance } from '$app/forms';
    import GemachAvatar from '$lib/components/GemachAvatar.svelte';

    let { data, form } = $props();

    function catLabel(key: string) {
        return data.categories.find(c => c.key === key)?.label ?? key;
    }
</script>

<svelte:head><title>נעוצים – פאנל ניהול</title></svelte:head>

<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-black text-white">📌 גמ"חים נעוצים <span class="text-sm font-normal text-gray-400">({data.pinned.length})</span></h2>
        <a href="/" class="text-sm text-blue-400 hover:underline">צפייה בדף הבית ←</a>
    </div>

    <p class="text-xs text-gray-400">
        הרשימה הזו מופיעה בראש דף הבית, מעל "גמחים חדשים שנוספו", בדיוק בסדר שכאן.
        אפשר לנעוץ כל גמ"ח מהמאגר ({data.total}) — גם כאלה שעדיין לא נערכו בפאנל.
    </p>

    {#if form?.error}
        <div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">⚠️ {form.error}</div>
    {/if}

    <!-- הרשימה הנעוצה -->
    {#if data.pinned.length === 0}
        <div class="card p-8 text-center text-gray-400">
            <div class="text-4xl mb-3" aria-hidden="true">📌</div>
            <p class="font-bold">אין כרגע גמ"חים נעוצים.</p>
            <p class="text-sm mt-1">חפש למטה ונעץ — הרשימה תופיע בראש דף הבית.</p>
        </div>
    {:else}
        <div class="space-y-2">
            {#each data.pinned as g, i (g.id)}
                <div class="card p-3 flex items-start gap-3 border-amber-500/30">
                    <div class="flex flex-col gap-1 pt-1">
                        <form method="POST" action="?/moveUp" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-7 h-7 rounded-lg bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30"
                                disabled={i === 0} aria-label="הזז מעלה">▲</button>
                        </form>
                        <form method="POST" action="?/moveDown" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-7 h-7 rounded-lg bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30"
                                disabled={i === data.pinned.length - 1} aria-label="הזז מטה">▼</button>
                        </form>
                    </div>

                    <div class="text-2xl pt-1 flex-shrink-0" aria-hidden="true"><GemachAvatar gemach={g} categories={data.categories} /></div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="text-amber-400 text-sm" aria-hidden="true">📌</span>
                            <h3 class="font-bold text-white truncate">{g.name}</h3>
                            {#if !g.managed}<span class="text-[11px] text-gray-400 bg-[#16264d] px-1.5 py-0.5 rounded">רשימה סטטית</span>{/if}
                        </div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                            <span class="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">{catLabel(g.category)}</span>
                            <span>📍 {g.city}{g.neighborhood ? ` – ${g.neighborhood}` : ''}</span>
                            {#if g.phone}<span dir="ltr">📞 {g.phone}</span>{/if}
                        </div>
                    </div>

                    <div class="flex items-center gap-1.5 flex-shrink-0">
                        <a href={`/gemach/${g.id}`} class="w-8 h-8 rounded-lg bg-[#16264d] text-gray-300 hover:bg-[#243a6e] transition-colors flex items-center justify-center" title="צפייה בגמ&quot;ח">👁️</a>
                        <form method="POST" action="?/unpin" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-300 hover:bg-amber-500/30 transition-colors" title="הסר מהנעוצים">✕</button>
                        </form>
                    </div>
                </div>
            {/each}
        </div>
    {/if}

    <!-- הוספה: חיפוש בכל המאגר -->
    <div class="card p-4 space-y-3">
        <h3 class="font-bold text-white">➕ נעיצת גמ"ח</h3>
        <form method="GET" class="flex gap-2">
            <input name="q" value={data.q} placeholder="חיפוש לפי שם, עיר, טלפון או תג..."
                class="flex-1 rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
            <button class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-2.5 text-sm font-bold text-white transition-colors">חפש</button>
            {#if data.q}
                <a href="/admin/pinned" class="rounded-xl bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2.5 text-sm hover:bg-red-900/50 transition-colors flex items-center">נקה ✕</a>
            {/if}
        </form>

        {#if !data.q}
            <p class="text-xs text-gray-400">הקלד חיפוש כדי למצוא גמ"ח לנעיצה.</p>
        {:else if data.results.length === 0}
            <p class="text-sm text-gray-400">לא נמצאו תוצאות (או שכולן כבר נעוצות).</p>
        {:else}
            <p class="text-xs text-gray-400">
                {#if data.resultsTotal > data.results.length}
                    מציג {data.results.length} מתוך {data.resultsTotal} תוצאות — צמצם את החיפוש לראות את השאר.
                {:else}
                    {data.resultsTotal} תוצאות.
                {/if}
            </p>
            <div class="space-y-2">
                {#each data.results as g (g.id)}
                    <div class="rounded-xl border border-[#3b5794] bg-[#16264d] p-3 flex items-center gap-3">
                        <div class="text-2xl flex-shrink-0" aria-hidden="true"><GemachAvatar gemach={g} categories={data.categories} /></div>
                        <div class="flex-1 min-w-0">
                            <h4 class="font-bold text-white truncate">{g.name}</h4>
                            <div class="flex items-center gap-2 mt-0.5 flex-wrap text-xs text-gray-400">
                                <span class="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">{catLabel(g.category)}</span>
                                <span>📍 {g.city}{g.neighborhood ? ` – ${g.neighborhood}` : ''}</span>
                            </div>
                        </div>
                        <form method="POST" action="?/pin" use:enhance class="flex-shrink-0">
                            <input type="hidden" name="id" value={g.id} />
                            <button class="rounded-xl bg-amber-600 hover:bg-amber-500 px-3.5 py-2 text-sm font-bold text-white transition-colors whitespace-nowrap">📌 נעץ</button>
                        </form>
                    </div>
                {/each}
            </div>
        {/if}
    </div>
</div>
