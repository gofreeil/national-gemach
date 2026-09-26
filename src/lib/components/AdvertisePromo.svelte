<script lang="ts">
	import { onMount } from 'svelte';

	// הזמנה לפרסם מוצר — עם נתון אמיתי על התנועה באתר, אם יש (ראו /api/site-views)
	let views = $state<{ total: number; since: string } | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/site-views');
			if (res.ok) views = await res.json();
		} catch {
			/* בלי המספר — התיבה עדיין מוצגת */
		}
	});

	/** "אוגוסט 2026" מתוך YYYYMM */
	function sinceLabel(ym: string): string {
		const d = new Date(Number(ym.slice(0, 4)), Number(ym.slice(4, 6)) - 1, 1);
		return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('he-IL', { month: 'long', year: 'numeric' });
	}
</script>

<div class="mt-4 rounded-2xl border border-purple-500/30 bg-purple-900/20 p-4 text-center">
	{#if views}
		<p class="text-2xl font-black text-purple-300">{views.total.toLocaleString('he-IL')}</p>
		<p class="mb-2 text-xs text-gray-400">
			צפיות בדפי האתר{sinceLabel(views.since) ? ` מאז ${sinceLabel(views.since)}` : ''}
		</p>
	{/if}
	<p class="mb-1 font-bold text-white">רוצים שיראו גם את המוצר שלכם?</p>
	<p class="mb-3 text-sm leading-relaxed text-gray-300">
		פרסמו מוצר או שירות: בנייד המודעה מוצגת בכל פעם שגולש לוחץ על "פרטים", ובמחשב היא מוצגת לאורך כל
		תקופת הפרסום.
	</p>
	<a
		href="/advertise/builder"
		class="inline-block rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
		>לפרסום מוצר</a
	>
</div>
