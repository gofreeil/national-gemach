<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';
	import { adminTiles, type AdminNavRole } from '$lib/adminNav';

	let { data } = $props();

	// התפקיד מגיע מ-+layout.server (זמין בכל דף); null = משתמש רגיל
	const role = $derived(data.adminRole as AdminNavRole | null);
	const tiles = $derived(adminTiles(role, data.isOwner));
</script>

<svelte:head><title>האזור האישי</title></svelte:head>

<div class="min-h-[80vh] px-4 py-10" dir="rtl">
	<!-- למשתמש רגיל: כרטיס אחד ממורכז. למנהל: הכרטיס והפאנל זה לצד זה,
	     כדי שהניהול יהיה פרוס מול העיניים ולא מאחורי גלילה. -->
	<div
		class="mx-auto grid w-full items-start gap-6 {role
			? 'max-w-5xl lg:grid-cols-[19rem_minmax(0,1fr)]'
			: 'max-w-md'}"
	>
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
				<a href="/advertise/manage" class="rounded-2xl border border-[#3b5794] bg-[#1c2f5a] px-4 py-3 font-bold text-white transition hover:bg-[#2a4379]">
					📢 הפרסומות שלי — נתונים ועריכה
				</a>
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
	</div>
</div>
