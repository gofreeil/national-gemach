<script lang="ts">
    import { page } from '$app/stores';
</script>

<svelte:head><title>שגיאה – פאנל ניהול</title></svelte:head>

<div dir="rtl" class="min-h-[70vh] flex items-center justify-center px-4">
    <div class="w-full max-w-md rounded-3xl border border-[#3b5794] bg-[#16264d] p-8 text-center">
        <div class="text-5xl mb-4" aria-hidden="true">
            {$page.status === 403 ? '🚫' : '⚠️'}
        </div>
        <h1 class="text-2xl font-black text-white mb-2">
            {$page.status === 403 ? 'אין הרשאת גישה' : 'משהו השתבש'}
        </h1>
        <p class="text-gray-400 text-sm mb-6">
            {$page.error?.message || 'שגיאה לא צפויה'}
        </p>
        <div class="flex items-center justify-center gap-3">
            <a href="/" class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-5 py-2.5 text-sm font-bold text-white transition-colors">
                חזרה לאתר
            </a>
            {#if $page.status === 403}
                <a href="/login?redirect=/admin" class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-90">
                    התחברות עם חשבון אחר
                </a>
            {/if}
        </div>
    </div>
</div>
