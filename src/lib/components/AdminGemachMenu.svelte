<script lang="ts">
    // ============================================================
    // AdminGemachMenu.svelte — כפתור ניהול קטן עם תפריט נפתח על כל גמ"ח
    // ------------------------------------------------------------
    // מוצג רק לאדמין מחובר (adminRole מה-layout) ורק על פריטים מנוהלים
    // ב-Strapi. מאפשר "על המקום", בלי להיכנס לפאנל:
    //   ✏️ עריכה · ✅ פרסום / 📝 החזרה לטיוטה · 🏅 חותמת "מאושר" ·
    //   📌 נעיצה בראש דף הבית · 🗑️ מחיקה
    // הפעולות עוברות דרך POST /api/admin/gemachim/[id] (מאומת בשרת).
    // ============================================================
    import { page } from '$app/stores';
    import { invalidateAll, goto } from '$app/navigation';

    let {
        gemach,
        redirectOnDelete
    }: {
        /** צריך רק את השדות האלה — עובד גם עם Gemach וגם עם ListGemach */
        gemach: {
            id: string;
            name: string;
            managed?: boolean;
            status?: string;
            verified?: boolean;
            featured?: boolean;
            sourceId?: string;
        };
        /** לאן לנווט אחרי מחיקה (בדף הגמ"ח עצמו — כי הדף כבר לא קיים) */
        redirectOnDelete?: string;
    } = $props();

    const isAdmin = $derived(Boolean($page.data.adminRole));
    const isDraft = $derived(gemach.status === 'draft');

    /** מזהי הנעוצים מה-layout (לאדמין בלבד). null = הרשימה מעולם לא נשמרה. */
    const pinnedIds = $derived($page.data.pinnedIds as string[] | null | undefined);

    // הבדיקה חוזרת על ההיגיון של getPinnedIdsResolved: רשימה שמורה קובעת,
    // ובהיעדרה נופלים חזרה לדגל featured הישן. גם sourceId נבדק — רשימה
    // שנשמרה לפני שפריט סטטי יובא ל-DB מצביעה על המזהה הסטטי שלו.
    const isPinned = $derived(
        Array.isArray(pinnedIds)
            ? pinnedIds.includes(gemach.id) || (!!gemach.sourceId && pinnedIds.includes(gemach.sourceId))
            : Boolean(gemach.featured)
    );

    let open = $state(false);
    let busy = $state(false);
    let wrapper: HTMLDivElement | undefined = $state();

    function onWindowClick(e: MouseEvent) {
        if (open && wrapper && !wrapper.contains(e.target as Node)) open = false;
    }

    async function run(action: 'publish' | 'draft' | 'verify' | 'unverify' | 'pin' | 'unpin' | 'delete') {
        if (busy) return;
        if (action === 'delete' && !confirm(`למחוק את "${gemach.name}"? הפעולה בלתי הפיכה.`)) return;
        busy = true;
        try {
            const res = await fetch(`/api/admin/gemachim/${gemach.id}`, {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ action })
            });
            if (!res.ok) {
                const body = await res.json().catch(() => null);
                alert(body?.message ?? 'הפעולה נכשלה — נסו שוב');
                return;
            }
            open = false;
            if (action === 'delete' && redirectOnDelete) await goto(redirectOnDelete);
            else await invalidateAll();
        } finally {
            busy = false;
        }
    }
</script>

<svelte:window onclick={onWindowClick} onkeydown={(e) => { if (e.key === 'Escape') open = false; }} />

{#if isAdmin && gemach.managed}
    <div class="relative" bind:this={wrapper}>
        <button
            type="button"
            onclick={(e) => { e.preventDefault(); e.stopPropagation(); open = !open; }}
            class="flex h-7 w-7 items-center justify-center rounded-full border border-[#4c6cb0] bg-[#0f1c3d]/90 text-sm text-gray-200 shadow-md transition-colors hover:bg-[#243a6e] {busy ? 'opacity-50' : ''}"
            title="ניהול הגמ&quot;ח (אדמין)"
            aria-label="תפריט ניהול עבור {gemach.name}"
            aria-expanded={open}
        >⚙️</button>

        {#if open}
            <div
                class="absolute left-0 top-8 z-30 w-48 overflow-hidden rounded-xl border border-[#3b5794] bg-[#0f1c3d] py-1 text-sm shadow-2xl"
                role="menu"
            >
                <a
                    href="/admin/gemachim/{gemach.id}"
                    role="menuitem"
                    class="flex items-center gap-2 px-3 py-2 text-gray-200 transition-colors hover:bg-[#1c2f5a]"
                    onclick={(e) => e.stopPropagation()}
                >✏️ עריכה</a>

                {#if isDraft}
                    <button type="button" role="menuitem" disabled={busy} onclick={() => run('publish')}
                        class="flex w-full items-center gap-2 px-3 py-2 text-right text-emerald-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                    >🚀 פרסם באתר</button>
                {:else}
                    <button type="button" role="menuitem" disabled={busy} onclick={() => run('draft')}
                        class="flex w-full items-center gap-2 px-3 py-2 text-right text-amber-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                    >📝 החזר לטיוטה</button>
                {/if}

                {#if gemach.verified}
                    <button type="button" role="menuitem" disabled={busy} onclick={() => run('unverify')}
                        class="flex w-full items-center gap-2 px-3 py-2 text-right text-gray-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                    >🏅 הסר חותמת "מאושר"</button>
                {:else}
                    <button type="button" role="menuitem" disabled={busy} onclick={() => run('verify')}
                        class="flex w-full items-center gap-2 px-3 py-2 text-right text-emerald-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                    >🏅 אשר — חותמת "מאושר"</button>
                {/if}

                <!-- נעיצה רק לפריט שמפורסם: טיוטה ממילא אינה על הלוח, והמאגר
                     שממנו pinGemach שולף אינו כולל טיוטות — הנעיצה הייתה נכשלת -->
                {#if !isDraft}
                    {#if isPinned}
                        <button type="button" role="menuitem" disabled={busy} onclick={() => run('unpin')}
                            class="flex w-full items-center gap-2 px-3 py-2 text-right text-gray-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                        >📌 הסר מהנעוצים</button>
                    {:else}
                        <button type="button" role="menuitem" disabled={busy} onclick={() => run('pin')}
                            class="flex w-full items-center gap-2 px-3 py-2 text-right text-amber-300 transition-colors hover:bg-[#1c2f5a] disabled:opacity-50"
                        >📌 נעץ לראש דף הבית</button>
                    {/if}
                {/if}

                <div class="my-1 border-t border-[#3b5794]"></div>

                <button type="button" role="menuitem" disabled={busy} onclick={() => run('delete')}
                    class="flex w-full items-center gap-2 px-3 py-2 text-right text-red-300 transition-colors hover:bg-red-900/40 disabled:opacity-50"
                >🗑️ מחק</button>
            </div>
        {/if}
    </div>
{/if}
