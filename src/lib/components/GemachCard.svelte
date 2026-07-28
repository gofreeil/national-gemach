<script lang="ts">
    // ============================================================
    // GemachCard.svelte — הבאנר של גמ"ח ברשימות (דף הבית, /gemachim)
    // ------------------------------------------------------------
    // שלושה כללים שהבאנר מקיים:
    //   1. תמונה גדולה בצד שמאל, בגובה כל הכרטיס — היא הדבר הראשון שנראה.
    //   2. בלי טלפון. הטלפון נחשף רק בעמוד הגמ"ח, אחרי "גלה טלפון" (פרסומת).
    //   3. כל הבאנר הוא קישור אחד לעמוד הגמ"ח, דרך gatedNav — כלומר כל
    //      לחיצה עוברת קודם בפרסומת-הביניים. אין קישורים מתחרים בפנים.
    // ============================================================
    import GemachAvatar from './GemachAvatar.svelte';
    import AdminGemachMenu from './AdminGemachMenu.svelte';
    import VerifiedStamp from './VerifiedStamp.svelte';
    import { gatedNav } from '$lib/adGate';
    import type { ListGemach, CategoryDef } from '$lib/gemachData';

    let {
        gemach,
        categories = [],
        pinned = false,
        heading = 'h3'
    }: {
        /** הצורה הציבורית — בלי טלפון (הוא נחשף רק בעמוד הגמ"ח) */
        gemach: ListGemach;
        categories?: CategoryDef[];
        /** גמ"ח נעוץ — מסגרת זהב ואייקון 📌 */
        pinned?: boolean;
        /** דרגת הכותרת, לפי היררכיית הכותרות של העמוד המשתמש */
        heading?: 'h2' | 'h3';
    } = $props();

    const href = $derived(`/gemach/${gemach.id}`);

    const categoryLabel = $derived(
        categories.find(c => c.key === gemach.category)?.label ?? gemach.category
    );

    // אין כאן טיפול בטלפון: הרשימות מגיעות מהשרת בלי טלפון ובלי מספרים
    // שנכתבו בתוך הטקסט (toListItem ב-gemachSource.ts).
</script>

<!-- בלי overflow-hidden — התפריט הנפתח של האדמין חייב לגלוש מחוץ לכרטיס;
     פינות התמונה מעוגלות ממילא בקונטיינר פנימי משלה -->
<article
    class="relative rounded-2xl border {pinned
        ? 'border-amber-500/30'
        : 'border-[#3b5794]'} bg-[#16264d] transition-all hover:border-[#4c6cb0] hover:bg-[#1e3260]"
>
    <!-- כפתור ניהול לאדמין — צף מעל הקישור של הכרטיס, בפינת התמונה -->
    <div class="absolute left-2 top-2 z-20">
        <AdminGemachMenu {gemach} />
    </div>

    <a {href} onclick={(e) => gatedNav(e, href)} class="group flex items-stretch gap-4 p-4">
        <div class="min-w-0 flex-1">
            <svelte:element
                this={heading}
                class="text-lg font-black leading-tight text-white transition-colors group-hover:text-blue-300"
            >
                {#if pinned}<span class="text-sm text-amber-400" aria-hidden="true">📌</span> {/if}{gemach.name}
            </svelte:element>

            <div class="mt-1 flex flex-wrap items-center gap-2">
                {#if gemach.verified}<VerifiedStamp />{/if}
                <span class="rounded-full border border-blue-500/30 bg-blue-900/50 px-2 py-0.5 text-xs text-blue-300">
                    {categoryLabel}
                </span>
                <span class="text-xs text-gray-400">
                    📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                </span>
            </div>

            {#if gemach.description}
                <p class="mt-2 line-clamp-3 text-sm leading-relaxed text-gray-300">{gemach.description}</p>
            {/if}
            {#if gemach.contact}
                <p class="mt-2 line-clamp-1 text-xs text-gray-400">👤 {gemach.contact}</p>
            {/if}
            {#if gemach.notes}
                <p class="mt-1 line-clamp-2 text-xs text-amber-300/80">💬 {gemach.notes}</p>
            {/if}
        </div>

        <!-- ב-RTL האיבר האחרון יושב בצד שמאל — שם התמונה הגדולה -->
        <div
            class="flex min-h-[150px] w-2/5 max-w-[210px] flex-shrink-0 items-center justify-center self-stretch overflow-hidden rounded-xl border border-[#3b5794] bg-[#0f1c3d]"
        >
            <GemachAvatar {gemach} {categories} banner />
        </div>
    </a>
</article>
