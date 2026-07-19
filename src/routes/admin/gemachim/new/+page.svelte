<script lang="ts">
    import { enhance } from '$app/forms';
    import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';

    let { data, form } = $props();
    let saving = $state(false);
</script>

<svelte:head><title>הוספת גמ"ח – פאנל ניהול</title></svelte:head>

<div class="max-w-3xl">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-black text-white">➕ הוספת גמ"ח חדש</h2>
        <a href="/admin/gemachim" class="text-sm text-gray-400 hover:text-white">→ לרשימה</a>
    </div>

    {#if form?.error}
        <div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
    {/if}

    <form method="POST" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}
        class="card p-5 md:p-6">
        <GemachFormFields gemach={form?.values ?? null} categories={data.categories} cities={data.cities} />

        <div class="flex items-center gap-3 mt-6 pt-5 border-t border-white/10">
            <button type="submit" disabled={saving}
                class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                {saving ? 'שומר...' : 'שמור גמ"ח'}
            </button>
            <a href="/admin/gemachim" class="rounded-xl bg-white/10 hover:bg-white/20 px-6 py-3 font-bold text-white transition-colors">ביטול</a>
        </div>
    </form>
</div>
