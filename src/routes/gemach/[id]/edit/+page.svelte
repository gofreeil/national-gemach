<script lang="ts">
	import { enhance } from '$app/forms';
	import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	// אם השמירה נכשלה — נזרע מהערכים שהוזנו; אחרת מהגמ"ח שב-DB
	const initial = $derived(form?.values ?? data.gemach);
</script>

<svelte:head>
	<title>עריכת {data.gemach.name} – הגמ"ח הארצי</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="px-3 md:px-4 py-6 max-w-3xl mx-auto" dir="rtl">
	<nav class="mb-4 text-sm text-gray-400" aria-label="ניווט">
		<a href="/" class="hover:text-white transition-colors">דף הבית</a>
		<span class="mx-1.5">›</span>
		<a href="/gemach/{data.gemach.id}" class="hover:text-white transition-colors">{data.gemach.name}</a>
		<span class="mx-1.5">›</span>
		<span class="text-gray-300">עריכה</span>
	</nav>

	<div class="mb-4 flex items-center justify-between gap-3">
		<h1 class="text-2xl font-black text-white">✏️ עריכת הגמ"ח שלי</h1>
		<a href="/gemach/{data.gemach.id}" class="text-sm text-gray-400 hover:text-white">→ חזרה לגמ"ח</a>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<form
		method="POST"
		action="?/update"
		use:enhance={() => { saving = true; return async ({ update }) => { await update(); saving = false; }; }}
		class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-5 md:p-6"
	>
		<GemachFormFields gemach={initial} categories={data.categories} cities={data.cities} admin={false} />

		<div class="flex flex-wrap items-center gap-3 mt-6 pt-5 border-t border-[#3b5794]">
			<button
				type="submit"
				disabled={saving}
				class="rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:opacity-90 disabled:opacity-60"
			>
				{saving ? 'שומר...' : 'שמור שינויים'}
			</button>
			<a
				href="/gemach/{data.gemach.id}"
				class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-6 py-3 font-bold text-white transition-colors"
			>
				ביטול
			</a>
		</div>
	</form>
</div>
