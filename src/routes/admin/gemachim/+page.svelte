<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';
    import GemachAvatar from '$lib/components/GemachAvatar.svelte';

    let { data } = $props();

    const flash = $derived($page.url.searchParams.get('flash'));
    const flashText: Record<string, string> = {
        created: '✅ הגמ"ח נוסף בהצלחה',
        updated: '✅ הגמ"ח עודכן בהצלחה',
        deleted: '🗑️ הגמ"ח נמחק'
    };

    function catLabel(key: string) {
        return data.categories.find(c => c.key === key)?.label ?? key;
    }
    function pageHref(p: number) {
        const u = new URLSearchParams($page.url.searchParams);
        u.set('page', String(p));
        return `?${u.toString()}`;
    }
</script>

<svelte:head><title>ניהול גמ"חים – פאנל ניהול</title></svelte:head>

<div class="space-y-4">
    <div class="flex flex-wrap items-center justify-between gap-3">
        <h2 class="text-xl font-black text-white">🤝 ניהול גמ"חים <span class="text-sm font-normal text-gray-400">({data.managedTotal} ב-DB)</span></h2>
        <a href="/admin/gemachim/new" class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90 transition-opacity">➕ הוספת גמ"ח</a>
    </div>

    {#if flash && flashText[flash]}
        <div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{flashText[flash]}</div>
    {/if}

    <!-- חיפוש -->
    <form method="GET" class="flex gap-2">
        <input name="q" value={data.q} placeholder="חיפוש לפי שם, עיר, טלפון או תג..."
            class="flex-1 rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
        <button class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-2.5 text-sm font-bold text-white transition-colors">חפש</button>
        {#if data.q}
            <a href="/admin/gemachim" class="rounded-xl bg-red-900/30 border border-red-500/30 text-red-300 px-4 py-2.5 text-sm hover:bg-red-900/50 transition-colors flex items-center">נקה ✕</a>
        {/if}
    </form>

    {#if data.items.length === 0}
        <div class="card p-10 text-center text-gray-400">
            {#if data.managedTotal === 0}
                <div class="text-4xl mb-3">📭</div>
                <p class="font-bold">אין עדיין גמ"חים מנוהלים ב-DB.</p>
                <p class="text-sm mt-1">אפשר <a href="/admin/gemachim/new" class="text-blue-400 hover:underline">להוסיף גמ"ח חדש</a>.</p>
            {:else}
                <div class="text-4xl mb-3">🔍</div>
                <p class="font-bold">לא נמצאו תוצאות לחיפוש.</p>
            {/if}
        </div>
    {:else}
        <p class="text-xs text-gray-500">מציג {data.items.length} מתוך {data.total} · עמוד {data.page}/{data.pages}. ⭐ מצמיד לראש · ▲▼ סידור ידני.</p>

        <div class="space-y-2">
            {#each data.items as g, i (g.id)}
                <div class="card p-3 flex items-start gap-3">
                    <!-- סידור -->
                    <div class="flex flex-col gap-1 pt-1">
                        <form method="POST" action="?/moveUp" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-7 h-7 rounded-lg bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30"
                                disabled={data.page === 1 && i === 0} aria-label="הזז מעלה">▲</button>
                        </form>
                        <form method="POST" action="?/moveDown" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-7 h-7 rounded-lg bg-[#16264d] hover:bg-[#243a6e] text-gray-300 text-xs disabled:opacity-30"
                                disabled={data.page === data.pages && i === data.items.length - 1} aria-label="הזז מטה">▼</button>
                        </form>
                    </div>

                    <div class="text-2xl pt-1 flex-shrink-0" aria-hidden="true"><GemachAvatar gemach={g} categories={data.categories} /></div>

                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2 flex-wrap">
                            {#if g.featured}<span class="text-amber-400" title="מוצמד לראש">⭐</span>{/if}
                            <h3 class="font-bold text-white truncate">{g.name}</h3>
                        </div>
                        <div class="flex items-center gap-2 mt-1 flex-wrap text-xs text-gray-400">
                            <span class="bg-blue-900/40 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/20">{catLabel(g.category)}</span>
                            <span>📍 {g.city}{g.neighborhood ? ` – ${g.neighborhood}` : ''}</span>
                            {#if g.phone}<span dir="ltr">📞 {g.phone}</span>{/if}
                        </div>
                        {#if g.tags.length}
                            <div class="flex gap-1 mt-1.5 flex-wrap">
                                {#each g.tags.slice(0, 6) as t (t)}<span class="text-[11px] text-gray-500 bg-[#16264d] px-1.5 py-0.5 rounded">{t}</span>{/each}
                                {#if g.tags.length > 6}<span class="text-[11px] text-gray-600">+{g.tags.length - 6}</span>{/if}
                            </div>
                        {/if}
                    </div>

                    <!-- פעולות -->
                    <div class="flex flex-col sm:flex-row items-center gap-1.5 flex-shrink-0">
                        <form method="POST" action="?/toggleFeature" use:enhance>
                            <input type="hidden" name="id" value={g.id} />
                            <input type="hidden" name="featured" value={g.featured ? 'false' : 'true'} />
                            <button class="w-8 h-8 rounded-lg {g.featured ? 'bg-amber-500/20 text-amber-300' : 'bg-[#16264d] text-gray-400 hover:bg-[#243a6e]'} transition-colors"
                                title={g.featured ? 'בטל הצמדה' : 'הצמד לראש'}>⭐</button>
                        </form>
                        <a href={`/admin/gemachim/${g.id}`} class="w-8 h-8 rounded-lg bg-[#16264d] text-gray-300 hover:bg-[#243a6e] transition-colors flex items-center justify-center" title="עריכה">✏️</a>
                        <form method="POST" action="?/delete"
                            use:enhance={({ cancel }) => { if (!confirm(`למחוק את "${g.name}"? הפעולה בלתי הפיכה.`)) cancel(); }}>
                            <input type="hidden" name="id" value={g.id} />
                            <button class="w-8 h-8 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/60 transition-colors" title="מחיקה">🗑️</button>
                        </form>
                    </div>
                </div>
            {/each}
        </div>

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
