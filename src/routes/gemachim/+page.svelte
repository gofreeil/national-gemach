<script lang="ts">
    import { page as pageStore } from '$app/stores';
    import GemachAvatar from '$lib/components/GemachAvatar.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    function getCategoryLabel(key: string) {
        return data.categories.find(c => c.key === key)?.label ?? key;
    }
    function pageHref(p: number) {
        const u = new URLSearchParams($pageStore.url.searchParams);
        if (p <= 1) u.delete('page'); else u.set('page', String(p));
        const qs = u.toString();
        return qs ? `?${qs}` : '/gemachim';
    }

    // חלון מספרי-עמודים סביב העמוד הנוכחי (עד 7 מספרים) + תמיד ראשון/אחרון.
    let pageNumbers = $derived.by(() => {
        const { page, pages } = data;
        const out: (number | '…')[] = [];
        const push = (n: number) => { if (!out.includes(n)) out.push(n); };
        const from = Math.max(2, page - 2);
        const to = Math.min(pages - 1, page + 2);
        push(1);
        if (from > 2) out.push('…');
        for (let n = from; n <= to; n++) push(n);
        if (to < pages - 1) out.push('…');
        if (pages > 1) push(pages);
        return out;
    });
</script>

<svelte:head>
    <title>כל הגמ"חים – הגמ"ח הארצי</title>
    <meta name="description" content="רשימת כל הגמ&quot;חים במאגר הארצי, עם עימוד לפי עמודים" />
</svelte:head>

<section class="px-3 md:px-4 py-6 max-w-5xl mx-auto">
    <div class="flex flex-wrap items-end justify-between gap-3 mb-5">
        <div>
            <h1 class="text-2xl md:text-3xl font-black text-white">כל הגמ"חים</h1>
            <p class="text-sm text-gray-300 mt-1">
                {data.total} גמ"חים במאגר · עמוד {data.page} מתוך {data.pages}
            </p>
        </div>
        <a href="/" class="text-sm text-gray-300 hover:text-white transition-colors">→ חזרה לדף הבית</a>
    </div>

    {#if data.items.length === 0}
        <div class="text-center py-16 text-gray-300">
            <div class="text-5xl mb-4" aria-hidden="true">📭</div>
            <p class="text-lg font-bold">אין גמ"חים להצגה</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each data.items as gemach (gemach.id)}
                <article class="relative bg-[#16264d] border border-[#3b5794] rounded-2xl p-5 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                    <div class="flex items-start gap-3">
                        <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                            <GemachAvatar {gemach} categories={data.categories} />
                        </div>
                        <div class="flex-1 min-w-0">
                            <h2 class="font-black text-white text-lg leading-tight">
                                <a href="/gemach/{gemach.id}" class="after:absolute after:inset-0 after:content-[''] hover:text-blue-300 transition-colors">{gemach.name}</a>
                            </h2>
                            <div class="flex items-center gap-2 mt-1 flex-wrap">
                                <span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                    {getCategoryLabel(gemach.category)}
                                </span>
                                <span class="text-xs text-gray-400">
                                    📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                                </span>
                            </div>
                            {#if gemach.description}
                                <p class="text-gray-300 text-sm mt-2 leading-relaxed line-clamp-3">{gemach.description}</p>
                            {/if}
                            <div class="flex items-center gap-4 mt-3 flex-wrap">
                                {#if gemach.phone}
                                    <a href="tel:{gemach.phone}" class="relative z-10 inline-flex items-center gap-2 text-sm font-bold text-green-400 hover:text-green-300 transition-colors" aria-label="התקשר ל{gemach.name}">
                                        📞 {gemach.phone}
                                    </a>
                                {/if}
                                {#if gemach.link}
                                    <a href={gemach.link} target="_blank" rel="noopener noreferrer" class="relative z-10 inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors">
                                        🔗 קישור
                                    </a>
                                {/if}
                                <a href="/gemach/{gemach.id}" class="relative z-10 inline-flex items-center gap-1 text-sm font-bold text-gray-300 hover:text-white transition-colors">
                                    לפרטים ←
                                </a>
                            </div>
                        </div>
                    </div>
                </article>
            {/each}
        </div>

        <!-- עימוד ממוספר בתחתית -->
        {#if data.pages > 1}
            <nav class="flex flex-wrap items-center justify-center gap-1.5 pt-8" aria-label="עימוד">
                {#if data.page > 1}
                    <a href={pageHref(data.page - 1)} class="rounded-lg bg-[#16264d] hover:bg-[#243a6e] px-3 py-2 text-sm font-bold text-white transition-colors">→ הקודם</a>
                {/if}
                {#each pageNumbers as n}
                    {#if n === '…'}
                        <span class="px-2 py-2 text-sm text-gray-400">…</span>
                    {:else if n === data.page}
                        <span class="min-w-[2.25rem] text-center rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-3 py-2 text-sm font-black text-white shadow-lg" aria-current="page">{n}</span>
                    {:else}
                        <a href={pageHref(n)} class="min-w-[2.25rem] text-center rounded-lg bg-[#16264d] hover:bg-[#243a6e] px-3 py-2 text-sm font-bold text-white transition-colors">{n}</a>
                    {/if}
                {/each}
                {#if data.page < data.pages}
                    <a href={pageHref(data.page + 1)} class="rounded-lg bg-[#16264d] hover:bg-[#243a6e] px-3 py-2 text-sm font-bold text-white transition-colors">הבא ←</a>
                {/if}
            </nav>
        {/if}
    {/if}
</section>
