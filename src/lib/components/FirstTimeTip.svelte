<script>
	// בועת דיבור "פעם ראשונה כאן?" עם יד 👇 שמצביעה על כפתור Google שמתחתיה.
	// רכיב זהה בכל אתרי הרשת — למקם ממש מעל כפתור הכניסה עם Google.
	/** @type {{ text: string }} */
	let { text } = $props();
	// טקסטים ישנים (i18n) פותחים ב-👋 — היד כבר מצוירת ליד הבועה
	const clean = $derived(text.replace(/^\s*👋\s*/u, ''));
</script>

<div class="first-tip" role="note">
	<span class="tip-hand" aria-hidden="true">👇</span>
	<p class="tip-bubble">{clean}</p>
</div>

<style>
	.first-tip { display: flex; align-items: flex-end; gap: 12px; margin: 0 0 6px; }
	.tip-hand { font-size: 1.9rem; line-height: 1; flex-shrink: 0; animation: tip-hand-in 0.35s ease-out both, tip-hand-point 1.1s ease-in-out 0.9s infinite; }
	.tip-bubble { position: relative; flex: 1; margin: 0 0 14px; padding: 8px 12px; background: #fff; border: 1.5px solid #fbbf24; border-radius: 14px; box-shadow: 0 4px 14px rgba(146, 64, 14, 0.12); color: #92400e; font-weight: 700; font-size: 0.88rem; line-height: 1.5; text-align: start; transform-origin: 100% 100%; animation: tip-bubble-pop 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) 0.3s both; }
	/* זנב הבועה, מכוון אל היד (מימין ב-RTL) */
	.tip-bubble::after { content: ''; position: absolute; right: -7px; bottom: 10px; width: 11px; height: 11px; background: #fff; border-top: 1.5px solid #fbbf24; border-right: 1.5px solid #fbbf24; transform: rotate(45deg); }
	/* דף בשפה משמאל לימין: היד משמאל והזנב פונה שמאלה */
	.tip-bubble:dir(ltr) { transform-origin: 0% 100%; }
	.tip-bubble:dir(ltr)::after { right: auto; left: -7px; border: none; border-bottom: 1.5px solid #fbbf24; border-left: 1.5px solid #fbbf24; }
	@keyframes tip-hand-in { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: none; } }
	@keyframes tip-hand-point { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(6px); } }
	@keyframes tip-bubble-pop { from { opacity: 0; transform: scale(0.5); } to { opacity: 1; transform: none; } }
	@media (prefers-reduced-motion: reduce) { .tip-hand, .tip-bubble { animation: none; } }
</style>
