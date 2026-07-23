<script lang="ts">
    import { goto } from '$app/navigation';

    type Crumb = { label: string; href?: string };

    let {
        crumbs,
        fallback = '/'
    }: {
        crumbs: Crumb[];
        /** יעד חלופי לכפתור החזרה כשאין היסטוריית ניווט (נחיתה ישירה על הדף) */
        fallback?: string;
    } = $props();

    /** חזרה לדף הקודם; אם המשתמש נחת ישירות (אין היסטוריה) — ליעד החלופי */
    function goBack() {
        if (typeof history !== 'undefined' && history.length > 1) history.back();
        else goto(fallback);
    }
</script>

<!-- סרגל ניווט עליון. הרקע הוורוד לא נותן ניגודיות לטקסט אפור — לכן גלולה כהה
     (כמו באנר הסטטיסטיקה ורמז המסילה), וכך גם כפתור החזרה וגם פירורי הלחם קריאים. -->
<div class="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-2 shadow-md">
    <button
        type="button"
        onclick={goBack}
        class="inline-flex items-center gap-1 text-sm font-bold text-gray-100 transition-colors hover:text-white focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 rounded"
        aria-label="חזרה לדף הקודם"
    >
        <svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor"
             stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
            <path d="M9 6l6 6-6 6" />
        </svg>
        <span>חזרה</span>
    </button>

    <span class="h-4 w-px bg-[#3b5794]" aria-hidden="true"></span>

    <nav class="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-sm text-gray-200 min-w-0" aria-label="ניווט">
        {#each crumbs as crumb, i (i)}
            {#if crumb.href}
                <a href={crumb.href} class="hover:text-white transition-colors">{crumb.label}</a>
            {:else}
                <span class="font-bold text-white">{crumb.label}</span>
            {/if}
            {#if i < crumbs.length - 1}
                <span class="text-gray-400" aria-hidden="true">›</span>
            {/if}
        {/each}
    </nav>
</div>
