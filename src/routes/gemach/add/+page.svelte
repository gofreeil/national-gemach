<script lang="ts">
    import Seo from '$lib/components/Seo.svelte';
	import { enhance } from '$app/forms';
	import GemachFormFields from '$lib/components/admin/GemachFormFields.svelte';
	import DraftRestoredNotice from '$lib/components/DraftRestoredNotice.svelte';
	import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
	import { formDraft } from '$lib/formDraft';
	import { createGemachDraft } from '$lib/gemachDraft.svelte';
	import type { PageData, ActionData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();
	let saving = $state(false);

	// ----- טיוטה אוטומטית -----
	// מילוי הטופס הזה לוקח דקות ארוכות; יציאה לדף אחר, רענון או סגירת כרטיסייה
	// לא ימחקו אותו. השמירה רצה תוך כדי הקלדה (ראה $lib/formDraft) והשחזור כאן.
	// אם חזרנו משמירה שנכשלה — הערכים שהשרת החזיר טריים יותר מהטיוטה.
	const draft = createGemachDraft('gemach-add', { skip: () => !!form?.values });

	// אם השמירה נכשלה — נזרע מהערכים שהוזנו; אחרת מהטיוטה השמורה; ואחרת טופס
	// ריק, פרט לקטגוריה שהגיעה בכתובת (?category=) כשההוספה נפתחה מתוך סינון
	// נושא בדף הבית. זו בחירה אמיתית בשדה — לא רמז אפור.
	const initial = $derived(
		form?.values ?? draft.restored ??
		(data.presetCategory ? { category: data.presetCategory, categories: [data.presetCategory] } : null)
	);

	const presetLabel = $derived(
		data.presetCategory ? (data.categories.find((c) => c.key === data.presetCategory)?.label ?? '') : ''
	);
</script>

<Seo
    title='הוספת גמ"ח למאגר הארצי — רישום חינם'
    description='מפעילים גמ"ח? הוסיפו אותו למאגר הגמ"חים הארצי בחינם — שם, נושא, עיר, כתובת, שעות פעילות וטלפון — וקבלו דף אינדקס שמופיע בגוגל.'
    path="/gemach/add"
    noindex
/>

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
		<!-- הרקע הוורוד לא נותן ניגודיות לטקסט אפור — לכן גלולה כהה (הדפוס הקבוע באתר) -->
		<p class="mt-2 inline-block rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-semibold text-gray-100 shadow-md">
			פרסום אחד — שתי רשתות: הגמ"ח יופיע במאגר הארצי וגם באתר
			<span class="font-bold text-emerald-300">קהילה בשכונה</span>.
		</p>
		{#if presetLabel && !form?.values}
			<p class="mt-2 inline-block rounded-full border border-amber-400/40 bg-amber-950/50 px-3.5 py-1.5 text-sm font-semibold text-amber-100 shadow-md">
				הנושא <span class="font-black">{presetLabel}</span> כבר נבחר בטופס — אפשר לשנות אותו, ולסמן גם נושאים נוספים.
			</p>
		{/if}
		{#if !data.loggedIn}
			<p class="mt-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-950/60 px-3.5 py-1.5 text-sm font-semibold text-emerald-100 shadow-md">
				אין צורך בחשבון כדי להתחיל — מלאו את הפרטים, נשמור לכם אותם, וההתחברות בסוף.
			</p>
		{/if}
	</div>

	{#if form?.error}
		<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">{form.error}</div>
	{/if}

	{#if draft.restored}
		<DraftRestoredNotice onDiscard={() => draft.discard()} label='טופס הגמ"ח' />
	{/if}

	<form
		method="POST"
		action="?/create"
		use:formDraft={draft.options}
		use:enhance={() => {
			saving = true;
			return async ({ result, update }) => {
				// נשמר בשרת — הטיוטה המקומית סיימה את תפקידה. מנקים לפני
				// update() כי הוא זה שמנווט הלאה ומפרק את הטופס.
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
				{#if saving}
					{data.loggedIn ? 'מפרסם...' : 'שומר...'}
				{:else}
					{data.loggedIn ? 'פרסם גמ"ח' : 'שמירה והמשך'}
				{/if}
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
