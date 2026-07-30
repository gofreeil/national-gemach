<script lang="ts">
	import { enhance } from '$app/forms';
	import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';
	import DraftRestoredNotice from '$lib/components/DraftRestoredNotice.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { formDraft } from '$lib/formDraft';
	import { createGemachDraft } from '$lib/gemachDraft.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	// עריכה שלא הספיקה להישמר נשמרת מקומית לפי מזהה הגמ"ח, כדי ששני גמ"חים
	// בעריכה במקביל לא ידרסו זה את הטיוטה של זה.
	const draft = createGemachDraft(`gemach-edit:${data.gemach.id}`, { skip: () => !!form?.values });

	// אם השמירה נכשלה — נזרע מהערכים שהוזנו; אחרת משינויים שלא נשמרו; אחרת מה-DB
	const initial = $derived(form?.values ?? draft.restored ?? data.gemach);
</script>

<svelte:head>
	<title>עריכת {data.gemach.name} – הגמ"ח הארצי</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="px-3 md:px-4 py-6 max-w-3xl mx-auto" dir="rtl">
	<Breadcrumbs
		fallback="/gemach/{data.gemach.id}"
		crumbs={[
			{ label: 'דף הבית', href: '/' },
			{ label: data.gemach.name, href: `/gemach/${data.gemach.id}` },
			{ label: 'עריכה' }
		]}
	/>

	<div class="mb-4">
		<h1 class="text-2xl font-black text-white">✏️ עריכת הגמ"ח שלי</h1>
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
	{/if}

	{#if draft.restored}
		<DraftRestoredNotice onDiscard={() => draft.discard()} label="העריכה" />
	{/if}

	<form
		method="POST"
		action="?/update"
		use:formDraft={draft.options}
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				if (result.type === 'redirect' || result.type === 'success') draft.saved();
				await update();
				saving = false;
			};
		}}
		class="rounded-2xl border border-[#3b5794] bg-[#16264d] p-5 md:p-6"
	>
		{#key initial}
			<GemachFormFields gemach={initial} categories={data.categories} cities={data.cities} admin={false} />
		{/key}

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
