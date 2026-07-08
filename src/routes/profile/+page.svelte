<script lang="ts">
	import { signOut } from '@auth/sveltekit/client';

	let { data } = $props();
</script>

<svelte:head><title>האזור האישי</title></svelte:head>

<div class="min-h-[80vh] flex items-center justify-center px-4 py-12" dir="rtl">
	<div class="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f172a] p-8 text-center shadow-2xl">
		<div class="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-pink-600 text-3xl">
			👤
		</div>
		<h1 class="text-2xl font-black text-white">{data.user.name || 'ברוך הבא'}</h1>
		<p class="mt-1 text-sm text-gray-400">{data.user.email}</p>

		<div class="mt-8 flex flex-col gap-3">
			<a href="https://community.gofreeil.com/profile" class="rounded-2xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-3 font-bold text-white transition hover:opacity-90">
				🕊️ לפרופיל המלא בקהילה
			</a>
			<button
				type="button"
				onclick={() => signOut({ callbackUrl: '/' })}
				class="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 font-bold text-gray-300 transition hover:bg-white/10"
			>
				התנתקות
			</button>
		</div>
	</div>
</div>
