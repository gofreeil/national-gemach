<script lang="ts">
    import { enhance } from '$app/forms';

    let { data, form } = $props();
    let busy = $state(false);
    const saved = $derived(form?.saved ?? (data.state === 'ask' ? data.done : undefined));
</script>

<svelte:head>
    <title>הסרה מהזמנות – הגמ"ח הארצי</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-md px-4 py-16">
    <div class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-6 text-center">
        {#if data.state !== 'ask'}
            <h1 class="text-xl font-black text-white">הקישור אינו תקין</h1>
            <p class="mt-2 text-sm text-gray-300">ייתכן שהוא נקטע בהעתקה. נסו לפתוח אותו ישירות מההודעה.</p>
        {:else if saved}
            <div class="text-4xl">🙏</div>
            <h1 class="mt-3 text-xl font-black text-white">קיבלנו, תודה</h1>
            <p class="mt-2 text-sm text-gray-300">
                {saved === 'not_mine'
                    ? 'נבדוק ונתקן את פרטי הקשר של הגמ"ח. לא נשלח אליכם שוב הודעות עליו.'
                    : 'לא נשלח אליכם שוב הודעות על הגמ"ח הזה.'}
            </p>
            <a href="/gemach/{data.id}" class="mt-5 inline-block text-sm font-bold text-blue-300 hover:underline">לכרטיס הגמ"ח</a>
        {:else}
            <h1 class="text-xl font-black text-white">{data.name ? `הגמ"ח "${data.name}"` : 'הגמ"ח'}</h1>
            <p class="mt-2 text-sm text-gray-300">ספרו לנו מה נכון, ולא נטריד אתכם שוב:</p>
            <form method="POST" class="mt-5 grid gap-2.5"
                use:enhance={() => { busy = true; return async ({ update }) => { await update(); busy = false; }; }}>
                <button name="reason" value="not_mine" disabled={busy}
                    class="rounded-xl bg-rose-600 hover:bg-rose-500 disabled:opacity-60 px-4 py-3 font-bold text-white transition-colors">
                    🙅 הגמ"ח לא שלי — המספר שלי רשום בטעות
                </button>
                <button name="reason" value="opt_out" disabled={busy}
                    class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] disabled:opacity-60 px-4 py-3 font-bold text-white transition-colors">
                    הגמ"ח שלי, אבל לא מעוניין בהודעות
                </button>
            </form>
            {#if form?.error}
                <p class="mt-3 text-sm font-bold text-rose-300">{form.error}</p>
            {/if}
            <a href="/gemach/{data.id}" class="mt-5 inline-block text-sm font-bold text-blue-300 hover:underline">לכרטיס הגמ"ח</a>
        {/if}
    </div>
</div>
