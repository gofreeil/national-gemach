<script lang="ts">
    import { page as pageStore } from '$app/stores';
    import GemachCard from '$lib/components/GemachCard.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

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
            <!-- גלולה כהה — טקסט אפור ישירות על הרקע הוורוד אינו קריא -->
            <p class="mt-2 inline-block rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3 py-1 text-xs font-semibold text-gray-100 shadow-md">
                {data.total} גמ"חים במאגר · עמוד {data.page} מתוך {data.pages}
            </p>
        </div>
        <a href="/" class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 shadow-md hover:bg-[#2a4379] hover:text-white transition-colors">→ חזרה לדף הבית</a>
    </div>

    {#if data.items.length === 0}
        <div class="text-center py-16 text-gray-300">
            <div class="text-5xl mb-4" aria-hidden="true">📭</div>
            <p class="text-lg font-bold">אין גמ"חים להצגה</p>
        </div>
    {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each data.items as gemach (gemach.id)}
                <GemachCard {gemach} categories={data.categories} heading="h2" />
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
                        <span class="px-2 py-2 text-sm font-bold text-gray-100">…</span>
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
