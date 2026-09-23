<script lang="ts">
    import { enhance, deserialize } from '$app/forms';
    import { invalidateAll } from '$app/navigation';

    let { data, form } = $props();

    // svelte-ignore state_referenced_locally
    let template = $state(data.template);
    let filter = $state<'todo' | 'sent' | 'declined' | 'all'>('todo');
    let q = $state('');
    let selected = $state(new Set<string>());
    let testPhone = $state('');
    let busy = $state('');
    /** תוצאות השליחה בסשן הזה, לפי גמ"ח */
    let results = $state<Record<string, { ok: boolean; msg: string }>>({});
    let bulk = $state<{ running: boolean; done: number; total: number; stop: boolean }>({ running: false, done: 0, total: 0, stop: false });

    const sentOf = (id: string) => !!data.log[id]?.at || results[id]?.ok === true;
    const declinedOf = (id: string) => !!data.log[id]?.declinedAt;

    const counts = $derived({
        all: data.candidates.length,
        sent: data.candidates.filter((c) => sentOf(c.id) && !declinedOf(c.id)).length,
        declined: data.candidates.filter((c) => declinedOf(c.id)).length,
        todo: data.candidates.filter((c) => !sentOf(c.id) && !declinedOf(c.id)).length,
    });

    const shown = $derived(data.candidates.filter((c) => {
        if (filter === 'todo' && (sentOf(c.id) || declinedOf(c.id))) return false;
        if (filter === 'sent' && (!sentOf(c.id) || declinedOf(c.id))) return false;
        if (filter === 'declined' && !declinedOf(c.id)) return false;
        const s = q.trim();
        return !s || c.name.includes(s) || c.city.includes(s) || c.contact.includes(s) || c.phoneTail.includes(s);
    }));

    const sample = $derived(data.candidates[0]);
    const preview = $derived.by(() => {
        const name = sample?.contact ?? '';
        let s = template;
        s = name ? s.replace(/\{name\}/g, ` ${name}`).replace(/ {2,}/g, ' ') : s.replace(/\s?\{name\}/g, '');
        return s
            .replace(/\{gemach\}/g, sample?.name ?? 'גמ"ח לדוגמה')
            .replace(/\{link\}/g, `${data.origin}/c/${sample?.id ?? 'xxxxxxxxxx'}`)
            .replace(/\{decline\}/g, `${data.origin}/d/${sample?.id ?? 'xxxxxxxxxx'}.xxxxxxxxxxxx`)
            .trim();
    });
    // SMS בעברית: 70 תווים במקטע בודד, 67 במקטעים מרובים
    const segments = $derived(preview.length <= 70 ? 1 : Math.ceil(preview.length / 67));

    function toggle(id: string) {
        const next = new Set(selected);
        next.has(id) ? next.delete(id) : next.add(id);
        selected = next;
    }
    function selectShown() {
        const sendable = shown.filter((c) => !declinedOf(c.id)).map((c) => c.id);
        const allOn = sendable.every((id) => selected.has(id));
        selected = allOn ? new Set() : new Set(sendable);
    }

    async function sendOne(id: string, force: boolean): Promise<boolean> {
        const fd = new FormData();
        fd.set('id', id);
        fd.set('template', template);
        if (force) fd.set('force', '1');
        try {
            const res = await fetch('?/send', { method: 'POST', body: fd, headers: { 'x-sveltekit-action': 'true' } });
            const r = deserialize(await res.text());
            if (r.type === 'success') { results[id] = { ok: true, msg: 'נשלח ✓' }; return true; }
            const err = r.type === 'failure' ? String((r.data as { error?: string })?.error ?? 'נכשל') : 'נכשל';
            results[id] = { ok: false, msg: err };
        } catch {
            results[id] = { ok: false, msg: 'אין חיבור' };
        }
        return false;
    }

    async function sendSingle(id: string) {
        const force = sentOf(id);
        if (force && !confirm('כבר נשלחה הזמנה לגמ"ח הזה. לשלוח שוב?')) return;
        busy = id;
        await sendOne(id, force);
        busy = '';
    }

    async function sendSelected() {
        const ids = data.candidates.filter((c) => selected.has(c.id) && !declinedOf(c.id)).map((c) => c.id);
        if (!ids.length) return;
        const again = ids.filter(sentOf).length;
        const msg = `לשלוח SMS ל-${ids.length} גמ"חים?` + (again ? `\n(${again} מהם כבר קיבלו — יקבלו שוב)` : '');
        if (!confirm(msg)) return;
        bulk = { running: true, done: 0, total: ids.length, stop: false };
        for (const id of ids) {
            if (bulk.stop) break;
            await sendOne(id, sentOf(id));
            bulk.done++;
            // לא להציף את טלפון-השער / הספק
            await new Promise((r) => setTimeout(r, 1500));
        }
        bulk.running = false;
        selected = new Set();
        await invalidateAll();
    }

    function when(iso?: string): string {
        if (!iso) return '';
        const d = new Date(iso);
        return isNaN(d.getTime()) ? '' : d.toLocaleDateString('he-IL', { day: 'numeric', month: 'numeric', year: '2-digit' });
    }
