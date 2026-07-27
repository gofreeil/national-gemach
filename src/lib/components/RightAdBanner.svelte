<script lang="ts">
    import { onMount } from "svelte";
    import { adSlots, loadApprovedAds } from "$lib/adSlots";

    const PER_VIEW = 4; // כמה משבצות נראות בטור בו-זמנית

    let rotation = $state(0);
    let totalSwaps = $state(0);
    const MAX_SWAPS = 8; // 3 full cycles of 3 groups (original + 8 swaps = 9 steps)

    onMount(() => {
        loadApprovedAds();
        const interval = setInterval(() => {
            if (totalSwaps < MAX_SWAPS) {
                rotation++;
                totalSwaps++;
            } else {
                clearInterval(interval);
            }
        }, 6000);

        return () => clearInterval(interval);
    });

    // מודעות בתשלום מוצמדות לראש הטור ואינן משתתפות בסבב.
    // למה: הסבב עבר על שלישיות של 4 משבצות ונעצר אחרי 8 החלפות —
    // כלומר על הקבוצה האחרונה, שבה אין מודעות אמיתיות. התוצאה הייתה
    // שמודעה ששולם עליה נראתה 6 שניות ואז נעלמה עד רענון הדף.
    let paid = $derived(
        $adSlots.filter((s) => s.kind === "real").slice(0, PER_VIEW),
    );
    let vacant = $derived($adSlots.filter((s) => s.kind === "vacant"));

    // המשבצות הפנויות ממשיכות להתחלף במקומות שנשארו פנויים בטור
    let displayedAds = $derived.by(() => {
        const room = PER_VIEW - paid.length;
        if (room <= 0 || vacant.length === 0) return paid;
        const start = (rotation * room) % vacant.length;
        const cycle = Array.from(
            { length: Math.min(room, vacant.length) },
            (_, i) => vacant[(start + i) % vacant.length],
        );
        return [...paid, ...cycle];
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
                    title={item.ad.hover || undefined}
                    class="h-[490px] flex flex-col rounded-2xl overflow-hidden shadow-lg transition-transform hover:scale-105 group relative"
                    style="animation: fadeIn 0.7s ease-in-out;"
                >
                    <div class="flex-1 relative overflow-hidden bg-black/30">
                        {#if item.ad.mainImage}
                            <img
                                src={item.ad.mainImage}
                                alt={item.ad.title}
                                loading="lazy"
                                decoding="async"
                                class="absolute inset-0 w-full h-full object-cover"
                            />
                        {/if}
                        <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent p-2 pt-8 text-center">
                            <h3 class="text-white font-black text-sm leading-tight">{item.ad.title}</h3>
                            {#if item.ad.subtitle}
                                <p class="text-gray-200 text-[11px] leading-tight mt-0.5">{item.ad.subtitle}</p>
                            {/if}
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
                    class="h-[490px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all {ad.hoverBorder} {ad.hoverBg} group duration-700 relative overflow-hidden"
                    style="animation: fadeIn 0.7s ease-in-out;"
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
    @keyframes fadeIn {
        from {
            opacity: 0;
            transform: translateX(10px);
        }
        to {
            opacity: 1;
            transform: translateX(0);
        }
    }
</style>
