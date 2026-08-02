<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import { adminTiles, type AdminNavRole } from '$lib/adminNav';
	import { statusView, needsRenewal, type AdStatusKind } from '$lib/adOwner';

	let { data } = $props();

	// התפקיד מגיע מ-+layout.server (זמין בכל דף); null = משתמש רגיל
	const role = $derived(data.adminRole as AdminNavRole | null);
	const tiles = $derived(adminTiles(role, data.isOwner));

	// פרסומות שממתינות לאישור — ההתראה נגזרת מהמצב באמת (רשומות pending),
	// ולכן היא זהה אצל כל האדמינים ונעלמת מעצמה כשמישהו מאשר או דוחה.
	const pending = $derived(data.pendingAds ?? []);

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

<div class="min-h-[80vh] px-4 py-10" dir="rtl">
	<!-- הכרטיס האישי מימין, והתוכן (הנכסים ולמנהל גם פאנל הניהול) לצדו —
	     פרוס מול העיניים ולא מאחורי גלילה. -->
	<div class="mx-auto grid w-full max-w-5xl items-start gap-6 lg:grid-cols-[19rem_minmax(0,1fr)]">
		<!-- כרטיס אישי -->
		<section class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-6 text-center shadow-2xl">
			<div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-3xl">
				👤
			</div>
			<h1 class="text-2xl font-black text-white">{data.user.name || 'ברוך הבא'}</h1>
			<p class="mt-1 text-sm text-gray-400">{data.user.email}</p>
			{#if role}
				<p class="mt-3 inline-block rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1 text-xs font-black text-emerald-300">
					{role === 'super_admin' ? '★ סופר-אדמין' : 'אדמין'}
				</p>
			{/if}

			<div class="mt-6 flex flex-col gap-3">
				<a href="https://community.gofreeil.com/profile" class="rounded-2xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-3 font-bold text-white transition hover:opacity-90">
					🕊️ לפרופיל המלא בקהילה
				</a>
				<button
					type="button"
					onclick={() => signOut({ callbackUrl: '/' })}
					class="rounded-2xl border border-[#3b5794] bg-[#16264d] px-4 py-3 font-bold text-gray-300 transition hover:bg-[#213569]"
				>
					התנתקות
				</button>
			</div>
		</section>

		<div class="flex flex-col gap-6">
			<!-- פאנל הניהול חי כאן, ולא ככפתור נפרד בהדר. id="admin" נשאר כעוגן
			     לקישור ישיר (/profile#admin). -->
			{#if role}
				<section
					id="admin"
					class="scroll-mt-28 rounded-3xl border border-emerald-500/30 bg-[#16264d] p-5 shadow-2xl sm:p-6"
				>
					<div class="flex flex-wrap items-center justify-between gap-3">
						<div>
							<h2 class="flex items-center gap-2 text-xl font-black text-white">
								<span aria-hidden="true">🛠️</span> ניהול האתר
							</h2>
							<p class="mt-1 text-sm text-gray-400">כל מסכי הניהול — פרוסים כאן, בלחיצה אחת</p>
						</div>
						<a
							href="/admin"
							class="rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
						>
							לפאנל המלא ←
						</a>
					</div>

					<!-- התראת אישור פרסומות — הדבר הראשון שאדמין רואה בפאנל, ונשארת
					     כאן אצל כולם עד שמישהו מאשר/דוחה. הפריטים והכפתור זה לצד זה
					     כדי לא להוסיף קומה שדורשת גלילה. -->
					{#if pending.length > 0}
						<div class="mt-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4">
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
									class="rounded-full bg-gradient-to-r from-rose-600 to-pink-600 px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:opacity-90"
								>
									לאישור עכשיו ←
								</a>
							</div>
							<ul class="mt-3 flex flex-wrap gap-2">
								{#each pending as ad (ad.id)}
									<li>
										<!-- הצ'יפ עצמו מוביל ישירות לכרטיס המודעה במסך האישור -->
										<a
											href="/admin/ads#ad-{ad.id}"
											class="flex items-center gap-2 rounded-full border border-rose-500/30 bg-[#1c2f5a] px-3 py-1.5 text-sm transition hover:border-rose-400/70 hover:bg-[#2a4379]"
										>
											<span class="font-bold text-white">{ad.title}</span>
											<span class="text-xs text-gray-400">{timeAgo(ad.submittedAt)}</span>
											<span class="text-xs font-black text-rose-300" aria-hidden="true">←</span>
										</a>
									</li>
								{/each}
							</ul>
						</div>
					{/if}

					<div class="mt-4 grid gap-3 sm:grid-cols-2">
						{#each tiles as tile (tile.href)}
							<a
								href={tile.href}
								class="rounded-2xl border border-[#3b5794] bg-[#1c2f5a] p-4 transition hover:bg-[#2a4379]"
							>
								<div class="text-2xl" aria-hidden="true">{tile.icon}</div>
								<div class="mt-1 font-bold text-white">{tile.title}</div>
								<div class="mt-0.5 text-xs text-gray-400">{tile.desc}</div>
							</a>
						{/each}
					</div>
				</section>
			{/if}

			<!-- הנכסים שלי — פרוסים כאן ולא מאחורי כפתור. הניהול המלא של כל
			     פריט נשאר בדף שלו. -->
			<section class="rounded-3xl border border-[#3b5794] bg-[#16264d] p-5 shadow-2xl sm:p-6">
				<div class="flex flex-wrap items-center justify-between gap-3">
					<h2 class="flex items-center gap-2 text-xl font-black text-white">
						<span aria-hidden="true">📢</span> הנכסים שלי
					</h2>
					<div class="flex flex-wrap gap-2">
						<a href="/advertise" class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 transition-colors hover:bg-[#2a4379] hover:text-white">
							➕ פרסומת חדשה
						</a>
						<a href="/advertise/manage" class="rounded-full border border-[#3b5794] bg-[#1c2f5a] px-3.5 py-1.5 text-sm font-bold text-gray-100 transition-colors hover:bg-[#2a4379] hover:text-white">
							לדף הנכסים ←
						</a>
					</div>
				</div>

				{#if data.gemachim.length > 0}
					<h3 class="mt-5 mb-2 text-sm font-black text-gray-300">🤝 הגמ"חים שלי</h3>
					<ul class="flex flex-col gap-2">
						{#each data.gemachim as g (g.id)}
							<li class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-3">
								<span class="text-lg" aria-hidden="true">{g.icon || '🤝'}</span>
								<a href="/gemach/{g.id}" class="font-bold text-white hover:text-blue-300">{g.name}</a>
								{#if g.status === 'draft'}
									<span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-200">⏳ ממתין לאישור</span>
								{:else}
									<span class="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-200">● באוויר</span>
								{/if}
								<span class="text-xs text-gray-400">{g.categoryLabel} · 📍 {g.city}</span>
								<a href="/gemach/{g.id}/edit" class="mr-auto rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-3 py-1.5 text-sm font-bold text-white transition hover:opacity-90">
									✏️ עריכה
								</a>
							</li>
						{/each}
					</ul>
				{/if}

				<h3 class="mt-5 mb-2 text-sm font-black text-gray-300">📢 הפרסומות שלי</h3>
				{#if data.loadFailed}
					<div class="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-sm font-bold text-rose-200">
						לא הצלחנו לטעון את הפרסומות שלך כרגע. רעננו את העמוד בעוד רגע.
					</div>
				{:else if data.ads.length === 0}
					<p class="rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-4 text-sm text-gray-300">
						אין לך עדיין פרסומות. <a href="/advertise" class="font-bold text-blue-300 hover:text-blue-200">לפרסום באתר ←</a>
					</p>
				{:else}
					<ul class="flex flex-col gap-2">
						{#each data.ads as ad (ad.id)}
							{@const sv = statusView(ad.status as AdStatusKind, ad.expiresAt)}
							<li>
								<a
									href="/advertise/manage/{ad.id}"
									class="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-3 transition-colors hover:bg-[#2a4379]"
								>
									<span class="font-bold text-white">{ad.title}</span>
									<span class="rounded-full border px-2 py-0.5 text-xs font-bold {TONE[sv.tone]}">{sv.label}</span>
									{#if needsRenewal(ad.status as AdStatusKind, ad.expiresAt)}
										<span class="rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-bold text-amber-200">⏳ לחידוש</span>
									{/if}
									<span class="text-xs text-gray-400">{sv.hint}</span>
									<span class="mr-auto flex gap-3 text-xs text-gray-400">
										<span>צפיות <b class="font-black tabular-nums text-white">{ad.totals.impressions}</b></span>
										<span>הקלקות <b class="font-black tabular-nums text-white">{ad.totals.clicks}</b></span>
										<span>פניות <b class="font-black tabular-nums text-emerald-300">{ad.totals.leads}</b></span>
									</span>
								</a>
							</li>
						{/each}
					</ul>
				{/if}
			</section>
		</div>
	</div>
</div>
