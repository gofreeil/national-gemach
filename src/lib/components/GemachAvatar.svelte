<script lang="ts">
    import type { Gemach, CategoryDef } from '$lib/gemachData';

    let {
        gemach,
        categories = []
    }: {
        gemach: Pick<Gemach, 'category' | 'icon' | 'image'>;
        categories?: CategoryDef[];
    } = $props();

    // קישור שבור לא משאיר ריבוע ריק — נופלים חזרה לאימוג'י של הפריט/הקטגוריה
    let broken = $state(false);

    const src = $derived(broken ? undefined : gemach.image);
    const fallbackIcon = $derived(
        gemach.icon || categories.find(c => c.key === gemach.category)?.icon || '📦'
    );
</script>

{#if src}
    <img
        {src}
        alt=""
        loading="lazy"
        decoding="async"
        onerror={() => (broken = true)}
        class="w-11 h-11 rounded-xl object-cover border border-[#3b5794] bg-[#0f1c3d]"
    />
{:else if gemach.category === 'judaism'}
    <img src="/icons/menorah.svg" alt="" class="w-9 h-9 object-contain" />
{:else}
    <span class="text-3xl leading-none">{fallbackIcon}</span>
{/if}
