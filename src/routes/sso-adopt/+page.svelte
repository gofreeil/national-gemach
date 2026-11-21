<script lang="ts">
	import { onMount } from 'svelte';

	let { data } = $props();
	let formEl: HTMLFormElement | undefined = $state();

	// ההתחברות עצמה: POST ל-action השרתי (ה-signIn של הלקוח שבור לספק הזה)
	onMount(() => formEl?.requestSubmit());
</script>

<svelte:head>
	<title>מתחבר…</title>
	<meta name="robots" content="noindex" />
</svelte:head>

<div class="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center" dir="rtl">
	<div class="text-4xl">🕊️</div>
	<p class="font-bold text-white">מזהים אותך…</p>
	<form bind:this={formEl} method="POST">
		<input type="hidden" name="providerId" value="gofreeil-sso" />
		<input type="hidden" name="redirectTo" value={data.redirectTo || '/'} />
		<button type="submit" class="text-xs text-gray-500 underline hover:text-gray-300">
			לא הועברת? לחץ כאן להמשך
		</button>
	</form>
</div>
