<script lang="ts">
	// שורת הפעולות של פרסומת ב"הפרסומות שלי" (/profile, /advertise/manage):
	// קיצורי הניהול לאדמין — הפעולות השכיחות ישר מכאן, בלי לעבור למסך
	// הניהול. המסלול = מה שנבחר בשליחה; שינוי מסלול, מקום בטור וקציבה —
	// במסך הניהול. הפעולות עצמן ב-$lib/server/myAdsActions (שני הדפים
	// חושפים אותן באותם שמות). "צפה" מוצג לכל מפרסם כשהפרסומת באוויר.
	import { enhance } from '$app/forms';

	interface AdLike {
		id: string;
		status: string;
		paused: boolean;
		requestedDurationDays: number | null;
	}

	let { ad, isAdmin, live }: { ad: AdLike; isAdmin: boolean; live: boolean } = $props();

	// כפתורים קטנים זה לצד זה, נשברים לשורה בנייד (flex-wrap אצל ההורה)
	const BTN = 'whitespace-nowrap rounded-lg border px-2 py-0.5 text-[11px] font-bold transition-colors';
	const OK = `${BTN} border-emerald-500/45 bg-emerald-500/15 text-emerald-200 hover:bg-emerald-500/30`;
	const GHOST = `${BTN} border-white/15 bg-white/5 text-gray-200 hover:bg-white/15`;
	const DANGER = `${BTN} border-rose-500/40 bg-rose-500/10 text-rose-200 hover:bg-rose-500/25`;

	function askReason(e: MouseEvent & { currentTarget: HTMLButtonElement }) {
		const reason = prompt('סיבת הדחייה (אפשר להשאיר ריק):', '');
		if (reason === null) {
			e.preventDefault();
			return;
		}
		const input = e.currentTarget.form?.elements.namedItem('reason');
		if (input instanceof HTMLInputElement) input.value = reason;
	}
</script>

{#if isAdmin || live}
	<div class="flex flex-wrap items-center gap-1.5">
		{#if isAdmin}
			{#if ad.status === 'pending'}
				<form method="POST" action="?/approve" class="contents" use:enhance>
					<input type="hidden" name="id" value={ad.id} />
					<input type="hidden" name="durationDays" value={ad.requestedDurationDays ?? ''} />
					<button type="submit" class={OK} title="אישור ופרסום">✅ אשר</button>
				</form>
			{:else if ad.status === 'approved' && !live && !ad.paused}
				<!-- פג התוקף: אישור מחדש = תקופה חדשה מהיום, באותו מקום -->
				<form method="POST" action="?/approve" class="contents" use:enhance>
					<input type="hidden" name="id" value={ad.id} />
					<input type="hidden" name="durationDays" value={ad.requestedDurationDays ?? ''} />
					<button type="submit" class={OK} title="תקופה חדשה מהיום, באותו מקום בטור">🔄 חדש</button>
				</form>
			{/if}
			{#if ad.status === 'approved'}
				{#if ad.paused}
					<form method="POST" action="?/resume" class="contents" use:enhance>
						<input type="hidden" name="id" value={ad.id} />
						<button type="submit" class={OK} title="הימים השמורים נספרים מהיום">▶ המשך</button>
					</form>
				{:else if live}
					<form method="POST" action="?/pause" class="contents" use:enhance>
						<input type="hidden" name="id" value={ad.id} />
						<button
							type="submit"
							class={GHOST}
							title="יורדת מהאתר, הימים שנותרו נשמרים לה"
							onclick={(e) => {
								if (!confirm('להשהות את הפרסומת? היא תרד מהאתר והימים שנותרו יישמרו לה.')) e.preventDefault();
							}}
						>⏸ השהה</button>
					</form>
				{/if}
				<form method="POST" action="?/unapprove" class="contents" use:enhance>
					<input type="hidden" name="id" value={ad.id} />
					<button
						type="submit"
						class={GHOST}
						title="חוזרת לממתינות בלי מחיקה"
						onclick={(e) => {
							if (!confirm('להוריד את הפרסומת מהאתר ולהחזיר אותה לממתינות?')) e.preventDefault();
						}}
					>⬇ הורד</button>
				</form>
			{/if}
			{#if ad.status !== 'rejected'}
				<form method="POST" action="?/reject" class="contents" use:enhance>
					<input type="hidden" name="id" value={ad.id} />
					<input type="hidden" name="reason" value="" />
					<button type="submit" class={DANGER} title="דחייה עם סיבה (לא חובה)" onclick={askReason}>❌ דחה</button>
				</form>
			{/if}
		{/if}
		{#if live}
			<a class={GHOST} href="/ads/{ad.id}" target="_blank" title="דף הנחיתה באתר">👁 צפה</a>
		{/if}
	</div>
{/if}
