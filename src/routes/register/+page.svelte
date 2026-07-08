<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
</script>

<svelte:head><title>הרשמה</title></svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-8 shadow-2xl">
		<div class="mb-6 text-center">
			<div class="mb-3 text-4xl">🕊️</div>
			<h1 class="text-2xl font-black text-white">הרשמה</h1>
			<p class="mt-1 text-sm text-gray-400">הצטרפו למערכת המאוחדת של יוצאים לחירות</p>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						// נרשם ב-Strapi המשותף — מתחברים אוטומטית
						await signIn('credentials', {
							email: email.trim().toLowerCase(),
							password,
							callbackUrl: data.redirectTo || '/'
						});
					} else {
						loading = false;
						await update();
					}
				};
			}}
			class="space-y-4"
		>
			<input name="name" bind:value={name} placeholder="שם מלא"
				class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
			<input name="email" type="email" required bind:value={email} placeholder="אימייל" autocomplete="email"
				class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
			<input name="password" type="password" required bind:value={password} placeholder="סיסמה (לפחות 6 תווים)" autocomplete="new-password"
				class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
			<button type="submit" disabled={loading}
				class="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3.5 font-bold text-white transition hover:from-blue-500 hover:to-purple-500 disabled:opacity-60">
				{loading ? 'נרשם...' : 'הרשמה'}
			</button>
		</form>

		<p class="mt-6 text-center text-sm text-gray-400">
			כבר יש לכם חשבון?
			<a href="/login?redirect={encodeURIComponent(data.redirectTo || '/')}" class="font-bold text-purple-400 hover:text-purple-300">התחברות</a>
		</p>
	</div>
</div>
