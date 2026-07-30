<script lang="ts">
    // ============================================================
    // VerifiedStamp.svelte — חותמת "מאושר" לגמ"ח שעבר בדיקת מערכת
    // ------------------------------------------------------------
    // נראית כמו חותמת דיו רשמית: מסגרת כפולה, הטיה קלה, ירוק-אמרלד.
    // sm — לשורת התגים בכרטיס; md — ליד הכותרת בדף הגמ"ח.
    // מוצגת רק כש-gemach.verified=true (extra_fields.verified ב-Strapi,
    // ניתנת/מוסרת בתפריט הניהול או בפאנל).
    // ============================================================
    let { size = 'sm', tilt }: {
        size?: 'sm' | 'md';
        /** זווית החותמת במעלות (שלילי = נגד כיוון השעון). ברירת מחדל לפי הגודל. */
        tilt?: number;
    } = $props();

    const angle = $derived(tilt ?? (size === 'md' ? -6 : -3));
</script>

{#if size === 'md'}
    <span
        class="inline-flex select-none flex-col items-center rounded-lg border-2 border-emerald-400/80 px-2.5 py-1 leading-none"
        style="box-shadow: inset 0 0 0 2px rgba(16,185,129,0.25); transform: rotate({angle}deg);"
        title="הגמ&quot;ח עבר בדיקת מערכת ואושר"
        aria-label="גמ&quot;ח מאושר — עבר בדיקת מערכת"
    >
        <span class="text-sm font-black tracking-widest text-emerald-300">✓ מאושר</span>
        <span class="mt-0.5 text-[9px] font-bold tracking-wider text-emerald-400/80">נבדק ע"י המערכת</span>
    </span>
{:else}
    <span
        class="inline-flex select-none items-center gap-1 rounded-md border border-emerald-400/70 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-black tracking-wide text-emerald-300 leading-none"
        style="transform: rotate({angle}deg);"
        title="הגמ&quot;ח עבר בדיקת מערכת ואושר"
        aria-label="גמ&quot;ח מאושר — עבר בדיקת מערכת"
    >✓ מאושר</span>
{/if}
