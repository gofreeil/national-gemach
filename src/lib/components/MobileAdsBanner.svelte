<script lang="ts">
    import { onMount } from 'svelte';

    let showBanner = $state(false);

    const ads = [
        { title: 'בתי הפיוס', summary: 'עזרה בדין ופיוס', url: 'https://www.melecshop.com/page/peace-on-earth', color: 'from-orange-600 to-red-600' },
        { title: 'ועדי שכונות', summary: 'הצטרף לוועד שכונתך', url: 'https://www.melecshop.com/page/peace-on-earth_VRHH', color: 'from-blue-600 to-cyan-600' },
        { title: 'קבוצת רכישה', summary: 'הוזל את ההוצאות', url: 'https://purchasing-groups.vercel.app/', color: 'from-green-600 to-emerald-600' },
        { title: 'בעלי מקצוע', summary: 'כשירים ומומלצים', url: 'https://index-chi-sage.vercel.app/', color: 'from-yellow-500 to-orange-500' },
        { title: 'ביקורת עירייה', summary: 'מיצוי זכויות', url: 'https://right-to-live.vercel.app/', color: 'from-red-600 to-pink-600' },
    ];

    onMount(() => {
        const timer = setTimeout(() => { showBanner = true; }, 5000);
        return () => clearTimeout(timer);
    });
</script>

<div class="lg:hidden fixed bottom-0 left-0 right-0 z-[200]" aria-live="polite">
    {#if showBanner}
        <div role="region" aria-label="פרסומות קהילתיות" class="bg-gradient-to-t from-black/90 to-black/70 backdrop-blur-sm p-3">
            <div class="space-y-2">
                {#each ads as ad}
                    <a
                        href={ad.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="{ad.title} – {ad.summary} (נפתח בחלון חדש)"
                        class="flex items-center justify-between bg-gradient-to-r {ad.color} px-3 py-2 rounded-lg text-white hover:opacity-90 transition-opacity"
                    >
                        <div>
                            <p class="font-bold text-sm">{ad.title}</p>
                            <p class="text-xs opacity-90">{ad.summary}</p>
                        </div>
                        <span aria-hidden="true">←</span>
                    </a>
                {/each}
            </div>
            <button
                onclick={() => showBanner = false}
                aria-label="סגור פרסומות"
                class="w-full mt-2 bg-gray-700 hover:bg-gray-600 text-white py-2 rounded-lg text-xs font-bold transition-colors"
            >
                סגור
            </button>
        </div>
    {/if}
</div>
