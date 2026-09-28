<script lang="ts">
	import { onMount } from 'svelte';

	// הזמנה לפרסם באתר — עם נתון אמיתי על התנועה באתר, אם יש (ראו /api/site-views)
	let views = $state<{ total: number; since: string } | null>(null);

	onMount(async () => {
		try {
			const res = await fetch('/api/site-views');
			if (res.ok) views = await res.json();
		} catch {
			/* בלי המספר — התיבה עדיין מוצגת */
		}
	});

	/** "8/2026" מתוך YYYYMM */
	function sinceLabel(ym: string): string {
		const m = Number(ym.slice(4, 6));
		const y = ym.slice(0, 4);
		return m >= 1 && m <= 12 && /^\d{4}$/.test(y) ? `${m}/${y}` : '';
	}
</script>

<div class="mt-4 rounded-2xl border border-purple-500/30 bg-purple-900/20 p-4 text-center">
	{#if views}
		<p class="mb-2 text-sm leading-relaxed text-gray-300">
			אתרנו פעיל וקהילתנו כבר נכנסה עם
			<b class="text-lg font-black text-purple-300">{views.total.toLocaleString('he-IL')}</b>
			צפיות בדפי האתר{sinceLabel(views.since) ? ` מאז ${sinceLabel(views.since)}` : ''} כדי לחפש גמ"ח
		</p>
	{/if}
	<p class="mb-3 font-bold text-white">מוזמנים גם לפרסם אצלנו פרסומת זמנית</p>
	<a
		href="/advertise/builder"
		class="inline-block rounded-xl bg-gradient-to-r from-purple-600 to-pink-600 px-5 py-2 text-sm font-bold text-white transition hover:opacity-90"
		>לחצו כאן כדי להכיר את המחיר האטרקטיבי והמשתלם שלנו!</a
	>
</div>
