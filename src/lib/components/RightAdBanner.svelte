<script lang="ts">
    import { onMount } from "svelte";

    let currentGroup = $state(0);
    let totalSwaps = $state(0);
    const MAX_SWAPS = 8; // 3 full cycles of 3 groups (original + 8 swaps = 9 steps)

    const ads = [
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-orange-400/60",
            bgColor: "bg-orange-800",
            hoverBorder: "hover:border-orange-500",
            hoverBg: "hover:bg-orange-700",
            textColor: "text-orange-200",
            hoverText: "group-hover:text-orange-100",
            buttonColor: "bg-orange-600 hover:bg-orange-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-blue-400/60",
            bgColor: "bg-blue-800",
            hoverBorder: "hover:border-blue-500",
            hoverBg: "hover:bg-blue-700",
            textColor: "text-blue-200",
            hoverText: "group-hover:text-blue-100",
            buttonColor: "bg-blue-600 hover:bg-blue-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-green-400/60",
            bgColor: "bg-green-800",
            hoverBorder: "hover:border-green-500",
            hoverBg: "hover:bg-green-700",
            textColor: "text-green-200",
            hoverText: "group-hover:text-green-100",
            buttonColor: "bg-green-600 hover:bg-green-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-amber-400/60",
            bgColor: "bg-amber-800",
            hoverBorder: "hover:border-amber-500",
            hoverBg: "hover:bg-amber-700",
            textColor: "text-amber-200",
            hoverText: "group-hover:text-amber-100",
            buttonColor: "bg-amber-600 hover:bg-amber-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-cyan-400/60",
            bgColor: "bg-cyan-800",
            hoverBorder: "hover:border-cyan-500",
            hoverBg: "hover:bg-cyan-700",
            textColor: "text-cyan-200",
            hoverText: "group-hover:text-cyan-100",
            buttonColor: "bg-cyan-600 hover:bg-cyan-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-red-400/60",
            bgColor: "bg-red-800",
            hoverBorder: "hover:border-red-500",
            hoverBg: "hover:bg-red-700",
            textColor: "text-red-200",
            hoverText: "group-hover:text-red-100",
            buttonColor: "bg-red-600 hover:bg-red-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-sky-400/60",
            bgColor: "bg-sky-800",
            hoverBorder: "hover:border-sky-500",
            hoverBg: "hover:bg-sky-700",
            textColor: "text-sky-200",
            hoverText: "group-hover:text-sky-100",
            buttonColor: "bg-sky-600 hover:bg-sky-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-teal-400/60",
            bgColor: "bg-teal-800",
            hoverBorder: "hover:border-teal-500",
            hoverBg: "hover:bg-teal-700",
            textColor: "text-teal-200",
            hoverText: "group-hover:text-teal-100",
            buttonColor: "bg-teal-600 hover:bg-teal-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-lime-400/60",
            bgColor: "bg-lime-800",
            hoverBorder: "hover:border-lime-500",
            hoverBg: "hover:bg-lime-700",
            textColor: "text-lime-200",
            hoverText: "group-hover:text-lime-100",
            buttonColor: "bg-lime-600 hover:bg-lime-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-yellow-400/60",
            bgColor: "bg-yellow-800",
            hoverBorder: "hover:border-yellow-500",
            hoverBg: "hover:bg-yellow-700",
            textColor: "text-yellow-200",
            hoverText: "group-hover:text-yellow-100",
            buttonColor: "bg-yellow-600 hover:bg-yellow-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-emerald-400/60",
            bgColor: "bg-emerald-800",
            hoverBorder: "hover:border-emerald-500",
            hoverBg: "hover:bg-emerald-700",
            textColor: "text-emerald-200",
            hoverText: "group-hover:text-emerald-100",
            buttonColor: "bg-emerald-600 hover:bg-emerald-500",
        },
        {
            text: "מקום פרסום",
            description: "יכול להיות שלך",
            borderColor: "border-slate-400/60",
            bgColor: "bg-slate-800",
            hoverBorder: "hover:border-slate-500",
            hoverBg: "hover:bg-slate-700",
            textColor: "text-slate-200",
            hoverText: "group-hover:text-slate-100",
            buttonColor: "bg-slate-600 hover:bg-slate-500",
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
                                מקום פרסום זה
                            </span>
                            <span
                                class="text-base font-bold {ad.textColor} {ad.hoverText} opacity-90 drop-shadow-sm"
                            >
                                - יכול להיות שלך
                            </span>
                        </div>
                    </div>

                    <a
                        href="https://community.gofreeil.com/about/advertise"
                        target="_blank"
                        rel="noopener noreferrer"
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
