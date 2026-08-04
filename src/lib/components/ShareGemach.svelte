<script lang="ts">
    // ============================================================
    // ShareGemach.svelte — כפתור "שתף" של גמ"ח
    // ------------------------------------------------------------
    // לחיצה פותחת תפריט של האפליקציות הנפוצות (וואטסאפ, טלגרם, פייסבוק,
    // SMS, מייל), ובמכשירים שתומכים בשיתוף מובנה גם "כל האפליקציות…"
    // שפותח את מגש השיתוף של המכשיר עם כל מה שמותקן עליו.
    //
    // ההודעה עצמה נבנית ב-$lib/share: שם הגמ"ח, הנושא, המקום, תקציר בלי
    // טלפון, כתובת דף הגמ"ח ומשפט שקורא להשתמש במאגר הארצי. התמונה
    // מגיעה מהתצוגה המקדימה של הקישור (תגי og של דף הגמ"ח).
    // ============================================================
    import {
        SHARE_TARGETS,
        sharePartsFor,
        gemachShareMessage,
        type ShareGemachInfo,
    } from '$lib/share';

    let {
        gemach,
        categoryLabel = '',
        place = '',
    }: {
        /** רק מה שנכנס להודעה — עובד גם עם Gemach וגם עם ListGemach */
        gemach: { id: string; name: string; description?: string };
        categoryLabel?: string;
        place?: string;
    } = $props();

    const info = $derived<ShareGemachInfo>({
        id: gemach.id,
        name: gemach.name,
        description: gemach.description,
        categoryLabel,
        place,
    });

    let open = $state(false);
    let copied = $state(false);
    let wrapper: HTMLDivElement | undefined = $state();

    /** שיתוף מובנה קיים כמעט רק בנייד — בלעדיו מציגים רק את הקישורים הישירים */
    let canNativeShare = $state(false);
    $effect(() => {
        canNativeShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function';
    });

    function track(method: string) {
        const w = window as unknown as { gtag?: (...a: unknown[]) => void };
        w.gtag?.('event', 'share', { method, gemach_id: gemach.id, gemach_name: gemach.name });
    }

    async function nativeShare() {
        const p = sharePartsFor(info, 'share');
        open = false;
        track('native');
        try {
            // הכתובת נשלחת בשדה url ולכן אינה נכנסת גם לגוף ההודעה —
            // אפליקציית היעד מחברת אותן בעצמה, וכך אין כתובת כפולה.
            await navigator.share({ title: p.title, text: gemachShareMessage(info), url: p.url });
        } catch {
            /* המשתמש ביטל את מגש השיתוף — אין מה לעשות */
        }
    }

    async function copyMessage() {
        const p = sharePartsFor(info, 'copy');
        track('copy');
        try {
            await navigator.clipboard.writeText(p.textWithUrl);
            copied = true;
            setTimeout(() => (copied = false), 2000);
        } catch {
            prompt('העתיקו את ההודעה:', p.textWithUrl);
        }
    }

    function onWindowClick(e: MouseEvent) {
        if (open && wrapper && !wrapper.contains(e.target as Node)) open = false;
    }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => { if (e.key === 'Escape') open = false; }} />

<div class="relative" bind:this={wrapper}>
    <button
        type="button"
        onclick={(e) => { e.stopPropagation(); open = !open; }}
        class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-[#2a4379]"
        aria-haspopup="menu"
        aria-expanded={open}
    >
        📤 שתף
    </button>

    {#if open}
        <div
            class="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-[#3b5794] bg-[#0f1c3d] py-1 text-sm shadow-2xl"
            role="menu"
        >
            <p class="px-3 py-1.5 text-[11px] leading-snug text-gray-400">
                השיתוף כולל את התמונה והפרטים — בלי הטלפון
            </p>

            {#each SHARE_TARGETS as t (t.key)}
                {@const p = sharePartsFor(info, t.key)}
                <a
                    href={t.href(p)}
                    target="_blank"
                    rel="noopener noreferrer"
                    role="menuitem"
                    onclick={() => { track(t.key); open = false; }}
                    class="flex items-center gap-2 px-3 py-2 text-gray-200 transition-colors hover:bg-[#1c2f5a]"
                >{t.icon} {t.label}</a>
            {/each}

            {#if canNativeShare}
                <button
                    type="button"
                    role="menuitem"
                    onclick={nativeShare}
                    class="flex w-full items-center gap-2 px-3 py-2 text-right text-gray-200 transition-colors hover:bg-[#1c2f5a]"
                >📲 כל האפליקציות…</button>
            {/if}

            <div class="my-1 border-t border-[#3b5794]"></div>

            <button
                type="button"
                role="menuitem"
                onclick={copyMessage}
                class="flex w-full items-center gap-2 px-3 py-2 text-right transition-colors hover:bg-[#1c2f5a] {copied
                    ? 'text-emerald-300'
                    : 'text-gray-200'}"
            >{copied ? '✅ ההודעה הועתקה' : '📋 העתקת ההודעה'}</button>
        </div>
    {/if}
</div>
