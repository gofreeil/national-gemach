<script lang="ts">
    import { enhance } from '$app/forms';
    import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';

    let { data, form } = $props();
    let saving = $state(false);
    let deleting = $state(false);
    let confirmDelete = $state(false);

    // בעריכה: אם הייתה שגיאה נשתמש בערכים שהוזנו, אחרת בגמ"ח מה-DB
    const initial = $derived(form?.values ?? data.gemach);
</script>

<svelte:head><title>עריכת {data.gemach.name} – פאנל ניהול</title></svelte:head>

<div class="max-w-3xl">
    <div class="flex items-center justify-between mb-4">
        <h2 class="text-xl font-black text-white">✏️ עריכת גמ"ח</h2>
        <a href="/admin/gemachim" class="text-sm text-gray-400 hover:text-white">→ לרשימה</a>
    </div>

    {#if form?.error}
        <div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
    {/if}

    <form method="POST" action="?/update" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}
        class="card p-5 md:p-6">
        <GemachFormFields gemach={initial} categories={data.categories} cities={data.cities} />

        <div class="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-white/10">
            <button type="submit" disabled={saving}
                class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                {saving ? 'שומר...' : 'שמור שינויים'}
            </button>
            <a href="/admin/gemachim" class="rounded-xl bg-white/10 hover:bg-white/20 px-6 py-3 font-bold text-white transition-colors">ביטול</a>
            <span class="flex-1"></span>
            {#if !confirmDelete}
                <button type="button" onclick={() => confirmDelete = true}
                    class="rounded-xl bg-red-900/40 border border-red-500/30 text-red-300 px-5 py-3 font-bold hover:bg-red-900/60 transition-colors">
                    🗑️ מחיקה
                </button>
            {/if}
        </div>
    </form>

    {#if confirmDelete}
        <div class="mt-4 card p-5 border-red-500/30 bg-red-500/5">
            <p class="text-red-200 font-bold mb-1">למחוק את "{data.gemach.name}"?</p>
            <p class="text-sm text-gray-400 mb-4">הגמ"ח יימחק לצמיתות מהמאגר — כולל מאתר "קהילה בשכונה". לא ניתן לשחזר.</p>
            <div class="flex items-center gap-3">
                <form method="POST" action="?/delete" use:enhance={() => { deleting = true; return async ({ update }) => { await update(); deleting = false; }; }}>
                    <button type="submit" disabled={deleting}
                        class="rounded-xl bg-red-600 hover:bg-red-500 px-6 py-3 font-bold text-white transition-colors disabled:opacity-60">
                        {deleting ? 'מוחק...' : 'כן, מחק לצמיתות'}
                    </button>
                </form>
                <button type="button" onclick={() => confirmDelete = false}
                    class="rounded-xl bg-white/10 hover:bg-white/20 px-6 py-3 font-bold text-white transition-colors">ביטול</button>
            </div>
        </div>
    {/if}
</div>
