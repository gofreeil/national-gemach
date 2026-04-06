<script lang="ts">
    import { onMount } from "svelte";

    let currentGroup = $state(0);
    let totalSwaps = $state(0);
    const MAX_SWAPS = 8; // 3 full cycles of 3 groups (original + 8 swaps = 9 steps)

    const ads = [
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-orange-500/30",
            bgColor: "bg-orange-900/10",
            hoverBorder: "hover:border-orange-500",
            hoverBg: "hover:bg-orange-900/20",
            textColor: "text-orange-400",
            hoverText: "group-hover:text-orange-200",
            buttonColor: "bg-orange-600 hover:bg-orange-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-blue-500/30",
            bgColor: "bg-blue-900/10",
            hoverBorder: "hover:border-blue-500",
            hoverBg: "hover:bg-blue-900/20",
            textColor: "text-blue-400",
            hoverText: "group-hover:text-blue-200",
            buttonColor: "bg-blue-600 hover:bg-blue-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-green-500/30",
            bgColor: "bg-green-900/10",
            hoverBorder: "hover:border-green-500",
            hoverBg: "hover:bg-green-900/20",
            textColor: "text-green-400",
            hoverText: "group-hover:text-green-200",
            buttonColor: "bg-green-600 hover:bg-green-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-amber-500/30",
            bgColor: "bg-amber-900/10",
            hoverBorder: "hover:border-amber-500",
            hoverBg: "hover:bg-amber-900/20",
            textColor: "text-amber-400",
            hoverText: "group-hover:text-amber-200",
            buttonColor: "bg-amber-600 hover:bg-amber-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-purple-500/30",
            bgColor: "bg-purple-900/10",
            hoverBorder: "hover:border-purple-500",
            hoverBg: "hover:bg-purple-900/20",
            textColor: "text-purple-400",
            hoverText: "group-hover:text-purple-200",
            buttonColor: "bg-purple-600 hover:bg-purple-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-red-500/30",
            bgColor: "bg-red-900/10",
            hoverBorder: "hover:border-red-500",
            hoverBg: "hover:bg-red-900/20",
            textColor: "text-red-400",
            hoverText: "group-hover:text-red-200",
            buttonColor: "bg-red-600 hover:bg-red-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-indigo-500/30",
            bgColor: "bg-indigo-900/10",
            hoverBorder: "hover:border-indigo-500",
            hoverBg: "hover:bg-indigo-900/20",
            textColor: "text-indigo-400",
            hoverText: "group-hover:text-indigo-200",
            buttonColor: "bg-indigo-600 hover:bg-indigo-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-teal-500/30",
            bgColor: "bg-teal-900/10",
            hoverBorder: "hover:border-teal-500",
            hoverBg: "hover:bg-teal-900/20",
            textColor: "text-teal-400",
            hoverText: "group-hover:text-teal-200",
            buttonColor: "bg-teal-600 hover:bg-teal-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-pink-500/30",
            bgColor: "bg-pink-900/10",
            hoverBorder: "hover:border-pink-500",
            hoverBg: "hover:bg-pink-900/20",
            textColor: "text-pink-400",
            hoverText: "group-hover:text-pink-200",
            buttonColor: "bg-pink-600 hover:bg-pink-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-yellow-500/30",
            bgColor: "bg-yellow-900/10",
            hoverBorder: "hover:border-yellow-500",
            hoverBg: "hover:bg-yellow-900/20",
            textColor: "text-yellow-400",
            hoverText: "group-hover:text-yellow-200",
            buttonColor: "bg-yellow-600 hover:bg-yellow-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-emerald-500/30",
            bgColor: "bg-emerald-900/10",
            hoverBorder: "hover:border-emerald-500",
            hoverBg: "hover:bg-emerald-900/20",
            textColor: "text-emerald-400",
            hoverText: "group-hover:text-emerald-200",
            buttonColor: "bg-emerald-600 hover:bg-emerald-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-fuchsia-500/30",
            bgColor: "bg-fuchsia-900/10",
            hoverBorder: "hover:border-fuchsia-500",
            hoverBg: "hover:bg-fuchsia-900/20",
            textColor: "text-fuchsia-400",
            hoverText: "group-hover:text-fuchsia-200",
            buttonColor: "bg-fuchsia-600 hover:bg-fuchsia-500",
        },
    ];

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
    class="hidden xl:block w-36 flex-shrink-0 relative h-fit pb-8 text-center"
>
    <h4
        class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-2"
    >
        תוכן שיווקי
    </h4>
    <div class="space-y-3">
        {#each displayedAds as ad, index}
            <div
                class="h-[470px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all {ad.hoverBorder} {ad.hoverBg} group duration-700 relative overflow-hidden"
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
                                {ad.text} זה
                            </span>
                            <span
                                class="text-base font-bold {ad.textColor} {ad.hoverText} opacity-90 drop-shadow-sm"
                            >
                                — {ad.description}
                            </span>
                        </div>
                    </div>

                    <a
                        href="/advertise"
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
