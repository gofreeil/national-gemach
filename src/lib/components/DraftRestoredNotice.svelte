<script lang="ts">
    // הודעה קטנה כשטופס שוחזר מטיוטה שמורה. המשתמש חייב לדעת שמה שהוא רואה
    // הוא מה שהוא מילא קודם — ושיש לו דרך בלחיצה אחת להתחיל מדף חלק.
    let { onDiscard, label = 'הטופס' }: { onDiscard: () => void; label?: string } = $props();
</script>

<div class="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/60 px-4 py-3 text-sm text-emerald-100">
    <span class="font-bold">💾 שחזרנו את מה שמילאת קודם — {label} ממשיך מהמקום שעצרת.</span>
    <button type="button" onclick={onDiscard}
        class="rounded-full border border-emerald-400/50 bg-emerald-900/60 px-3 py-1 text-xs font-bold text-emerald-100 transition-colors hover:bg-emerald-800/70">
        התחל מטופס ריק
    </button>
</div>
