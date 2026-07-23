<script lang="ts">
	import { enhance } from '$app/forms';
	import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	// אם השמירה נכשלה — נזרע מהערכים שהוזנו; אחרת טופס ריק
	const initial = $derived(form?.values ?? null);
</script>

<svelte:head>
	<title>הוספת גמ"ח – הגמ"ח הארצי</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="px-3 md:px-4 py-6 max-w-3xl mx-auto" dir="rtl">
	<Breadcrumbs
		fallback="/"
		crumbs={[
			{ label: 'דף הבית', href: '/' },
			{ label: 'הוספת גמ"ח' }
		]}
	/>

	<div class="mb-4">
		<h1 class="text-2xl font-black text-white">➕ הוספת גמ"ח חדש</h1>
		<p class="mt-1 text-sm text-gray-400">
			פרסום אחד — שתי רשתות: הגמ"ח יופיע במאגר הארצי וגם באתר
			<span class="font-bold text-emerald-300">קהילה בשכונה</span>.
		</p>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
	{/if}

	<form
		method="POST"
		action="?/create"
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
				{saving ? 'מפרסם...' : 'פרסם גמ"ח'}
			</button>
			<a
				href="/"
				class="rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-6 py-3 font-bold text-white transition-colors"
			>
				ביטול
			</a>
		</div>
	</form>
</div>
