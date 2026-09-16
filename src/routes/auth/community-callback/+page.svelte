<script lang="ts">
	import { onMount } from 'svelte';
	import { signIn } from '@auth/sveltekit/client';

	let { data } = $props();
	let phase = $state<'working' | 'not_registered'>('working');
	let formEl: HTMLFormElement | undefined = $state();
	let redirectInput: HTMLInputElement | undefined = $state();
	let oauthLoading = $state<'google' | 'facebook' | null>(null);

	// הרשמה בלחיצה מתוך מסך "עדיין אין חשבון": Google/Facebook יוצרים חשבון
	// ומחזירים ליעד המקורי — בלי לשלוח את המשתמש לטופס.
	async function joinWith(provider: 'google' | 'facebook') {
		oauthLoading = provider;
		try {
			const u = new URL(data.returnTo || '/', window.location.origin);
			u.searchParams.set('welcome', 'new');
			await signIn(provider, { callbackUrl: `${u.pathname}${u.search}${u.hash}` });
		} catch {
			oauthLoading = null;
		}
	}

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
			<!-- חברי קבוצות הווצאפ בלי חשבון באתר: לא "נכשלתם" — יוצרים חשבון בלחיצה כאן -->
			<div class="mb-4 text-5xl">🔒</div>
			<h1 class="mb-2 text-2xl font-black text-yellow-300">עוד רגע ואתם בפנים</h1>
			<p class="mb-1 text-sm leading-relaxed text-gray-300">
				אתם בקבוצות הווצאפ של יוצאים לחירות, אבל עדיין אין לכם חשבון באתר. זה בסדר גמור, ככה זה לכולם בפעם הראשונה.
			</p>
			<p class="mb-6 text-sm leading-relaxed text-gray-400">
				לחיצה אחת למטה יוצרת לכם חשבון, ומשם אתם מזוהים בכל אתרי יוצאים לחירות בלי להירשם שוב.
			</p>
			<div class="flex flex-col gap-3">
				{#if data.oauth?.google}
				<button
					type="button"
					onclick={() => joinWith('google')}
					disabled={oauthLoading !== null}
					class="flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
				>
					{#if oauthLoading === 'google'}
						<span class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-gray-300 border-t-gray-800"></span>
					{:else}
						<svg class="h-5 w-5 flex-shrink-0" viewBox="0 0 24 24" aria-hidden="true">
							<path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
							<path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
							<path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
							<path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
						</svg>
					{/if}
					המשך עם Google
				</button>
				{/if}
				{#if data.oauth?.facebook}
				<button
					type="button"
					onclick={() => joinWith('facebook')}
					disabled={oauthLoading !== null}
					class="flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-4 py-3 font-bold text-white transition hover:bg-[#166FE5] disabled:opacity-60"
				>
					{#if oauthLoading === 'facebook'}
						<span class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
					{:else}
						<svg class="h-5 w-5 flex-shrink-0" fill="white" viewBox="0 0 24 24" aria-hidden="true">
							<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
						</svg>
					{/if}
					המשך עם Facebook
				</button>
				{/if}
				<a
					href="/register?redirect={encodeURIComponent(data.returnTo || '/')}"
					class="mt-1 text-sm text-gray-400 underline hover:text-gray-200"
				>
					מעדיפים אימייל וסיסמה? הרשמה ידנית
				</a>
				<a href="/login" class="text-sm text-gray-500 underline hover:text-gray-300">חזרה להתחברות</a>
			</div>
		{/if}
	</div>
</div>
