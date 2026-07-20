<script lang="ts">
    import { enhance } from '$app/forms';
    import { page } from '$app/stores';

    let { data, form } = $props();
    const flash = $derived($page.url.searchParams.get('flash'));
    const flashText: Record<string, string> = {
        added: '✅ האדמין נוסף',
        removed: '🗑️ האדמין הוסר',
        updated: '✅ התפקיד עודכן'
    };

    const typeLabel: Record<string, string> = { email: 'מייל', username: 'שם משתמש', phone: 'טלפון' };
    let saving = $state(false);
</script>

<svelte:head><title>ניהול אדמינים – פאנל ניהול</title></svelte:head>

<div class="max-w-3xl space-y-5">
    <h2 class="text-xl font-black text-white">🔑 ניהול אדמינים</h2>

    {#if flash && flashText[flash]}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{flashText[flash]}</div>{/if}
    {#if form?.error}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{form.error}</div>{/if}

    <!-- הוספה -->
    <div class="card p-5">
        <h3 class="font-bold text-white mb-3">➕ הוספת אדמין</h3>
        <form method="POST" action="?/add" use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}
            class="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2">
            <div>
                <input name="identifier" required placeholder="מייל / שם משתמש / מספר טלפון"
                    class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
                <input name="display" placeholder="שם לתצוגה (לא חובה)"
                    class="w-full mt-2 rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-2.5 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
            </div>
            <select name="role" class="rounded-xl border border-[#3b5794] bg-[#1e293b] px-3 py-2.5 text-white focus:border-purple-500 focus:outline-none h-fit">
                <option value="admin">אדמין</option>
                <option value="super_admin">סופר-אדמין</option>
            </select>
            <button type="submit" disabled={saving}
                class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-2.5 font-bold text-white transition hover:opacity-90 disabled:opacity-60 h-fit">
                {saving ? '...' : 'הוסף'}
            </button>
        </form>
        <p class="text-xs text-gray-500 mt-2">הסוג (מייל/משתמש/טלפון) מזוהה אוטומטית. הזיהוי בהתחברות משווה מול המייל, שם המשתמש או הטלפון של המשתמש.</p>
    </div>

    <!-- רשימת אדמינים ב-DB -->
    <div class="card p-5">
        <h3 class="font-bold text-white mb-3">אדמינים מנוהלים ({data.admins.length})</h3>
        {#if data.admins.length === 0}
            <p class="text-sm text-gray-400">אין עדיין אדמינים ברשימת ה-DB. השתמש בטופס למעלה כדי להוסיף.</p>
        {:else}
            <div class="space-y-2">
                {#each data.admins as a (a.id)}
                    <div class="flex flex-wrap items-center gap-2 rounded-xl bg-[#16264d] px-3 py-2.5">
                        <span class="text-lg" aria-hidden="true">{a.role === 'super_admin' ? '★' : '👤'}</span>
                        <div class="flex-1 min-w-0">
                            <div class="text-white font-bold truncate" dir="ltr">{a.identifier}</div>
                            <div class="text-xs text-gray-500">
                                {typeLabel[a.type] ?? a.type}
                                {#if a.label} · {a.label}{/if}
                            </div>
                        </div>
                        <form method="POST" action="?/setRole" use:enhance>
                            <input type="hidden" name="id" value={a.id} />
                            <select name="role" onchange={(e) => (e.currentTarget.form as HTMLFormElement).requestSubmit()}
                                class="rounded-lg border border-[#3b5794] bg-[#1e293b] px-2 py-1.5 text-sm text-white focus:outline-none">
                                <option value="admin" selected={a.role === 'admin'}>אדמין</option>
                                <option value="super_admin" selected={a.role === 'super_admin'}>סופר-אדמין</option>
                            </select>
                        </form>
                        <form method="POST" action="?/remove" use:enhance={({ cancel }) => { if (!confirm(`להסיר את ${a.identifier} מרשימת האדמינים?`)) cancel(); }}>
                            <input type="hidden" name="id" value={a.id} />
                            <button class="w-8 h-8 rounded-lg bg-red-900/30 text-red-300 hover:bg-red-900/60 transition-colors" title="הסר">🗑️</button>
                        </form>
                    </div>
                {/each}
            </div>
        {/if}
    </div>

    <!-- bootstrap מהסביבה -->
    <div class="card p-5">
        <h3 class="font-bold text-white mb-1">🔒 מוגדרים בסביבה (ENV)</h3>
        <p class="text-xs text-gray-500 mb-3">קבועים מתוך משתני הסביבה בשרת — תמיד פעילים, לא ניתנים לעריכה מכאן. מבטיחים גישה גם כשה-DB ריק.</p>
        {#if data.bootstrap.superAdmins.length}
            <div class="mb-2">
                <span class="text-xs text-amber-300 font-bold">סופר-אדמין:</span>
                <div class="flex flex-wrap gap-1.5 mt-1">
                    {#each data.bootstrap.superAdmins as v (v)}<span class="text-xs bg-amber-500/10 border border-amber-500/20 text-amber-200 px-2 py-0.5 rounded" dir="ltr">{v}</span>{/each}
                </div>
            </div>
        {/if}
        {#if data.bootstrap.admins.length}
            <div>
                <span class="text-xs text-emerald-300 font-bold">אדמין:</span>
                <div class="flex flex-wrap gap-1.5 mt-1">
                    {#each data.bootstrap.admins as v (v)}<span class="text-xs bg-emerald-500/10 border border-emerald-500/20 text-emerald-200 px-2 py-0.5 rounded" dir="ltr">{v}</span>{/each}
                </div>
            </div>
        {/if}
        <p class="text-xs text-gray-500 mt-3">להוספה/שינוי: משתני הסביבה <code class="text-gray-400">NG_SUPER_ADMINS</code> / <code class="text-gray-400">NG_ADMINS</code> (מופרדים בפסיק).</p>
    </div>
</div>
