<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let name = $state('');
	let email = $state('');
	let password = $state('');
	let loading = $state(false);
	let oauthLoading = $state<'google' | 'facebook' | null>(null);

	// welcome=new מפעיל את מסך "ברוכים המצטרפים" עם רשת האתרים
	function withWelcome(dest: string): string {
		try {
			const u = new URL(dest, window.location.origin);
			u.searchParams.set('welcome', 'new');
			return `${u.pathname}${u.search}${u.hash}`;
		} catch {
			// redirectTo לא תקין — נופלים לדף הבית
			return '/?welcome=new';
		}
	}

	// ב-Auth.js signIn של ספק OAuth הוא גם הרשמה וגם התחברות — אין צורך במסלול שרת נפרד
	function oauth(provider: 'google' | 'facebook') {
		oauthLoading = provider;
		signIn(provider, { callbackUrl: withWelcome(data.redirectTo || '/') });
	}
</script>

<svelte:head><title>הרשמה</title></svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-[#3b5794] bg-[#16264d] p-8 shadow-2xl">
		<div class="mb-6 text-center">
			<div class="mb-3 text-4xl">👤</div>
			<h1 class="text-2xl font-black text-white">הרשמה</h1>
			<p class="mt-1 text-sm text-gray-400">הצטרפו למערכת המאוחדת של יוצאים לחירות</p>
		</div>

		{#if form?.error}
			<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
				{form.error}
			</div>
		{/if}

		<!-- הרשמה מהירה עם ספק חיצוני — אותם כפתורים כמו בדף ההתחברות -->
		{#if data.oauth?.google || data.oauth?.facebook}
			{#if data.oauth?.google}
			<button
				type="button"
				onclick={() => oauth('google')}
				disabled={loading || oauthLoading !== null}
				class="mb-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
					<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
					<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
					<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
					<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
				</svg>
				המשך עם Google
			</button>
			{/if}

			{#if data.oauth?.facebook}
			<button
				type="button"
				onclick={() => oauth('facebook')}
				disabled={loading || oauthLoading !== null}
				class="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-4 py-3 font-bold text-white transition hover:bg-[#166FE5] disabled:opacity-60"
			>
				<svg class="h-5 w-5" fill="white" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
				</svg>
				המשך עם Facebook
			</button>
			{/if}

			<div class="my-4 flex items-center gap-3">
				<div class="h-px flex-1 bg-[#1c2f5a]"></div>
				<span class="whitespace-nowrap text-base font-bold text-gray-200">או עם אימייל וסיסמה</span>
				<div class="h-px flex-1 bg-[#1c2f5a]"></div>
			</div>
		{/if}

		<form
			method="POST"
			use:enhance={() => {
				loading = true;
				return async ({ result, update }) => {
					if (result.type === 'success') {
						// נרשם ב-Strapi המשותף — מתחברים אוטומטית.
						// welcome=new מפעיל את מסך "ברוכים המצטרפים" עם רשת האתרים.
						const dest = withWelcome(data.redirectTo || '/');
						await signIn('credentials', {
							email: email.trim().toLowerCase(),
							password,
							callbackUrl: dest
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
				class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
			<input name="email" type="email" required bind:value={email} placeholder="אימייל" autocomplete="email"
				class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
			<input name="password" type="password" required bind:value={password} placeholder="צור סיסמה (לפחות 6 תווים)" autocomplete="new-password"
				class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none" />
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