</script>

<svelte:head><title>הזמנות SMS – פאנל ניהול</title></svelte:head>

<div class="space-y-5">
    <h2 class="text-xl font-black text-white">📨 הזמנות SMS לבעלי גמ"חים</h2>
    <p class="text-sm text-gray-400">
        שליחת SMS לכל גמ"ח באתר שעדיין אין לו בעלים: הקישור מוביל לכרטיס, שם הבעלים נרשם ומאמת בקוד לנייד שבכרטיס — והבעלות עוברת אליו מיד, בלי אישור ידני.
    </p>

    {#if !data.smsReady}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">שליחת SMS אינה מוגדרת בשרת (TRACCAR_SMS_TOKEN / SMSGATE_* / TWILIO_*).</div>{/if}
    {#if form?.message}<div class="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm text-emerald-200">{form.message}</div>{/if}
    {#if form?.error}<div class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-300">{form.error}</div>{/if}
    {#if data.backendUnavailable}<div class="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-200">לא הצלחנו לטעון את הגמ"חים כרגע. רעננו בעוד רגע.</div>{/if}

    <!-- נוסח + תצוגה מקדימה זה לצד זה -->
    <section class="card p-5">
        <div class="grid gap-4 md:grid-cols-2">
            <form method="POST" action="?/template" use:enhance={() => async ({ update }) => { await update({ reset: false }); }}>
                <label for="tpl" class="mb-1.5 block text-sm font-bold text-white">נוסח ההודעה</label>
                <textarea id="tpl" name="template" rows="6" maxlength={data.maxChars} bind:value={template}
                    class="w-full rounded-xl border border-[#3b5794] bg-[#0f1c3d] p-3 text-sm text-white focus:border-blue-400 focus:outline-none"></textarea>
                <div class="mt-1.5 flex flex-wrap gap-1.5">
                    {#each data.placeholders as p (p.key)}
                        <span title={p.help} class="rounded-full bg-[#16264d] px-2 py-0.5 text-xs text-blue-200" dir="ltr">{p.key}</span>
                    {/each}
                </div>
                <div class="mt-3 flex flex-wrap items-center gap-3">
                    <button type="submit" class="rounded-lg bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-2 text-sm font-bold text-white hover:opacity-90">שמירת הנוסח</button>
                    <button type="button" onclick={() => (template = data.defaultTemplate)} class="text-xs font-bold text-blue-300 hover:underline">החזרת ברירת המחדל</button>
                </div>
            </form>
            <div>
                <div class="mb-1.5 flex items-center justify-between text-sm">
                    <span class="font-bold text-white">כך זה ייראה{sample ? ` (${sample.name})` : ''}</span>
                    <span class="rounded-full bg-[#16264d] px-2 py-0.5 text-xs text-gray-200">{preview.length} תווים · {segments} מקטעים</span>
                </div>
                <div class="whitespace-pre-wrap break-words rounded-2xl bg-emerald-900/40 p-3 text-sm text-emerald-50">{preview}</div>
                <form method="POST" action="?/test" class="mt-3 flex flex-wrap items-center gap-2"
                    use:enhance={() => { busy = 'test'; return async ({ update }) => { await update({ reset: false }); busy = ''; }; }}>
                    <input type="hidden" name="template" value={template} />
                    <input type="hidden" name="id" value={sample?.id ?? ''} />
                    <input name="phone" bind:value={testPhone} inputmode="tel" dir="ltr" placeholder="05X-XXXXXXX"
                        class="w-36 rounded-lg border border-[#3b5794] bg-[#0f1c3d] px-3 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none" />
                    <button type="submit" disabled={busy === 'test' || !data.smsReady}
                        class="rounded-lg border border-blue-500/40 px-3 py-1.5 text-sm font-bold text-blue-200 hover:bg-blue-500/10 disabled:opacity-50">
                        {busy === 'test' ? 'שולח...' : 'שליחת בדיקה אליי'}
                    </button>
                </form>
            </div>
        </div>
    </section>

    <section class="card p-5">
        <div class="mb-3 flex flex-wrap items-center gap-2">
            {#each [['todo', 'טרם נשלח'], ['sent', 'נשלח'], ['declined', 'ביקשו הסרה'], ['all', 'הכל']] as [k, label] (k)}
                <button type="button" onclick={() => { filter = k as typeof filter; selected = new Set(); }}
                    class="rounded-full px-3 py-1 text-xs font-bold {filter === k ? 'bg-blue-600 text-white' : 'bg-[#16264d] text-gray-200 hover:bg-[#1d3263]'}">
                    {label} ({counts[k as keyof typeof counts]})
                </button>
            {/each}
            <input bind:value={q} placeholder="חיפוש שם / עיר / איש קשר"
                class="ms-auto w-48 rounded-lg border border-[#3b5794] bg-[#0f1c3d] px-3 py-1.5 text-sm text-white focus:border-blue-400 focus:outline-none" />
        </div>
        <p class="mb-3 rounded-lg bg-[#16264d] px-3 py-1.5 text-xs text-gray-200">
            לא ברשימה: {data.owned} גמ"חים שכבר יש להם בעלים · {data.noMobile} בלי נייד בטלפון הראשי (SMS לא מגיע לקו נייח)
        </p>

        <div class="mb-3 flex flex-wrap items-center gap-3">
            <button type="button" onclick={selectShown} disabled={bulk.running}
                class="rounded-lg bg-[#16264d] px-3 py-1.5 text-sm font-bold text-gray-100 hover:bg-[#1d3263]">
                בחירת כל המוצגים / ניקוי
            </button>
            {#if bulk.running}
                <span class="text-sm font-bold text-blue-200">נשלח {bulk.done} מתוך {bulk.total}...</span>
                <button type="button" onclick={() => (bulk.stop = true)} class="text-sm font-bold text-rose-300 hover:underline">עצירה</button>
            {:else}
                <button type="button" onclick={sendSelected} disabled={!selected.size || !data.smsReady}
                    class="rounded-lg bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-1.5 text-sm font-bold text-white hover:opacity-90 disabled:opacity-50">
                    📨 שליחה ל-{selected.size} נבחרים
                </button>
            {/if}
        </div>

        {#if shown.length === 0}
            <p class="text-sm text-gray-400">אין גמ"חים בתצוגה הזו.</p>
        {:else}
            <div class="space-y-1.5">
                {#each shown as c (c.id)}
                    {@const declined = declinedOf(c.id)}
                    {@const sent = sentOf(c.id)}
                    {@const res = results[c.id]}
                    <div class="flex flex-wrap items-center gap-3 rounded-xl bg-[#16264d] px-3 py-2">
                        <input type="checkbox" checked={selected.has(c.id)} disabled={declined || bulk.running}
                            onchange={() => toggle(c.id)} class="h-4 w-4 accent-blue-500" aria-label="בחירת {c.name}" />
                        <div class="min-w-0 flex-1">
                            <a href="/gemach/{c.id}" target="_blank" rel="noopener" class="font-bold text-white hover:text-blue-300">{c.name}</a>
                            <div class="text-xs text-gray-300">
                                {c.city}{c.contact ? ` · ${c.contact}` : ''} · <span dir="ltr">***{c.phoneTail}</span>
                                {#if declined}
                                    · <span class="text-rose-300">ביקשו הסרה {when(data.log[c.id]?.declinedAt)}</span>
                                {:else if data.log[c.id]?.at}
                                    · <span class="text-emerald-300">נשלח {when(data.log[c.id]?.at)}{(data.log[c.id]?.count ?? 1) > 1 ? ` (${data.log[c.id]?.count} פעמים)` : ''}</span>
                                {/if}
                            </div>
                        </div>
                        {#if res}<span class="text-xs font-bold {res.ok ? 'text-emerald-300' : 'text-rose-300'}">{res.msg}</span>{/if}
                        {#if !declined}
                            <button type="button" onclick={() => sendSingle(c.id)} disabled={busy === c.id || bulk.running || !data.smsReady}
                                class="rounded-lg border border-blue-500/40 px-3 py-1.5 text-xs font-bold text-blue-200 hover:bg-blue-500/10 disabled:opacity-50">
                                {busy === c.id ? 'שולח...' : sent ? 'שליחה חוזרת' : '📨 SMS'}
                            </button>
                        {/if}
                    </div>
                {/each}
            </div>
        {/if}
    </section>
</div>
