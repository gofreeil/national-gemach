<script lang="ts">
    import type { Gemach, CategoryDef } from '$lib/gemachData';

    let {
        gemach,
        categories = [],
        banner = false
    }: {
        gemach: Pick<Gemach, 'category' | 'icon' | 'image' | 'gallery'>;
        categories?: CategoryDef[];
        /** תצוגת באנר — התמונה ממלאת את כל המשבצת שההורה קובע (כרטיס גמ"ח) */
        banner?: boolean;
    } = $props();

    // קישור שבור לא משאיר ריבוע ריק — נופלים חזרה לאימוג'י של הפריט/הקטגוריה
    let broken = $state(false);

    const catDef = $derived(categories.find(c => c.key === gemach.category));

    // בבאנר התמונה היא עיקר הכרטיס, ולכן יש שרשרת נפילה ארוכה יותר:
    // לוגו → תמונה ראשונה בגלריה → תמונת-הנושא של הקטגוריה. כך בכל באנר
    // יש תמונה אמיתית ולא אימוג'י בודד על רקע ריק.
    const src = $derived(
        broken
            ? undefined
            : gemach.image || (banner ? (gemach.gallery?.[0] || catDef?.image) : undefined)
    );
    const fallbackIcon = $derived(gemach.icon || catDef?.icon || '📦');
</script>

{#if src}
    <img
        {src}
        alt=""
        loading="lazy"
        decoding="async"
        onerror={() => (broken = true)}
        class={banner
            ? 'w-full h-full object-cover'
            : 'w-11 h-11 rounded-xl object-cover border border-[#3b5794] bg-[#0f1c3d]'}
    />
{:else if gemach.category === 'judaism'}
    <img src="/icons/menorah.svg" alt="" class={banner ? 'w-20 h-20 object-contain' : 'w-9 h-9 object-contain'} />
{:else}
    <span class={banner ? 'text-6xl leading-none' : 'text-3xl leading-none'}>{fallbackIcon}</span>
{/if}
