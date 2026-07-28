<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// חוזרים לכאן אחרי ההתחברות — ואז ה-load מאמץ את הטיוטה ומפרסם אותה
	const BACK = encodeURIComponent('/gemach/claim');
</script>

<svelte:head>
	<title>פרסום הגמ"ח – הגמ"ח הארצי</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[80vh] items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-[#3b5794] bg-[#16264d] p-8 shadow-2xl">
		{#if data.state === 'needs-login'}
			<div class="mb-6 text-center">
				<div class="mb-3 text-4xl">✅</div>
				<h1 class="text-2xl font-black text-white">הפרטים נשמרו!</h1>
				<p class="mt-2 text-sm leading-relaxed text-gray-300">
					<span class="font-bold text-white">{data.draft?.name}</span>{#if data.draft?.city}<span class="text-gray-400"> · {data.draft.city}</span>{/if}
					<br />
					נשאר שלב אחד: התחברו — והגמ"ח יתפרסם מיד.
				</p>
			</div>

			<a
				href="/login?redirect={BACK}"
				class="mb-3 block w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3.5 text-center font-bold text-white transition hover:from-blue-500 hover:to-purple-500"
			>
				התחברות ופרסום
			</a>
			<a
				href="/register?redirect={BACK}"
				class="block w-full rounded-2xl bg-[#1c2f5a] px-4 py-3 text-center font-bold text-white transition-colors hover:bg-[#2a4379]"
			>
				אין לי חשבון — הרשמה מהירה
			</a>

			<p class="mt-5 text-center text-xs leading-relaxed text-gray-400">
				ההתחברות רושמת את הגמ"ח על שמכם — כך תוכלו לערוך ולעדכן אותו בכל עת,
				כאן וגם באתר <span class="font-bold text-emerald-300">קהילה בשכונה</span>.
				הטיוטה שמורה לכם 30 יום, גם אם תחזרו מאוחר יותר.
			</p>

		{:else if data.state === 'error'}
			<div class="text-center">
				<div class="mb-3 text-4xl">😕</div>
				<h1 class="text-2xl font-black text-white">הפרסום לא הושלם</h1>
				<p class="mt-2 text-sm leading-relaxed text-gray-300">
					הפרטים שמילאתם שמורים — רק השמירה האחרונה נכשלה. נסו שוב בעוד רגע.
				</p>
				<a
					href="/gemach/claim"
					class="mt-5 inline-block rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-6 py-3 font-bold text-white transition hover:from-blue-500 hover:to-purple-500"
				>
					נסה שוב
				</a>
			</div>

		{:else}
			<div class="text-center">
				<div class="mb-3 text-4xl">🤝</div>
				<h1 class="text-2xl font-black text-white">אין טיוטה שממתינה לפרסום</h1>
				<p class="mt-2 text-sm leading-relaxed text-gray-300">
					ייתכן שהגמ"ח כבר פורסם — חפשו אותו במאגר. אפשר כמובן להוסיף עוד אחד.
				</p>
				<div class="mt-5 flex flex-wrap justify-center gap-3">
					<a
						href="/gemach/add"
						class="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 font-bold text-white transition hover:from-blue-500 hover:to-purple-500"
					>
						הוספת גמ"ח
					</a>
					<a
						href="/gemachim"
						class="rounded-2xl bg-[#1c2f5a] px-5 py-3 font-bold text-white transition-colors hover:bg-[#2a4379]"
					>
						למאגר הגמ"חים
					</a>
				</div>
			</div>
		{/if}
	</div>
</div>
