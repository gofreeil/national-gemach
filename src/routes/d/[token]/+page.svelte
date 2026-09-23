<script lang="ts">
    let { data } = $props();
</script>

<svelte:head>
    <title>הסרה מהזמנות – הגמ"ח הארצי</title>
    <meta name="robots" content="noindex" />
</svelte:head>

<div class="mx-auto max-w-md px-4 py-16">
    <div class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-6 text-center">
        {#if data.state === 'ok'}
            <div class="text-4xl">🙏</div>
            <h1 class="mt-3 text-xl font-black text-white">קיבלנו, תודה</h1>
            <p class="mt-2 text-sm text-gray-300">לא נשלח אליכם שוב הודעות על הגמ"ח הזה.</p>
            <a href="/gemach/{data.id}" class="mt-5 inline-block text-sm font-bold text-blue-300 hover:underline">לכרטיס הגמ"ח</a>
        {:else if data.state === 'error'}
            <h1 class="text-xl font-black text-white">משהו השתבש</h1>
            <p class="mt-2 text-sm text-gray-300">לא הצלחנו לשמור את הבקשה — נסו לפתוח את הקישור שוב בעוד רגע.</p>
        {:else}
            <h1 class="text-xl font-black text-white">הקישור אינו תקין</h1>
            <p class="mt-2 text-sm text-gray-300">ייתכן שהוא נקטע בהעתקה. נסו לפתוח אותו ישירות מההודעה.</p>
        {/if}
    </div>
</div>
