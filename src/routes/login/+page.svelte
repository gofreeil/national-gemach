<script lang="ts">
	import { signIn } from '@auth/sveltekit/client';

	let { data } = $props();

	let email = $state('');
	let password = $state('');
	let loading = $state<'google' | 'facebook' | 'credentials' | 'sso' | null>(null);
	let err = $state<string | null>(null);

	// מוסיף welcome=back ליעד — מפעיל את מסך "ברוכים השבים" אחרי ההתחברות
	function withWelcome(dest: string): string {
		try {
			const u = new URL(dest, window.location.origin);
			u.searchParams.set('welcome', 'back');
			return `${u.pathname}${u.search}${u.hash}`;
		} catch {
			return '/?welcome=back';
		}
	}

	// קודי השגיאה של Auth.js מגיעים באנגלית ב-?error= — מתרגמים למשהו שאפשר לפעול לפיו
	function errorText(code: string): string {
		switch (code) {
			case 'sso_failed':
				return 'לא זוהית דרך "יוצאים לחירות" — חברות בקבוצות הווצאפ אינה חשבון באתר. כניסה עם Google או Facebook למטה יוצרת חשבון בלחיצה אחת.';
			case 'Configuration':
			case 'OAuthSignin':
				return 'דרך ההתחברות הזו אינה זמינה כרגע באתר. התחברו דרך "יוצאים לחירות" או עם אימייל וסיסמה.';
			case 'OAuthCallback':
				return 'ההתחברות מול הספק החיצוני נקטעה. נסו שוב.';
			case 'OAuthAccountNotLinked':
				return 'האימייל הזה כבר רשום אצלנו בדרך התחברות אחרת — התחברו באותה דרך שבה נרשמתם.';
			case 'AccessDenied':
				return 'ההתחברות נדחתה. ייתכן שביטלתם את האישור אצל הספק.';
			default:
				return 'שגיאה בהתחברות. נסו שוב.';
		}
	}

	function oauth(provider: 'google' | 'facebook') {
		loading = provider;
		signIn(provider, { callbackUrl: withWelcome(data.redirectTo || '/') });
	}

	async function credentials(e: Event) {
		e.preventDefault();
		loading = 'credentials';
		err = null;
		const res = await signIn('credentials', {
			email: email.trim().toLowerCase(),
			password,
			redirect: false,
			callbackUrl: data.redirectTo || '/'
		});
		if (res?.error) {
			err = 'אימייל או סיסמה שגויים';
			loading = null;
		} else {
			window.location.href = withWelcome(data.redirectTo || '/');
		}
	}

	// הגשר של "יוצאים לחירות" נשען על עוגייה משותפת בדומיין ‎.gofreeil.com, ולכן
	// community/sso מקבל רק callback ב-https תחת gofreeil.com — ומכל כתובת אחרת
	// (localhost בפיתוח, ‎*.vercel.app) מחזיר 400. עדיף להסביר מראש מלשלוח לשגיאה.
	const SSO_HOME = 'https://gemach.gofreeil.com';
	let ssoOffsite = $state(false);

	function ssoAllowedHere(): boolean {
		const { protocol, hostname } = window.location;
		return protocol === 'https:' && (hostname === 'gofreeil.com' || hostname.endsWith('.gofreeil.com'));
	}

	// SSO: מפנים לקהילת "יוצאים לחירות", היא קובעת את העוגייה המשותפת gofreeil-auth
	// ומחזירה ל-callback שמקים סשן. מי שאין לו חשבון בקהילה לא מוחזר לכאן עם שגיאה:
	// אתר הקהילה מציע לו שם כניסה בלחיצה (Google/Facebook) ומחזיר אותו לכאן מחובר.
	function communitySSO() {
		if (!ssoAllowedHere()) {
			ssoOffsite = true;
			return;
		}
		loading = 'sso';
		const callback = `${window.location.origin}/auth/community-callback?returnTo=${encodeURIComponent(data.redirectTo || '/')}`;
		window.location.href = `https://community.gofreeil.com/sso?callback=${encodeURIComponent(callback)}`;
	}

	// זוהה מראש לפי העוגייה המשותפת (ssoName מהשרת): אין צורך לעבור דרך אתר
	// הקהילה — ה-callback המקומי מקים סשן ישירות מהעוגייה.
	function continueAsCommunityUser() {
		loading = 'sso';
		window.location.href = `/auth/community-callback?returnTo=${encodeURIComponent(data.redirectTo || '/')}`;
	}
