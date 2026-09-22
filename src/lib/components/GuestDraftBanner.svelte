<script lang="ts">
	// באנר הכרטיס שממתין לבעלים — מוצג בראש מסכי ההרשמה וההתחברות למי
	// שהגיע לשם מיד אחרי הוספת גמ"ח. שלוש שורות קצרות: מה נשמר, מה מצבו
	// עכשיו, ומה קורה אם לא ישלים הרשמה — כולל איך חוזרים לכרטיס.
	import { gemachStatusView } from '$lib/gemachStatus';

	interface Draft {
		id: string;
		name: string;
		city: string;
		status?: string;
		verified: boolean;
		needsReview: boolean;
	}

	let { draft }: { draft: Draft } = $props();

	const sv = $derived(gemachStatusView(draft));
</script>

<div class="mb-5 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3.5 text-right">
	<p class="text-sm font-black text-emerald-200">
		🎉 הגמ"ח <span class="text-white">{draft.name}</span>{#if draft.city}<span
				class="font-bold text-emerald-100/70"> · {draft.city}</span
			>{/if} נשמר
	</p>

	<p class="mt-1.5 text-sm leading-relaxed text-emerald-100/90">
		<span class="font-bold">{sv.label}</span> — {sv.meaning}
	</p>

	<p class="mt-1.5 text-sm leading-relaxed text-gray-200">
		ההרשמה רושמת אותו <span class="font-bold text-white">על שמך</span>: עריכה בכל עת, ניהול מהאזור
		האישי והתראות.
	</p>

	<p class="mt-1.5 text-xs leading-relaxed text-gray-400">
		בלי הרשמה הכרטיס נשאר באוויר, אבל רק צוות האתר יוכל לערוך אותו. שמרנו לך אותו בדפדפן הזה
		ל-30 יום — לחזרה מאוחרת:
		<a href="/gemach/claim" class="font-bold text-blue-300 hover:underline">הגמ"ח שלי</a>
		·
		<a href="/gemach/{draft.id}" class="font-bold text-blue-300 hover:underline">צפייה בכרטיס</a>
	</p>
</div>
