<script lang="ts">
    import { onMount } from "svelte";
    import { rightAds as ads } from "$lib/rightAdsData";

    let currentGroup = $state(0);
    let totalSwaps = $state(0);
    const MAX_SWAPS = 8; // 3 full cycles of 3 groups (original + 8 swaps = 9 steps)

    onMount(() => {
        const interval = setInterval(() => {
            if (totalSwaps < MAX_SWAPS) {
                currentGroup = (currentGroup + 1) % 3;
                totalSwaps++;
            } else {
                clearInterval(interval);
            }
        }, 6000);

        return () => clearInterval(interval);
    });

    let displayedAds = $derived(
        ads.slice(currentGroup * 4, (currentGroup + 1) * 4),
    );
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
        {#each displayedAds as ad, index}
            <div
                class="h-[490px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all {ad.hoverBorder} {ad.hoverBg} group duration-700 relative overflow-hidden"
                style="animation: fadeIn 0.7s ease-in-out;"
            >
                <!-- Ad Numbering -->
                <div
                    class="absolute top-3 right-3 text-sm font-black text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm shadow-sm"
                >
                    {currentGroup * 4 + index + 1}
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

                    <a
                        href={ad.href}
                        class="mb-4 z-10 rounded-full {ad.buttonColor} px-5 py-2 text-sm font-bold text-white shadow-xl transition-transform hover:scale-105"
                    >
                        לפרטים
                    </a>
                </div>
            </div>
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