</script>

<svelte:head><title>הרשמה / התחברות</title></svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-[#3b5794] bg-[#16264d] p-8 shadow-2xl">
		<div class="mb-6 text-center">
			<div class="mb-3 text-4xl">👤</div>
			<h1 class="text-2xl font-black text-white">הרשמה / התחברות</h1>
			<p class="mt-1 text-sm text-gray-400">כדי להוסיף גמ"ח או לנהל את הפרטים שלכם</p>
		</div>

		<!-- הודעה למשתמש חדש: הכניסה עם Google/Facebook היא גם ההרשמה -->
		{#if !data.ssoName}
			<p class="mb-5 text-center text-amber-200 text-[13px] sm:text-sm font-bold leading-relaxed">
				👋 פעם ראשונה כאן? כניסה עם Google או Facebook יוצרת לך חשבון בלחיצה אחת.
			</p>
		{/if}

		{#if err || data.error}
			<div class="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
				{err ?? errorText(data.error ?? '')}
				{#if !err && data.error && data.error !== 'sso_failed'}
					<span class="mt-1 block text-xs text-red-400/60" dir="ltr">({data.error})</span>
				{/if}
			</div>
		{/if}

		{#if data.ssoName}
			<!-- זוהה מראש דרך יוצאים לחירות (עוגייה משותפת חיה) — כניסה בלחיצה אחת -->
			<button
				type="button"
				onclick={continueAsCommunityUser}
				disabled={loading !== null}
				class="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl login-grad px-4 py-3.5 font-bold text-white transition hover:brightness-110 disabled:opacity-60"
			>
				{#if loading === 'sso'}
					<span class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
				{:else}
					<span class="text-xl" aria-hidden="true">🕊️</span>
				{/if}
				<span>המשך כ-{data.ssoName}</span>
			</button>
			<p class="mb-5 text-center text-xs leading-relaxed text-gray-400">
				זוהית דרך יוצאים לחירות. לא את/ה? אפשר להיכנס עם חשבון אחר למטה.
			</p>

			<div class="mb-5 flex items-center gap-3">
				<div class="h-px flex-1 bg-[#1c2f5a]"></div>
				<span class="text-xs text-gray-500">או</span>
				<div class="h-px flex-1 bg-[#1c2f5a]"></div>
			</div>
		{/if}

		<!-- שלב ראשון: מי שאין לו חשבון — קודם כול נרשם -->
		<div class="mb-6 rounded-2xl border border-purple-400/40 bg-purple-500/10 p-4 text-center">
			<p class="text-sm font-black text-white">עדיין אין לכם חשבון?</p>
			<a
				href="/register?redirect={encodeURIComponent(data.redirectTo || '/')}"
				class="mt-3 block w-full rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-4 py-3.5 font-bold text-white transition hover:from-blue-500 hover:to-purple-500"
			>
				הרשמה לחשבון חדש
			</a>
		</div>

		<!-- שלב שני: מי שכבר רשום — מתחבר באחת מהדרכים -->
		<div class="mb-4 flex items-center gap-3">
			<div class="h-px flex-1 bg-[#1c2f5a]"></div>
			<span class="whitespace-nowrap text-base font-black text-white">כבר רשומים? התחברו</span>
			<div class="h-px flex-1 bg-[#1c2f5a]"></div>
		</div>

		<!-- 1. Google -->
		{#if data.oauth?.google}
		<button
			type="button"
			onclick={() => oauth('google')}
			disabled={loading !== null}
			class="mb-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-white px-4 py-3 font-bold text-gray-900 transition hover:bg-gray-50 disabled:opacity-60"
		>
			{#if loading === 'google'}
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

		<!-- 2. Facebook -->
		{#if data.oauth?.facebook}
		<button
			type="button"
			onclick={() => oauth('facebook')}
			disabled={loading !== null}
			class="mb-3 flex w-full items-center justify-center gap-3 rounded-2xl bg-[#1877F2] px-4 py-3 font-bold text-white transition hover:bg-[#166FE5] disabled:opacity-60"
		>
			{#if loading === 'facebook'}
				<span class="h-5 w-5 flex-shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
			{:else}
				<svg class="h-5 w-5 flex-shrink-0" fill="white" viewBox="0 0 24 24" aria-hidden="true">
					<path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
				</svg>
			{/if}
			המשך עם Facebook
		</button>
		{/if}

		{#if !data.ssoName}
			<!-- 3. יוצאים לחירות (SSO) — אפשרות משנית למי שכבר יש לו חשבון באתר הקהילה.
			     חברי קבוצות הווצאפ בלי חשבון: הכפתור לא נכשל, אתר הקהילה מציע להם
			     כניסה עם Google/Facebook ומחזיר אותם לכאן מחוברים. -->
			<button
				type="button"
				onclick={communitySSO}
				disabled={loading !== null}
				class="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl border border-purple-400/40 bg-purple-500/10 px-4 py-3 text-sm font-bold text-purple-100 transition hover:border-purple-400/60 hover:bg-purple-500/20 disabled:opacity-60"
			>
				{#if loading === 'sso'}
					<span class="h-4 w-4 flex-shrink-0 animate-spin rounded-full border-2 border-white/40 border-t-white"></span>
				{:else}
					<span class="text-lg" aria-hidden="true">🕊️</span>
				{/if}
				<span>יש לי חשבון באתר קהילת יוצאים לחירות</span>
			</button>
			<p class="mb-3 text-center text-xs leading-relaxed text-gray-400">
				חברות בקבוצות הווצאפ אינה חשבון באתר. אם עדיין אין לך חשבון, הכניסה עם Google או Facebook למעלה יוצרת אחד בלחיצה.
			</p>

			{#if ssoOffsite}
				<div class="mb-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-xs leading-relaxed text-amber-200">
					ההתחברות דרך "יוצאים לחירות" עובדת רק בכתובת הרשמית
					(<span dir="ltr">gemach.gofreeil.com</span>) — היא נשענת על עוגייה משותפת לכל אתרי הרשת.
					<a
						href="{SSO_HOME}/login?redirect={encodeURIComponent(data.redirectTo || '/')}"
						class="mt-2 block font-bold text-amber-100 underline hover:text-white"
					>
						המשך להתחברות בכתובת הרשמית
					</a>
				</div>
			{/if}
		{/if}

		<!-- 4. אימייל וסיסמה (למי שנרשם כך) -->
		<div class="my-4 flex items-center gap-3">
			<div class="h-px flex-1 bg-[#1c2f5a]"></div>
			<span class="whitespace-nowrap text-base font-bold text-gray-200">או עם אימייל וסיסמה</span>
			<div class="h-px flex-1 bg-[#1c2f5a]"></div>
		</div>

		<form onsubmit={credentials} class="space-y-3">
			<input
				type="email"
				required
				bind:value={email}
				placeholder="אימייל"
				autocomplete="email"
				class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
			/>
			<input
				type="password"
				required
				bind:value={password}
				placeholder="סיסמה"
				autocomplete="current-password"
				class="w-full rounded-xl border border-[#3b5794] bg-[#1e293b] px-4 py-3 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
			/>
			<button
				type="submit"
				disabled={loading === 'credentials'}
				class="w-full rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-3 font-bold text-white transition hover:bg-[#2a4379] disabled:opacity-60"
			>
				{loading === 'credentials' ? 'מתחבר...' : 'התחבר'}
			</button>
		</form>
	</div>
</div>
