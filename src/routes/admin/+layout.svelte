<script lang="ts">
    import { page } from '$app/stores';
    let { children, data } = $props();

    const role = $derived(data.admin.role as 'super_admin' | 'admin');
    const isSuper = $derived(role === 'super_admin');

    const nav = $derived([
        { href: '/admin',            label: 'סקירה',       icon: '📊', exact: true },
        { href: '/admin/gemachim',   label: 'גמ"חים',      icon: '🤝', exact: false },
        { href: '/admin/gemachim/new', label: 'הוספת גמ"ח', icon: '➕', exact: true },
        { href: '/admin/categories', label: 'קטגוריות',    icon: '🏷️', exact: false },
        { href: '/admin/import',     label: 'ייבוא נתונים', icon: '📥', exact: false },
        ...(isSuper ? [{ href: '/admin/admins', label: 'ניהול אדמינים', icon: '🔑', exact: false }] : []),
    ]);

    function active(href: string, exact: boolean, current: string) {
        return exact ? current === href : (current === href || current.startsWith(href + '/'));
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
                    <p class="text-xs text-gray-400">
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
            <a href="/" class="text-sm text-gray-400 hover:text-white transition-colors">← חזרה לאתר</a>
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

        <!-- תוכן -->
        <div class="admin-content">
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
