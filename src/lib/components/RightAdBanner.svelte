<script lang="ts">
    import { onMount } from "svelte";
    import { adSlots, type AdSlot, loadApprovedAds } from "$lib/adSlots";
    import { markAdSeen, trackAdClick } from "$lib/adTrack";

    const PER_VIEW = 4;      // כמה משבצות נראות בטור בו-זמנית
    const VIEW_MS = 14000;   // כמה זמן כל קבוצה נשארת על המסך (החלפה איטית)
    const FADE_MS = 900;     // אורך הדעיכה בין קבוצה לקבוצה

    let rotation = $state(0);
    let fading = $state(false);

    let slots = $derived($adSlots);
    let paid = $derived(
        slots.filter((s): s is Extract<AdSlot, { kind: 'real' }> => s.kind === 'real'),
    );
    let vacant = $derived(
        slots.filter((s): s is Extract<AdSlot, { kind: 'vacant' }> => s.kind === 'vacant'),
    );

    // המודעות בתשלום מוצמדות לראש הטור ואינן משתתפות בסבב: קודם הן התחלפו
    // כמו כל משבצת, ולכן מפרסם ששילם היה על המסך 14 שניות מכל 42 — ומי שהסתכל
    // בטור בזמן הלא נכון ראה רק משבצות פנויות. הסבב מתחלף מעכשיו רק במשבצות
    // הפנויות שמתחת להן. המספר על משבצת פנויה הוא מקומה בטור (2, 3, 4...),
    // ולא מקומה במאגר — כך שהמשבצת שאחרי מודעה בתשלום היא תמיד הבאה במספר,
    // ולא מספר מקרי שהסבב הגיע אליו.
    let displayedAds = $derived.by((): AdSlot[] => {
        // הטור מלא במודעות בתשלום — אז הן אלה שמתחלפות בסבב
        if (paid.length >= PER_VIEW) {
            const start = (rotation * PER_VIEW) % paid.length;
            return Array.from(
                { length: PER_VIEW },
                (_, i) => paid[(start + i) % paid.length],
            );
        }
        const free = Math.min(PER_VIEW - paid.length, vacant.length);
        const start = vacant.length > free ? (rotation * free) % vacant.length : 0;
        return [
            ...paid,
            ...Array.from({ length: free }, (_, i) => ({
                ...vacant[(start + i) % vacant.length],
                no: paid.length + i + 1,
            })),
        ];
    });

    // יש בכלל מה לסובב? (טור שכולו נראה בבת אחת נשאר קבוע)
    let rotates = $derived(
        paid.length >= PER_VIEW
            ? paid.length > PER_VIEW
            : vacant.length > PER_VIEW - paid.length,
    );

    // כל מודעה שנכנסת לקבוצה המוצגת נספרת כחשיפה (פעם אחת לכל ביקור)
    $effect(() => {
        for (const item of displayedAds) {
            if (item.kind === 'real') markAdSeen(item.ad.id);
        }
    });

    onMount(() => {
        loadApprovedAds();
        let fadeTimer: ReturnType<typeof setTimeout> | undefined;
        // דעיכה החוצה → החלפת הקבוצה בזמן שהטור שקוף → דעיכה פנימה.
        // כך אין קפיצה: המשבצות לא מתחלפות מול העין אלא מתוך שקיפות מלאה.
        const interval = setInterval(() => {
            if (!rotates) return;
            fading = true;
            fadeTimer = setTimeout(() => {
                rotation++;
                fading = false;
            }, FADE_MS);
        }, VIEW_MS);

        return () => {
            clearInterval(interval);
            clearTimeout(fadeTimer);
        };
    });
</script>

<!-- RightAdBanner.svelte -->
<aside
    aria-label="פרסומות"
    class="hidden xl:block w-36 flex-shrink-0 sticky top-4 h-fit pb-8 text-center"
