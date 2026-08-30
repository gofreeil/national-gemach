<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import { adminTiles, type AdminNavRole } from '$lib/adminNav';
	import VisitorStatsCard from '$lib/components/VisitorStatsCard.svelte';
	import { statusView, needsRenewal, type AdStatusKind } from '$lib/adOwner';

	let { data } = $props();

	// התפקיד מגיע מ-+layout.server (זמין בכל דף); null = משתמש רגיל
	const role = $derived(data.adminRole as AdminNavRole | null);
	const tiles = $derived(adminTiles(role, data.isOwner));

	// פרסומות שממתינות לאישור — ההתראה נגזרת מהמצב באמת (רשומות pending),
	// ולכן היא זהה אצל כל האדמינים ונעלמת מעצמה כשמישהו מאשר או דוחה.
	const pending = $derived(data.pendingAds ?? []);

	// סך הממתינים לטיפול — מגיע מה-layout (אותו חישוב של הבועה שבהאדר:
	// פרסומות + תביעות בעלות + טיוטות-אורח מטופס ההוספה; טיוטות הגילוי
	// הוחרגו בכוונה — לא דחופות), כדי שתמונת הפרופיל וההאדר יראו תמיד
	// את אותו מספר.
	const totalPending = $derived(data.pendingCount ?? 0);

	// מוני האריחים: המספר משולב בתוך שורת התיאור — אותו פונט ואותו צבע של
	// הטקסט. ההתראות (מה שממתין לטיפול) מוצגות בנפרד, כבועה בולטת בפינה.
	const stats = $derived(data.tileStats);
	function tileCount(href: string): string {
		if (!stats) return '';
		switch (href) {
			case '/admin/gemachim': return `${stats.gemachim} גמ"חים`;
			case '/admin/gemachim/complete': return `${stats.incomplete} להשלמה`;
			case '/admin/pinned': return `${stats.pinned} נעוצים`;
			case '/admin/discovery': return `${stats.drafts} טיוטות ממתינות`;
			case '/admin/ads': return `${stats.adsLive} באוויר`;
			case '/admin/claims': return `${data.pendingClaims ?? 0} ממתינות לאישור`;
			case '/admin/admins': return `${stats.admins} אדמינים`;
			case '/admin/categories': return `${stats.categories} קטגוריות`;
			default: return '';
		}
	}

	// הבועה האדומה על אריח = פריטים שממתינים לטיפול באותו מסך. הסכום של
	// שלושת אלה הוא בדיוק totalPending — הבועות על האריחים, על תמונת
	// הפרופיל ובהאדר מסונכרנות. טיוטות הגילוי אינן התראה — המונה שלהן
	// מופיע רק בשורת התיאור של האריח (tileCount).
	const tileAlerts: Record<string, number> = $derived({
		'/admin/gemachim': data.pendingDrafts ?? 0,
		'/admin/ads': pending.length,
		'/admin/claims': data.pendingClaims ?? 0
	});

	// יש תוכן לעמודה הרחבה (פאנל ניהול / "אולי שלך")? בלי — עמודה צרה ממורכזת.
	const hasSide = $derived(Boolean(role) || (data.claimable?.length ?? 0) > 0);

	function timeAgo(iso: string): string {
		const ts = Date.parse(iso);
		if (Number.isNaN(ts)) return '';
		const mins = Math.max(0, Math.round((Date.now() - ts) / 60000));
		if (mins < 1) return 'עכשיו';
		if (mins < 60) return `לפני ${mins} דק׳`;
		const hours = Math.round(mins / 60);
		if (hours < 24) return `לפני ${hours} שע׳`;
		const days = Math.round(hours / 24);
		return days === 1 ? 'לפני יום' : `לפני ${days} ימים`;
	}

	const TONE: Record<string, string> = {
		amber: 'border-amber-500/40 bg-amber-500/10 text-amber-200',
		emerald: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-200',
		rose: 'border-rose-500/40 bg-rose-500/10 text-rose-200',
		slate: 'border-[#3b5794] bg-[#1c2f5a] text-gray-300'
	};
</script>

<svelte:head><title>האזור האישי</title></svelte:head>

