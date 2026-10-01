<script lang="ts">
	import { enhance } from '$app/forms';

	let { data, form } = $props();

	let email = $state(data.email || '');
	let loading = $state(false);
	// בפועל השרת מגביל לשליחה אחת ל-45 שניות לכתובת; מעט מעל כדי שהלחיצה החוזרת תמיד תשלח.
	const COOLDOWN = 50;
	let cooldown = $state(0);

	// נשאר במסך "נשלח" גם כששליחה חוזרת נכשלת (השגיאה מוצגת שם)
	let sentTo = $state('');
	const sent = $derived(!!sentTo);

	// כל שליחה מוצלחת (form.at חדש) מאפסת את הספירה לאחור של "שלח שוב".
	$effect(() => {
		if (!form?.sent) return;
		sentTo = form.email;
		cooldown = COOLDOWN;
		const timer = setInterval(() => {
			cooldown -= 1;
			if (cooldown <= 0) clearInterval(timer);
		}, 1000);
		return () => clearInterval(timer);
	});

	/** קיצור "פתח את תיבת המייל" לספקים נפוצים, לפי הדומיין של הכתובת. */
	const MAIL_APPS: Record<string, [string, string]> = {
		'gmail.com': ['Gmail', 'https://mail.google.com/'],
		'googlemail.com': ['Gmail', 'https://mail.google.com/'],
		'outlook.com': ['Outlook', 'https://outlook.live.com/mail/'],
		'hotmail.com': ['Outlook', 'https://outlook.live.com/mail/'],
		'live.com': ['Outlook', 'https://outlook.live.com/mail/'],
		'yahoo.com': ['Yahoo Mail', 'https://mail.yahoo.com/'],
		'walla.co.il': ['וואלה מייל', 'https://mail.walla.co.il/'],
		'walla.com': ['וואלה מייל', 'https://mail.walla.co.il/']
	};
	const mailApp = $derived(MAIL_APPS[(sentTo.split('@')[1] || '').toLowerCase()] ?? null);
</script>

<svelte:head>
	<title>שחזור גישה לחשבון | הגמ"ח הארצי</title>
	<meta name="robots" content="noindex, follow" />
</svelte:head>

<div class="flex min-h-[70vh] items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md">
		<div class="rounded-3xl border border-white/10 bg-[#0f172a] p-8 text-right shadow-2xl">
			{#if sent}
				<div class="mb-5 text-center">
					<div class="mb-3 text-5xl">📬</div>
					<h1 class="text-2xl font-black text-white">הקישור בדרך אליכם</h1>
				</div>

				<p class="mb-5 text-center text-sm leading-relaxed text-gray-300">
					אם הכתובת <strong class="break-all text-amber-200" dir="ltr">{sentTo}</strong> רשומה אצלנו, שלחנו אליה עכשיו מייל
					עם קישור לבחירת סיסמה חדשה. הקישור תקף לשעתיים.
				</p>

				{#if mailApp}
					<a
						href={mailApp[1]}
						target="_blank"
						rel="noopener noreferrer"
						class="mb-4 block w-full rounded-2xl border border-[#3b5794] bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-3.5 text-center font-bold text-white transition"
					>
						פתיחת {mailApp[0]} ↗
					</a>
				{/if}

				<ul class="mb-5 list-disc space-y-1 rounded-xl bg-white/5 py-3 pr-8 pl-4 text-xs leading-relaxed text-gray-400">
					<li>המייל מגיע בדרך כלל תוך דקה.</li>
					<li>לא רואים אותו? בדקו בתיקיית <strong>ספאם</strong> או <strong>קידומי מכירות</strong>.</li>
					<li>הקלקה על הקישור במייל מחברת אתכם מיד, בלי להתחבר שוב.</li>
				</ul>

				<form
					method="POST"
					action="?/send"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update({ reset: false });
							loading = false;
						};
					}}
				>
					<input type="hidden" name="email" value={sentTo} />
					<button
						type="submit"
						disabled={loading || cooldown > 0}
						class="w-full rounded-2xl border border-white/15 bg-white/5 px-4 py-3 text-sm font-bold text-gray-200 transition hover:bg-white/10 disabled:cursor-default disabled:text-gray-500 disabled:hover:bg-white/5"
					>
						{#if loading}שולח…{:else if cooldown > 0}שליחה חוזרת בעוד {cooldown} שנ'{:else}לא הגיע? שלחו שוב{/if}
					</button>
				</form>

				{#if form?.error}
					<div role="alert" class="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
						{form.error}
					</div>
				{/if}

				<p class="mt-5 text-center text-sm text-gray-400">
					טעות בכתובת?
					<a href="/forgot-password?email={encodeURIComponent(sentTo)}" data-sveltekit-reload class="font-bold text-purple-400 hover:text-purple-300">תקנו והקלידו מחדש</a>
				</p>
			{:else}
				<div class="mb-6 text-center">
					<div class="mb-3 text-5xl">🔑</div>
					<h1 class="text-2xl font-black text-white">שכחתם סיסמה?</h1>
					<p class="mt-2 text-sm leading-relaxed text-gray-400">
						לא נורא. הקלידו את האימייל ונשלח קישור לבחירת סיסמה חדשה — ותהיו מחוברים מיד.
					</p>
				</div>

				<form
					method="POST"
					action="?/send"
					class="space-y-4"
					use:enhance={() => {
						loading = true;
						return async ({ update }) => {
							await update({ reset: false });
							loading = false;
						};
					}}
				>
					<label class="block">
						<span class="mb-1.5 block text-sm text-gray-300">האימייל שלכם</span>
						<!-- svelte-ignore a11y_autofocus -->
						<input
							type="email"
							name="email"
							bind:value={email}
							placeholder="name@example.com"
							autocomplete="email"
							inputmode="email"
							dir="ltr"
							autofocus
							required
							class="w-full rounded-xl border border-white/10 bg-[#1e293b] px-4 py-3 text-left text-white placeholder-gray-500 focus:outline-none focus:border-purple-500"
						/>
					</label>

					{#if form?.error}
						<div role="alert" class="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center text-sm text-red-400">
							{form.error}
						</div>
					{/if}

					<button
						type="submit"
						disabled={loading}
						class="w-full rounded-2xl border border-[#3b5794] bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-3.5 font-bold text-white transition disabled:cursor-wait disabled:opacity-60"
					>
						{loading ? 'שולח…' : 'שלחו לי קישור'}
					</button>
				</form>

				<p class="mt-5 text-center text-sm"><a href="/login" class="text-purple-400 hover:text-purple-300">← חזרה להתחברות</a></p>
			{/if}
		</div>

		<div class="mt-5 rounded-2xl border border-white/10 bg-white/[0.03] px-5 py-4 text-center text-sm leading-relaxed text-gray-400">
			<strong class="text-gray-200">נרשמתם עם Google או Facebook?</strong>
			אז אין לכם סיסמה ואין צורך בה — פשוט
			<a href="/login" class="font-bold text-purple-400 hover:text-purple-300">היכנסו בלחיצה בדף ההתחברות</a>.
		</div>
	</div>
</div>