>
    <h4
        class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-2"
    >
        תוכן שיווקי
    </h4>
    <div class="space-y-3">
        {#each displayedAds as item}
            {#if item.kind === 'real'}
                <!-- מודעה אמיתית מהבילדר — קליק מוביל לדף הנחיתה המקומי -->
                <a
                    href="/ads/{item.ad.id}"
                    onclick={() => trackAdClick(item.ad.id)}
                    class="h-[490px] flex flex-col rounded-2xl overflow-hidden shadow-lg transition-transform hover:scale-105 group relative"
                >
                    <div class="flex-1 relative overflow-hidden bg-black/30">
                        {#if item.ad.mainImage}
                            <!-- בריחוף העכבר התמונה נמוגה ומפנה מקום לתוכן שהמפרסם כתב -->
                            <img
                                src={item.ad.mainImage}
                                alt={item.ad.title}
                                loading="lazy"
                                decoding="async"
                                class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 group-hover:opacity-0"
                            />
                        {/if}
                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-center transition-opacity duration-700 group-hover:opacity-0">
                            <h3 class="text-white font-black text-sm leading-tight">{item.ad.title}</h3>
                            {#if item.ad.subtitle}
                                <p class="text-gray-200 text-[11px] leading-tight mt-0.5">{item.ad.subtitle}</p>
                            {/if}
                        </div>

                        <!-- שכבת הריחוף: "טקסט הריחוף" מהבילדר — התוכן הנוסף
                             שנועד למכור, בדיוק כמו בכרטיס של קהילה בשכונה -->
                        <div
                            class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 text-center opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                        >
                            <div>
                                <h3 class="text-white font-black text-sm leading-tight mb-1">{item.ad.title}</h3>
                                {#if item.ad.subtitle}
                                    <p class="text-gray-200 text-[11px] leading-tight">{item.ad.subtitle}</p>
                                {/if}
                                {#if item.ad.hover}
                                    <p class="mt-2 pt-2 border-t border-white/20 text-amber-200 text-[11px] font-bold leading-snug">
                                        {item.ad.hover}
                                    </p>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <div
                        class="p-2.5 text-center"
                        style="background: {item.ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"
                    >
                        <p class="text-white font-bold text-xs leading-tight">{item.ad.cta || 'לפרטים'}</p>
                    </div>
                </a>
            {:else}
                {@const ad = item.slot}
                <!-- משבצת פנויה — כל הבאנר הוא קישור לדף הפרסום, לא רק כפתור "לפרטים" -->
                <a
                    href={ad.href}
                    aria-label="{ad.text} — {ad.description}: לדף הפרסום"
                    class="slot-fade h-[490px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all {ad.hoverBorder} {ad.hoverBg} group duration-700 relative overflow-hidden"
                    class:fading
                >
                    <!-- Ad Numbering -->
                    <div
                        class="absolute top-3 right-3 text-sm font-black text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm shadow-sm"
                    >
                        {item.no}
                    </div>

                    <div
                        class="flex flex-col items-center justify-between h-full py-6 relative overflow-hidden w-full"
                    >
                        <div
                            class="text-3xl mt-4 z-10 transition-transform group-hover:scale-125 duration-300"
                        >
                            📢
                        </div>

                        <div
                            class="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <div
                                class="-rotate-90 flex items-center gap-3 whitespace-nowrap transform origin-center"
                            >
                                <span
                                    class="text-2xl font-black {ad.textColor} {ad.hoverText} tracking-wider drop-shadow-sm"
                                >
                                    {ad.text}
                                </span>
                                <span
                                    class="text-base font-bold {ad.textColor} {ad.hoverText} opacity-90 drop-shadow-sm"
                                >
                                    - {ad.description}
                                </span>
                            </div>
                        </div>

                        <span
                            class="mb-4 z-10 rounded-full {ad.buttonColor} px-5 py-2 text-sm font-bold text-white shadow-xl transition-transform group-hover:scale-105"
                        >
                            לפרטים
                        </span>
                    </div>
                </a>
            {/if}
        {/each}
    </div>
</aside>

<style>
    /* דעיכה רכה בהחלפת משבצת פנויה — במקום החלקה קופצנית. הדעיכה חלה על
       המשבצות הפנויות בלבד (ולא על כל הטור כמו קודם), כי המודעות בתשלום
       מוצמדות ואינן מתחלפות — הבהוב שלהן היה סתם רעש.
       הערך חייב להתאים ל-FADE_MS שבסקריפט. */
    .slot-fade {
        opacity: 1;
        /* transition-property נשאר all (כמו במחלקות Tailwind על הכרטיס) כדי
           שגם מעברי הריחוף ימשיכו לעבוד — רק המשך מיושר ל-FADE_MS */
        transition-property: all;
        transition-duration: 900ms;
        transition-timing-function: ease-in-out;
    }
    .slot-fade.fading {
        opacity: 0;
    }
    @media (prefers-reduced-motion: reduce) {
        .slot-fade {
            transition-duration: 1ms;
        }
    }
</style>
