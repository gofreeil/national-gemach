<script>
	// יד 👆 ובועה "לא רשום עדיין? - לחץ כאן להרשמה" שמצביעות על כפתור ההתחברות בהדר.
	// רכיב זהה בכל אתרי הרשת: לשים מיד אחרי כפתור ההתחברות (שמוצג רק לאורח), בתוך עוטף
	// עם position: relative. מופיע ונעלם בדעיכה עדינה אחרי כמה שניות, לא מוצג בדפי
	// ההתחברות/הרשמה עצמם, ו-✕ סוגר אותו עד סוף הביקור. הצבעים (from/to) — של האתר.
	import { onMount } from 'svelte';
	import { fade } from 'svelte/transition';
	import { page } from '$app/stores';

	/** @type {{ href?: string, onopen?: () => void, from?: string, to?: string, text?: string, side?: 'left' | 'right', hidden?: boolean }} */
	let {
		href = '/login',
		onopen = undefined, // אתר שההרשמה בו נפתחת בחלון ולא בדף — הבועה הופכת לכפתור
		from = '#ec4899',
		to = '#8b5cf6',
		text = 'לא רשום עדיין? - לחץ כאן להרשמה',
		side = 'left', // לאיזה קצה של הכפתור הבועה מוצמדת (ממנו היא נמתחת פנימה)
		hidden = false // למשל כשתפריט הנייד פתוח, או כשהאתר הוחלף לשפה שאינה עברית
	} = $props();

	const KEY = 'signupTipClosed';
	const SHOW_MS = 6000;
	const FADE = { duration: 900 };
	const AUTH_PAGE = /^\/(login|register|signup|welcome|forgot-password|reset-password|confirm-email|auth)(\/|$)/;

	let open = $state(false);
	const visible = $derived(open && !hidden && !AUTH_PAGE.test($page.url.pathname));

	onMount(() => {
		try {
			if (sessionStorage.getItem(KEY) === '1') return;
		} catch {
			/* אחסון חסום */
		}
		open = true;
		const t = setTimeout(() => (open = false), SHOW_MS);
		return () => clearTimeout(t);
	});

	function close() {
		open = false;
		try {
			sessionStorage.setItem(KEY, '1');
		} catch {
			/* אחסון חסום — נסגר רק לעמוד הנוכחי */
		}
	}
</script>

{#if visible}
	<span class="signup-hand" aria-hidden="true" transition:fade={FADE}>👆</span>
	<span class="signup-tip {side}" style="--tip-from: {from}; --tip-to: {to}" transition:fade={FADE}>
		{#if onopen}
			<button type="button" class="signup-bubble" onclick={onopen}>{text}</button>
		{:else}
			<a class="signup-bubble" {href}>{text}</a>
		{/if}
		<button type="button" class="signup-close" aria-label="סגירת ההודעה" onclick={close}>✕</button>
	</span>
{/if}

<style>
	.signup-hand {
		position: absolute;
		top: calc(100% + 2px);
		left: 50%;
		z-index: 60;
		width: 2rem;
		margin-left: -1rem;
		text-align: center;
		font-size: 1.6rem;
		line-height: 1;
		pointer-events: none;
		filter: drop-shadow(0 2px 3px rgba(0, 0, 0, 0.3));
		animation: signup-hand-point 1.1s ease-in-out 1s infinite;
	}
	.signup-tip {
		position: absolute;
		top: calc(100% + 32px);
		z-index: 60;
		direction: rtl;
	}
	.signup-tip.left { left: 0; }
	.signup-tip.right { right: 0; }
	.signup-bubble {
		display: block;
		margin: 0;
		padding: 7px 26px 7px 12px;
		border: 0;
		border-radius: 14px;
		font-family: inherit;
		cursor: pointer;
		white-space: nowrap;
		text-decoration: none;
		font-weight: 800;
		font-size: 0.85rem;
		line-height: 1.4;
		color: #fff;
		text-shadow: 0 1px 2px rgba(0, 0, 0, 0.25);
		background: linear-gradient(135deg, var(--tip-from), var(--tip-to));
		box-shadow: 0 6px 18px rgba(0, 0, 0, 0.28);
	}
	.signup-bubble:hover { filter: brightness(1.08); }
	.signup-close {
		position: absolute;
		top: 50%;
		right: 6px;
		width: 18px;
		height: 18px;
		margin-top: -9px;
		padding: 0;
		border: 0;
		border-radius: 999px;
		font-size: 0.62rem;
		line-height: 18px;
		text-align: center;
		color: #fff;
		background: rgba(255, 255, 255, 0.22);
		cursor: pointer;
	}
	.signup-close:hover { background: rgba(255, 255, 255, 0.38); }
	@keyframes signup-hand-point {
		0%, 100% { transform: translateY(0); }
		50% { transform: translateY(-6px); }
	}
	@media (prefers-reduced-motion: reduce) {
		.signup-hand { animation: none; }
	}
</style>
