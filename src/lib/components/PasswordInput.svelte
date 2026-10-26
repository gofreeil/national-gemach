<script lang="ts">
	// שדה סיסמה עם עין להצגה/הסתרה. כל התכונות (name, required, placeholder, class...) עוברות ל-input.
	import type { HTMLInputAttributes } from 'svelte/elements';

	let { value = $bindable(''), ...rest }: HTMLInputAttributes = $props();
	let show = $state(false);
</script>

<span class="pw">
	<input {...rest} type={show ? 'text' : 'password'} bind:value />
	<button
		type="button"
		class="eye"
		onclick={() => (show = !show)}
		aria-pressed={show}
		aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}
		title={show ? 'הסתר סיסמה' : 'הצג סיסמה'}
	>
		{#if show}
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 0 0 2.8 2.8M9.9 5.1A10.4 10.4 0 0 1 12 5c5 0 8.5 4.5 9.5 7a13 13 0 0 1-3.2 4.3M6.6 6.6A13 13 0 0 0 2.5 12c1 2.5 4.5 7 9.5 7a9.7 9.7 0 0 0 4.1-.9" /></svg>
		{:else}
			<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12C3.5 9.5 7 5 12 5s8.5 4.5 9.5 7c-1 2.5-4.5 7-9.5 7s-8.5-4.5-9.5-7z" /><circle cx="12" cy="12" r="3" /></svg>
		{/if}
	</button>
</span>

<style>
	.pw { position: relative; display: block; width: 100%; }
	/* מקום לעין בקצה — ספציפיות גבוהה מ-px-* של Tailwind */
	.pw > input { padding-inline-end: 2.75rem; }
	.eye {
		position: absolute;
		top: 50%;
		inset-inline-end: 6px;
		transform: translateY(-50%);
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 34px;
		height: 34px;
		padding: 0;
		border: none;
		border-radius: 8px;
		background: transparent;
		color: #94a3b8;
		cursor: pointer;
	}
	.eye:hover { background: rgba(148, 163, 184, 0.2); color: #64748b; }
	.eye svg { width: 20px; height: 20px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
</style>
