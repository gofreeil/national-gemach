<script lang="ts">
    import { ads } from '$lib/adsData';
</script>

<aside
    aria-label="פרסומות ושותפים"
    class="hidden lg:block w-48 flex-shrink-0 relative h-fit pb-8 text-center"
>
    <h4
        class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-2"
    >
        מתקדמים לחברה מתוקנת ועצמאית
    </h4>
    <div class="space-y-4">
        {#each ads as ad}
        <a
            href={ad.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="{ad.title} – {ad.summary} (נפתח בחלון חדש)"
            class="block overflow-hidden rounded-lg shadow-lg transition-transform hover:scale-105 group relative {ad.extraClass ?? ''}"
        >
            <div
                class="relative overflow-hidden {ad.imageContain ? 'bg-gradient-to-br from-blue-900 to-cyan-900' : ''}"
                style={ad.imageStyle ?? ''}
            >
                <img
                    src={ad.image}
                    alt={ad.title}
                    class="w-full object-cover transition-opacity duration-1500 group-hover:opacity-0 {ad.imageStyle ? 'h-full' : 'h-auto'} {ad.imageContain ? 'object-contain' : ''}"
                />
                <!-- Hover overlay -->
                <div
                    class="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-1500 flex items-center justify-center {ad.imageContain ? 'bg-gradient-to-br from-blue-900 to-cyan-900' : ''}"
                    style={!ad.imageContain ? `background-image: url('${ad.image}'); background-size: cover; background-position: center;` : ''}
                >
                    <div class="absolute inset-0 bg-black/60 backdrop-blur-sm"></div>
                    <div class="relative z-10 text-center px-4">
                        {#if ad.hoverTitle}
                        <h3 class="text-white font-bold text-lg mb-2">{ad.hoverTitle}</h3>
                        {/if}
                        {#if ad.hoverText}
                        <p class="text-gray-200 text-sm">{ad.hoverText}</p>
                        {/if}
                    </div>
                </div>
                {#if ad.comingSoon}
                <div class="absolute top-4 right-4 bg-red-600 text-white px-4 py-2 rounded-lg shadow-lg transform rotate-12 z-20">
                    <p class="font-bold text-sm">בקרוב</p>
                </div>
                {/if}
            </div>
            <div class="bg-gradient-to-r {ad.color} p-3 text-center">
                <p class="text-white font-bold text-xs leading-tight">{ad.footerText ?? ad.summary}</p>
            </div>
        </a>
        {/each}

    </div>
</aside>