<div class="min-h-[80vh] px-4 py-8" dir="rtl">
	<!-- עמודה ימנית: הכרטיס האישי והנכסים שלי זה מתחת לזה — בלי חלל ריק.
	     עמודה שמאלית (כשיש): פאנל הניהול ו"אולי שלך". -->
	<div class="mx-auto grid w-full items-start gap-4 {hasSide ? 'max-w-5xl lg:grid-cols-[20rem_minmax(0,1fr)]' : 'max-w-sm'}">
		<div class="flex flex-col gap-4">
			<!-- כרטיס אישי -->
			<section class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-5 text-center shadow-2xl">
				<!-- תמונת הפרופיל. כשיש פריטים שממתינים לטיפול (אדמין) — בועה אדומה
				     בפינה, חצי מעל התמונה, עם אותו מספר שמוצג בהאדר ועל האריחים. -->
				<div class="relative mx-auto mb-3 h-16 w-16">
					<div class="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-2xl">
						👤
					</div>
					{#if totalPending > 0}
						<a
							href="#admin"
							class="absolute -top-1 -left-1 flex h-6 min-w-6 items-center justify-center rounded-full bg-rose-500 px-1.5 text-xs font-black leading-none text-white shadow-lg ring-2 ring-[#16264d] transition hover:bg-rose-400"
							title="{totalPending} פריטים ממתינים לטיפול"
						>
							<span class="sr-only">פריטים ממתינים לטיפול: </span>{totalPending}
						</a>
					{/if}
				</div>
				<h1 class="text-xl font-black text-white">{data.user.name || 'ברוך הבא'}</h1>
				<p class="mt-0.5 text-sm text-gray-400">{data.user.email}</p>
				{#if role}
					<p class="mt-2 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[11px] font-black text-emerald-300">
						{role === 'super_admin' ? '★ סופר-אדמין' : 'אדמין'}
					</p>
				{/if}

				<div class="mt-4 flex flex-col gap-2">
					<a href="https://community.gofreeil.com/profile" class="rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
						🕊️ לפרופיל המלא בקהילה
					</a>
					<button
						type="button"
						onclick={() => signOut({ callbackUrl: '/' })}
						class="rounded-xl border border-[#3b5794] bg-[#16264d] px-4 py-2 text-sm font-bold text-gray-300 transition hover:bg-[#213569]"
					>
						התנתקות
					</button>
				</div>
			</section>

			<!-- הנכסים שלי — צמוד לכרטיס האישי, ממלא את העמודה. הניהול המלא
			     של כל פריט נשאר בדף שלו. -->
			<section class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-4 shadow-2xl">
				<div class="flex items-center justify-between gap-2">
					<h2 class="flex items-center gap-1.5 text-base font-black text-white">
						<span aria-hidden="true">📢</span> הנכסים שלי
					</h2>
					<a href="/advertise/manage" class="text-xs font-bold text-blue-300 transition-colors hover:text-blue-200">לדף הנכסים ←</a>
				</div>

				{#if data.gemachim.length > 0}
					<h3 class="mt-3 mb-1.5 text-xs font-black text-gray-400">🤝 הגמ"חים שלי</h3>
					<ul class="flex flex-col gap-1.5">
						{#each data.gemachim as g (g.id)}
							<li class="flex items-center gap-2 rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-2">
								<span class="text-base" aria-hidden="true">{g.icon || '🤝'}</span>
								<a href="/gemach/{g.id}" class="min-w-0 flex-1">
									<span class="block truncate text-sm font-bold text-white">{g.name}</span>
									<span class="block truncate text-[11px] text-gray-400">
										{#if g.status === 'draft'}<span class="font-bold text-amber-300">⏳ ממתין לאישור</span>{:else}<span class="font-bold text-emerald-300">● באוויר</span>{/if}
										· 📍 {g.city}
									</span>
								</a>
								<a href="/gemach/{g.id}/edit" class="flex-shrink-0 rounded-lg bg-gradient-to-r from-amber-500 to-pink-600 px-2 py-1 text-xs font-bold text-white transition hover:opacity-90" title="עריכה">✏️</a>
							</li>
						{/each}
					</ul>
				{/if}

				<div class="mt-3 mb-1.5 flex items-center justify-between gap-2">
					<h3 class="text-xs font-black text-gray-400">📢 הפרסומות שלי</h3>
					<a href="/advertise" class="text-xs font-bold text-blue-300 transition-colors hover:text-blue-200">➕ חדשה</a>
				</div>
				{#if data.loadFailed}
					<div class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3 py-2.5 text-xs font-bold text-rose-200">
						לא הצלחנו לטעון את הפרסומות שלך כרגע. רעננו את העמוד בעוד רגע.
					</div>
				{:else if data.ads.length === 0}
					<p class="rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-2.5 text-xs text-gray-300">
						אין לך עדיין פרסומות. <a href="/advertise" class="font-bold text-blue-300 hover:text-blue-200">לפרסום באתר ←</a>
					</p>
				{:else}
					<ul class="flex flex-col gap-1.5">
						{#each data.ads as ad (ad.id)}
							{@const sv = statusView(ad.status as AdStatusKind, ad.expiresAt)}
							<li>
								<a
									href="/advertise/manage/{ad.id}"
									class="block rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-2 transition-colors hover:bg-[#2a4379]"
								>
									<span class="flex items-center justify-between gap-2">
										<span class="truncate text-sm font-bold text-white">{ad.title}</span>
										<span class="flex-shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold {TONE[sv.tone]}">{sv.label}</span>
									</span>
									<span class="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-400">
										<span>צפיות <b class="font-black tabular-nums text-white">{ad.totals.impressions}</b></span>
										<span>הקלקות <b class="font-black tabular-nums text-white">{ad.totals.clicks}</b></span>
										<span>פניות <b class="font-black tabular-nums text-emerald-300">{ad.totals.leads}</b></span>
										{#if needsRenewal(ad.status as AdStatusKind, ad.expiresAt)}
											<span class="font-bold text-amber-300">⏳ לחידוש</span>
										{/if}
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>

		{#if hasSide}
			<div class="flex flex-col gap-4">
				<!-- זיהוי אוטומטי: גמ"חים שהטלפון שלהם תואם לשל המשתמש — "אולי שלך?".
				     מוצג רק כשנמצאה התאמה. הבקשה עצמה נשלחת מדף הגמ"ח (כפתור "זה שלי"). -->
				{#if data.claimable && data.claimable.length > 0}
					<section class="rounded-3xl border border-blue-500/40 bg-blue-500/10 p-4 shadow-2xl sm:p-5">
						<h2 class="flex items-center gap-2 text-base font-black text-white">
							<span aria-hidden="true">🤝</span> אולי אחד מאלה שלך?
						</h2>
						<p class="mt-1 text-xs text-gray-300">
							מצאנו גמ"חים עם מספר טלפון שתואם לשלך. אם הגמ"ח שלך — פתח אותו ובקש בעלות: גמ"ח שהעלית בטופס מאומת מיד בקוד לטלפון, ובשאר המקרים אדמין מאשר.
						</p>
						<ul class="mt-2.5 flex flex-col gap-1.5">
							{#each data.claimable as g (g.id)}
								<li>
									<a
										href={`/gemach/${g.id}`}
										class="flex items-center justify-between gap-3 rounded-xl border border-blue-500/30 bg-[#1c2f5a] px-3 py-2 transition hover:bg-[#2a4379]"
									>
										<span class="min-w-0">
											<span class="block truncate text-sm font-bold text-white">{g.name}</span>
											{#if g.city}<span class="text-[11px] text-gray-400">📍 {g.city}</span>{/if}
										</span>
										<span class="flex-shrink-0 text-xs font-bold text-blue-300">זה שלי ←</span>
									</a>
								</li>
							{/each}
						</ul>
					</section>
				{/if}

				<!-- פאנל הניהול חי כאן, ולא ככפתור נפרד בהדר. id="admin" נשאר כעוגן
				     לקישור ישיר (/profile#admin). -->
				{#if role}
					<section
						id="admin"
						class="scroll-mt-28 rounded-3xl border border-emerald-500/30 bg-[#16264d] p-4 shadow-2xl sm:p-5"
					>
						<div>
							<h2 class="flex items-center gap-2 text-lg font-black text-white">
								<span aria-hidden="true">🛠️</span> ניהול האתר
							</h2>
							<p class="mt-0.5 text-xs text-gray-400">כל מסכי הניהול — פרוסים כאן, בלחיצה אחת</p>
						</div>

						<!-- התראת אישור פרסומות — הדבר הראשון שאדמין רואה בפאנל, ונשארת
						     כאן אצל כולם עד שמישהו מאשר/דוחה. הפריטים והכפתור זה לצד זה
						     כדי לא להוסיף קומה שדורשת גלילה. -->
						{#if pending.length > 0}
							<div class="mt-3 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-3.5">
								<div class="flex flex-wrap items-center justify-between gap-3">
									<p class="flex items-center gap-2 font-black text-rose-100">
										<span class="relative flex h-2.5 w-2.5" aria-hidden="true">
											<span class="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75"></span>
											<span class="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-500"></span>
										</span>
										{pending.length === 1
											? 'פרסומת אחת ממתינה לאישור'
											: `${pending.length} פרסומות ממתינות לאישור`}
									</p>
									<a
										href="/admin/ads"
										class="rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-3 py-1.5 text-xs font-bold text-white shadow-lg transition hover:opacity-90"
									>
										לאישור עכשיו ←
									</a>
								</div>
								<!-- הפרסומת עצמה מוצגת כאן — תמונה, כותרת ותוכן — כדי שכל אדמין
								     יראה מיד על מה מדובר. לחיצה מובילה לכרטיס המלא במסך האישור. -->
								<ul class="mt-3 flex flex-col gap-2">
									{#each pending as ad (ad.id)}
										<li>
											<a
												href="/admin/ads#ad-{ad.id}"
												class="flex items-stretch overflow-hidden rounded-2xl border border-rose-500/30 bg-[#1c2f5a] transition hover:border-rose-400/70 hover:bg-[#2a4379]"
											>
												<span class="relative block w-28 flex-shrink-0 self-stretch overflow-hidden bg-black/30 sm:w-32">
													{#if ad.mainImage}
														<img
															src={ad.mainImage}
															alt={ad.title}
															class="absolute inset-0 h-full w-full object-cover"
														/>
													{:else}
														<span
															class="absolute inset-0"
															style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"
														></span>
													{/if}
												</span>
												<span class="flex min-w-0 flex-1 flex-col justify-center gap-1 px-3 py-2.5">
													<span class="truncate font-black text-white">{ad.title}</span>
													{#if ad.subtitle}
														<span class="truncate text-xs text-gray-300">{ad.subtitle}</span>
													{/if}
													{#if ad.hoverText}
														<span class="truncate text-xs text-amber-200">{ad.hoverText}</span>
													{/if}
													<span class="flex flex-wrap items-center gap-2">
														{#if ad.cta}
															<span
																class="rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white"
																style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"
															>{ad.cta}</span>
														{/if}
														<span class="truncate text-[11px] text-gray-400">
															{ad.submittedBy.email || ad.submittedBy.name || 'מפרסם ללא זיהוי'} · {timeAgo(ad.submittedAt)}
														</span>
													</span>
												</span>
												<span class="flex items-center pe-3 text-sm font-black text-rose-300" aria-hidden="true">←</span>
											</a>
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						<!-- סטטיסטיקת הכניסות — פרוסה כאן, וכל הכרטיס קישור לפירוט המלא -->
						<div class="mt-3">
							<VisitorStatsCard months={data.gaMonths} updatedAt={data.gaUpdatedAt} nested href="/admin/stats" />
						</div>

						<div class="mt-3 grid gap-2 sm:grid-cols-2">
							{#each tiles as tile (tile.href)}
								{@const count = tileCount(tile.href)}
								{@const alert = tileAlerts[tile.href] ?? 0}
								<a
									href={tile.href}
									class="relative flex items-center gap-3 rounded-xl border border-[#3b5794] bg-[#1c2f5a] px-3 py-2.5 transition hover:bg-[#2a4379]"
								>
									<!-- בועת "ממתין לטיפול" — בפינה, חצי מעל האריח, בצבע ובצורה
									     שונים מהטקסט כדי שתבלוט. מוצגת רק כשבאמת יש מה לאשר. -->
									{#if alert > 0}
										<span
											class="absolute -top-2 -left-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1.5 text-[11px] font-black leading-none text-white shadow-lg ring-2 ring-[#16264d]"
										>
											<span class="sr-only">ממתינים לטיפול: </span>{alert}
										</span>
									{/if}
									<span class="text-xl" aria-hidden="true">{tile.icon}</span>
									<span class="min-w-0">
										<span class="block truncate text-sm font-bold text-white">{tile.title}</span>
										<!-- המונה משולב בתחילת שורת התיאור — אותו פונט, אותו צבע.
										     בתחילתה ולא בסופה, כדי שה-truncate לא יבלע אותו במסכים צרים. -->
										<span class="block truncate text-[11px] text-gray-400">{count ? `${count} · ` : ''}{tile.desc}</span>
									</span>
								</a>
							{/each}
						</div>
					</section>
				{/if}
			</div>
		{/if}
	</div>
</div>
