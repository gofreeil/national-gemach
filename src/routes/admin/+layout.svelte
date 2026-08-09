<script lang="ts">
    import { page } from '$app/stores';
    import { goto } from '$app/navigation';
    import { adminNav, type AdminNavRole } from '$lib/adminNav';
    let { children, data } = $props();

    const role = $derived(data.admin.role as AdminNavRole);
    const isSuper = $derived(role === 'super_admin');
    // הבעלים בלבד — לא כל סופר-אדמין
    const isOwner = $derived(Boolean(data.admin.owner));

    // אותה רשימה בדיוק שמוצגת פרוסה באזור האישי (/profile#admin)
    const nav = $derived(adminNav(role, isOwner));

    function active(href: string, exact: boolean, current: string) {
        return exact ? current === href : (current === href || current.startsWith(href + '/'));
    }

    // חזרה דף אחורה. אם אין היסטוריה (כניסה ישירה לכתובת) — נופלים לעמוד הפאנל הראשי.
    function goBack() {
        if (typeof history !== 'undefined' && history.length > 1) history.back();
        else goto('/admin');
    }
</script>

<svelte:head><title>פאנל ניהול – הגמ"ח הארצי</title></svelte:head>

<div dir="rtl" class="min-h-screen">
    <div class="mx-auto max-w-6xl px-3 sm:px-5 py-6">
        <!-- כותרת -->
        <div class="flex flex-wrap items-center justify-between gap-3 mb-6">
            <div class="flex items-center gap-3">
                <span class="text-3xl" aria-hidden="true">🛠️</span>
                <div>
                    <h1 class="text-2xl font-black text-white">פאנל ניהול</h1>
                    <!-- גלולה כהה — טקסט אפור ישירות על הרקע הוורוד אינו קריא -->
                    <p class="mt-1 inline-block rounded-full border border-[#3b5794] bg-[#1c2f5a] px-2.5 py-0.5 text-xs font-semibold text-gray-100 shadow-md">
                        {data.admin.user.name || data.admin.user.email}
                        <span class="mx-1">·</span>
                        {#if isSuper}
                            <span class="text-amber-300 font-bold">סופר-אדמין ★</span>
                        {:else}
                            <span class="text-emerald-300 font-bold">אדמין</span>
                        {/if}
                    </p>
                </div>
            </div>
            <div class="flex items-center gap-2">
                <button
                    type="button"
                    onclick={goBack}
                    class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 shadow-md hover:bg-[#2a4379] hover:text-white transition-colors"
                >↩ חזור</button>
                <a href="/" class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 shadow-md hover:bg-[#2a4379] hover:text-white transition-colors">← חזרה לאתר</a>
            </div>
        </div>

        <!-- ניווט -->
        <nav class="flex flex-wrap gap-2 mb-6 border-b border-[#3b5794] pb-4">
            {#each nav as item (item.href)}
                <a
                    href={item.href}
                    class="flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-bold transition-all
                        {active(item.href, item.exact, $page.url.pathname)
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg'
                            : 'bg-[#16264d] text-gray-300 hover:bg-[#213569] hover:text-white'}"
                >
                    <span aria-hidden="true">{item.icon}</span>
                    <span>{item.label}</span>
                </a>
            {/each}
        </nav>

        <!-- תוכן — משטח כהה קבוע. רקע האתר הוא גרדיאנט ורוד בהיר, וכל טקסט-שירות
             של הפאנל שיושב בין הכרטיסים (הסברים, מונים, עימוד) היה בלתי-קריא עליו.
             הפאנל הזה מבטיח שכל תוכן האדמין נמצא על רקע כהה — בלי לעטוף כל שורה בנפרד. -->
        <div class="admin-content rounded-2xl border border-[#3b5794] bg-[#101d3d]/95 p-4 sm:p-5 shadow-xl">
            {@render children()}
        </div>
    </div>
</div>

<style>
    .admin-content :global(.card) {
        background: #16264d;
        border: 1px solid #3b5794;
        border-radius: 1rem;
    }
</style>
