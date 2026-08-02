<script lang="ts">
    import { enhance } from '$app/forms';

    let { data, form } = $props();
    let busy = $state('');

    const pending = $derived(data.claims.filter((c) => c.status === 'pending'));
    const decided = $derived(data.claims.filter((c) => c.status !== 'pending'));

    function timeAgo(iso: string): string {
        const ts = Date.parse(iso);
        if (Number.isNaN(ts)) return '';
        const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
        if (mins < 1) return 'עכשיו';
        if (mins < 60) return `לפני ${mins} דק׳`;
        const hours = Math.round(mins / 60);
        if (hours < 24) return `לפני ${hours} שע׳`;
        const days = Math.round(hours / 24);
        return days === 1 ? 'לפני יום' : `לפני ${days} ימים`;
    }
</script>

<svelte:head><title>תביעות בעלות – פאנל ניהול</title></svelte:head>

<div class="space-y-5">
    <h2 class="text-xl font-black text-white">🤝 תביעות בעלות</h2>
    <p class="text-sm text-gray-400">
        משתמשים שזיהו גמ"ח שלהם וביקשו עליו בעלות. אישור מעביר את הגמ"ח לבעלותם — ומאותו רגע הם יכולים לערוך אותו בעצמם.
    </p>

    {#if form?.message}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{form.message}</div>{/if}
    {#if form?.error}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{form.error}</div>{/if}
    {#if data.backendUnavailable}<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">לא הצלחנו לטעון את הבקשות כרגע. רעננו בעוד רגע.</div>{/if}

    <!-- ממתינות -->
    <section class="card p-5">
        <h3 class="font-bold text-white mb-3">ממתינות לאישור ({pending.length})</h3>
        {#if pending.length === 0}
            <p class="text-sm text-gray-400">אין כרגע בקשות שממתינות לאישור. 🎉</p>
        {:else}
            <div class="space-y-2">
                {#each pending as c (c.id)}
                    <div class="rounded-xl bg-[#16264d] p-3">
                        <div class="flex flex-wrap items-start justify-between gap-3">
                            <div class="min-w-0">
                                <a href={`/gemach/${c.gemachId}`} target="_blank" rel="noopener" class="font-bold text-white hover:text-blue-300">{c.gemachName}</a>
                                <div class="mt-1 text-xs text-gray-400">
                                    מבקש:
                                    <span class="text-gray-200" dir="ltr">{c.submittedBy.name || c.submittedBy.email || 'ללא שם'}</span>
                                    {#if c.submittedBy.email}<span dir="ltr"> · {c.submittedBy.email}</span>{/if}
                                    {#if c.submittedBy.phone}<span dir="ltr"> · 📞 {c.submittedBy.phone}</span>{/if}
                                    <span> · {timeAgo(c.submittedAt)}</span>
                                </div>
                            </div>
                            <div class="flex flex-shrink-0 items-center gap-2">
                                <form method="POST" action="?/approve" use:enhance={() => { busy = c.id; return async ({ update }) => { await update(); busy = ''; }; }}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <button type="submit" disabled={busy === c.id}
                                        class="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90 disabled:opacity-60">
                                        {busy === c.id ? '...' : '✓ אשר והעבר בעלות'}
                                    </button>
                                </form>
                                <form method="POST" action="?/reject"
                                    use:enhance={({ cancel }) => { if (!confirm(`לדחות את הבקשה של ${c.submittedBy.email || c.submittedBy.name}?`)) return cancel(); busy = c.id; return async ({ update }) => { await update(); busy = ''; }; }}>
                                    <input type="hidden" name="id" value={c.id} />
                                    <button type="submit" disabled={busy === c.id}
                                        class="rounded-lg bg-red-900/30 px-3 py-2 text-sm font-bold text-red-300 transition hover:bg-red-900/60 disabled:opacity-60">
                                        דחה
                                    </button>
                                </form>
                            </div>
                        </div>
                    </div>
                {/each}
            </div>
        {/if}
    </section>

    <!-- היסטוריה -->
    {#if decided.length > 0}
        <section class="card p-5">
            <h3 class="font-bold text-white mb-3">היסטוריה ({decided.length})</h3>
            <div class="space-y-1.5">
                {#each decided as c (c.id)}
                    <div class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg bg-[#16264d]/60 px-3 py-2 text-sm">
                        <span class="rounded-full px-2 py-0.5 text-xs font-bold {c.status === 'approved' ? 'bg-emerald-500/15 text-emerald-300' : 'bg-red-500/15 text-red-300'}">
                            {c.status === 'approved' ? '✓ אושר' : '✕ נדחה'}
                        </span>
                        <span class="font-bold text-white">{c.gemachName}</span>
                        <span class="text-xs text-gray-400" dir="ltr">{c.submittedBy.email || c.submittedBy.name}</span>
                        {#if c.decidedBy}<span class="text-xs text-gray-500">· ע"י {c.decidedBy}</span>{/if}
                        {#if c.rejectionReason}<span class="text-xs text-red-300/80">· {c.rejectionReason}</span>{/if}
                    </div>
                {/each}
            </div>
        </section>
    {/if}
</div>
