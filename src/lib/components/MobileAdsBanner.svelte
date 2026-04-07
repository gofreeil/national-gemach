<script lang="ts">
    import { onMount } from 'svelte';
    import { ads } from '$lib/adsData';

    let showBanner = false;

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'Escape' && showBanner) {
            showBanner = false;
        }
    }

    onMount(() => {
        const timer = setTimeout(() => {
            showBanner = true;
        }, 5000);

        document.addEventListener('keydown', handleKeydown);
        return () => {
            clearTimeout(timer);
            document.removeEventListener('keydown', handleKeydown);
        };
    });
</script>

<!-- Mobile Ads Banner - Hidden on desktop -->
<div class="lg:hidden fixed bottom-0 left-0 right-0 z-[200]" aria-live="polite" aria-atomic="true">
    {#if showBanner}
        <div
            role="region"
            aria-label="פרסומות קהילתיות"
            class="bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-sm p-4"
        >
            <div class="space-y-2">
                {#each ads as ad}
                    <a
                        href={ad.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="{ad.title} – {ad.summary} (נפתח בחלון חדש)"
                        class="w-full flex items-center justify-between bg-gradient-to-r {ad.color} p-3 rounded-lg text-white hover:shadow-lg transition-all"
                    >
                        <div class="text-left">
                            <p class="font-bold text-sm">{ad.title}</p>
                            <p class="text-xs opacity-90">{ad.summary}</p>
                        </div>
                        <span class="text-lg" aria-hidden="true">→</span>
                    </a>
                {/each}
            </div>
            <button
                onclick={() => (showBanner = false)}
                aria-label="סגור פרסומות"
                class="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-xs font-bold transition-colors"
            >
                סגור
            </button>
        </div>
    {/if}
</div>
