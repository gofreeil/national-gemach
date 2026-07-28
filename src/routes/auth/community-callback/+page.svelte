<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let phase = $state<'working' | 'not_registered'>('working');
	let formEl: HTMLFormElement | undefined = $state();
	let redirectInput: HTMLInputElement | undefined = $state();

	onMount(() => {
		if (data.error) {
			phase = 'not_registered';
			return;
		}
		// פעם ראשונה בדפדפן הזה → "ברוכים המצטרפים"; אחרת "ברוכים השבים"
		let kind = 'back';
		try {
			if (!localStorage.getItem('gemach-welcomed')) kind = 'new';
		} catch {
			/* localStorage חסום — נשאר 'back' */
		}
		const u = new URL(data.returnTo || '/', window.location.origin);
		u.searchParams.set('welcome', kind);
		if (redirectInput) redirectInput.value = `${u.pathname}${u.search}${u.hash}`;
		formEl?.requestSubmit();
	});
</script>

<svelte:head><title>מתחבר…</title><meta name="robots" content="noindex" /></svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-[#3b5794] bg-[#16264d] p-8 text-center shadow-2xl">
		{#if phase === 'working'}
			<div class="mb-4 text-5xl">🕊️</div>
			<h1 class="mb-2 text-2xl font-black text-white">מזהה אותך...</h1>
			<p class="text-sm text-gray-400">רק רגע, מתחברים דרך יוצאים לחירות</p>
			<!-- ההתחברות עצמה: POST ל-action השרתי (ה-signIn של הלקוח שבור לספק הזה) -->
			<form bind:this={formEl} method="POST" class="mt-6">
				<input type="hidden" name="providerId" value="gofreeil-sso" />
				<input bind:this={redirectInput} type="hidden" name="redirectTo" value={data.returnTo || '/'} />
				<button type="submit" class="text-xs text-gray-500 underline hover:text-gray-300">
					לא הועברת? לחץ כאן להמשך
				</button>
			</form>
		{:else}
			<div class="mb-4 text-5xl">👤</div>
			<h1 class="mb-2 text-2xl font-black text-yellow-300">עדיין אין לכם חשבון</h1>
			<p class="mb-6 text-base leading-relaxed text-gray-300">
				לא מצאנו אתכם ברשימת המשתמשים של יוצאים לחירות. ההרשמה לוקחת דקה,
				ומשם אתם מזוהים בכל אתרי הרשת — בלי להירשם שוב.
			</p>
			<div class="flex flex-col gap-3">
				<a
					href="/register?redirect={encodeURIComponent(data.returnTo || '/')}"
					class="rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 py-3.5 font-black text-white transition hover:from-blue-500 hover:to-purple-500"
				>
					הרשמה לחשבון חדש
				</a>
				<a href="/login" class="text-sm text-gray-400 underline hover:text-gray-200">חזרה להתחברות</a>
			</div>
		{/if}
	</div>
</div>
