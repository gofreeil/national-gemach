<script lang="ts">
    import { ads } from '$lib/adsData';
</script>

<aside
    aria-label="פרסומות ושותפים"
    class="hidden lg:block w-48 flex-shrink-0 sticky top-4 h-fit pb-8 text-center"
>
    <h4 class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-2">
        מתקדמים לחברה מתוקנת ועצמאית
    </h4>
    <div class="space-y-4">
        {#each ads as ad (ad.id)}
            <a
                href={ad.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="{ad.title} – {ad.description} (נפתח בחלון חדש)"
                class="block overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105 group relative"
            >
                <div class="relative overflow-hidden" style="height: {ad.imageHeight ?? '160px'}">
                    <div class="absolute inset-0 overflow-hidden">
                        <img
                            src={ad.image}
                            alt={ad.title}
                            loading="lazy"
                            decoding="async"
                            class="w-full h-full object-cover transition-opacity duration-[1500ms] group-hover:opacity-0"
                        />
                    </div>
                    <div
                        class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-[1500ms] flex items-center justify-center bg-black/60 backdrop-blur-sm"
                    >
                        <div class="relative z-10 text-center px-4">
                            <h3 class="text-white font-bold text-base mb-1">{ad.title}</h3>
                            <p class="text-gray-200 text-xs">{ad.description}</p>
                        </div>
                    </div>
                </div>
                <div class="relative group/cta bg-gradient-to-r {ad.color} p-3 text-center">
                    <p class="text-white font-bold text-xs leading-tight">{ad.cta}</p>
                    {#if ad.hover}
                        <span class="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover/cta:block
                                     bg-gray-900 text-white text-xs font-bold rounded-lg px-3 py-1.5
                                     whitespace-nowrap border border-white/10 shadow-xl pointer-events-none z-50">
                            {ad.hover}
                        </span>
                    {/if}
                </div>
            </a>
        {/each}
    </div>
</aside>
