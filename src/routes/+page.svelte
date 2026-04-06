<script lang="ts">
    import { gemachim, categories, cities, type Gemach } from '$lib/gemachData';

    let searchQuery = $state('');
    let selectedCategory = $state('');
    let selectedCity = $state('');
    let showResults = $state(false);

    let filteredGemachim = $derived(() => {
        const q = searchQuery.trim().toLowerCase();
        return gemachim.filter(g => {
            const matchesQuery = !q || (
                g.name.toLowerCase().includes(q) ||
                g.description.toLowerCase().includes(q) ||
                g.tags.some(t => t.toLowerCase().includes(q)) ||
                g.city.toLowerCase().includes(q) ||
                (g.neighborhood?.toLowerCase().includes(q) ?? false)
            );
            const matchesCategory = !selectedCategory || g.category === selectedCategory;
            const matchesCity = !selectedCity || g.city === selectedCity;
            return matchesQuery && matchesCategory && matchesCity;
        });
    });

    function doSearch() {
        showResults = true;
    }

    function handleKey(e: KeyboardEvent) {
        if (e.key === 'Enter') doSearch();
    }

    function clearFilters() {
        searchQuery = '';
        selectedCategory = '';
        selectedCity = '';
        showResults = false;
    }

    function getCategoryLabel(key: string) {
        return categories.find(c => c.key === key)?.label ?? key;
    }

    function getCategoryIcon(key: string) {
        return categories.find(c => c.key === key)?.icon ?? '📦';
    }
</script>

<!-- Hero Section -->
<section class="text-center py-10 md:py-16 px-4">
    <div class="mb-4 text-6xl md:text-7xl" aria-hidden="true">🤝</div>
    <h1 class="text-4xl md:text-5xl font-black mb-3 bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 bg-clip-text text-transparent">
        הגמח הארצי
    </h1>
    <p class="text-xl md:text-2xl text-gray-300 font-bold mb-8">
        כל הגמחים תחת קורת גג אחת
    </p>

    <!-- Search Bar -->
    <div class="max-w-2xl mx-auto">
        <div class="flex gap-2 mb-4">
            <input
                type="search"
                bind:value={searchQuery}
                onkeydown={handleKey}
                placeholder="חפש לפי שם, עניין או עיר..."
                aria-label="חיפוש גמחים"
                class="flex-1 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 px-4 py-3 text-base focus:outline-none focus:border-blue-400 focus:bg-white/15 transition-all"
            />
            <button
                onclick={doSearch}
                class="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 active:scale-95 transition-all shadow-lg"
            >
                חפש 🔍
            </button>
        </div>

        <!-- Filters Row -->
        <div class="flex gap-3 flex-wrap justify-center">
            <select
                bind:value={selectedCategory}
                onchange={doSearch}
                aria-label="סנן לפי קטגוריה"
                class="rounded-xl bg-white/10 border border-white/20 text-white px-4 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
            >
                <option value="">כל הקטגוריות</option>
                {#each categories as cat}
                    <option value={cat.key}>{cat.icon} {cat.label}</option>
                {/each}
            </select>

            <select
                bind:value={selectedCity}
                onchange={doSearch}
                aria-label="סנן לפי עיר"
                class="rounded-xl bg-white/10 border border-white/20 text-white px-4 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
            >
                <option value="">כל הערים</option>
                {#each cities as city}
                    <option value={city}>{city}</option>
                {/each}
            </select>

            {#if showResults || selectedCategory || selectedCity}
                <button
                    onclick={clearFilters}
                    class="rounded-xl bg-red-900/40 border border-red-500/30 text-red-300 px-4 py-2 text-sm hover:bg-red-900/60 transition-colors"
                >
                    נקה הכל ✕
                </button>
            {/if}
        </div>
    </div>
</section>

<!-- Stats Bar -->
<div class="max-w-2xl mx-auto px-4 mb-8">
    <div class="flex justify-center gap-6 flex-wrap">
        <div class="text-center">
            <div class="text-2xl font-black text-blue-400">{gemachim.length}+</div>
            <div class="text-xs text-gray-400">גמחים רשומים</div>
        </div>
        <div class="text-center">
            <div class="text-2xl font-black text-purple-400">{cities.length}+</div>
            <div class="text-xs text-gray-400">ערים</div>
        </div>
        <div class="text-center">
            <div class="text-2xl font-black text-pink-400">{categories.length}</div>
            <div class="text-xs text-gray-400">קטגוריות</div>
        </div>
    </div>
</div>

<!-- Results / Categories -->
{#if showResults || selectedCategory || selectedCity}
    <!-- Search Results -->
    <section class="px-2 md:px-4 pb-8" aria-label="תוצאות חיפוש">
        <div class="flex items-center justify-between mb-4">
            <h2 class="text-xl font-bold text-white">
                נמצאו <span class="text-blue-400">{filteredGemachim().length}</span> גמחים
            </h2>
        </div>

        {#if filteredGemachim().length === 0}
            <div class="text-center py-16 text-gray-400">
                <div class="text-5xl mb-4" aria-hidden="true">🔍</div>
                <p class="text-lg font-bold">לא נמצאו גמחים מתאימים</p>
                <p class="text-sm mt-2">נסה לחפש במילים אחרות או לשנות את הפילטרים</p>
                <button onclick={clearFilters} class="mt-4 px-6 py-2 rounded-xl bg-blue-600/30 text-blue-300 hover:bg-blue-600/50 transition-colors">
                    נקה חיפוש
                </button>
            </div>
        {:else}
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                {#each filteredGemachim() as gemach (gemach.id)}
                    <article class="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-white/20 transition-all">
                        <div class="flex items-start gap-3">
                            <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                                {getCategoryIcon(gemach.category)}
                            </div>
                            <div class="flex-1 min-w-0">
                                <h3 class="font-black text-white text-lg leading-tight">{gemach.name}</h3>
                                <div class="flex items-center gap-2 mt-1 flex-wrap">
                                    <span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                        {getCategoryLabel(gemach.category)}
                                    </span>
                                    <span class="text-xs text-gray-400">
                                        📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                                    </span>
                                </div>
                                <p class="text-gray-300 text-sm mt-2 leading-relaxed">{gemach.description}</p>
                                {#if gemach.phone}
                                    <a
                                        href="tel:{gemach.phone}"
                                        class="inline-flex items-center gap-2 mt-3 text-sm font-bold text-green-400 hover:text-green-300 transition-colors"
                                        aria-label="התקשר ל{gemach.name}"
                                    >
                                        📞 {gemach.phone}
                                    </a>
                                {/if}
                            </div>
                        </div>
                    </article>
                {/each}
            </div>
        {/if}
    </section>

{:else}
    <!-- Category Grid (default view) -->
    <section class="px-2 md:px-4 pb-8" aria-label="קטגוריות גמחים">
        <h2 class="text-2xl font-black text-white text-center mb-6">חפש לפי קטגוריה</h2>
        <div class="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 max-w-3xl mx-auto mb-10">
            {#each categories as cat}
                <button
                    onclick={() => { selectedCategory = cat.key; doSearch(); }}
                    class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10
                           hover:bg-white/10 hover:border-white/25 hover:scale-105 transition-all cursor-pointer"
                    aria-label="חפש גמחי {cat.label}"
                >
                    <span class="text-3xl" aria-hidden="true">{cat.icon}</span>
                    <span class="text-sm font-bold text-gray-200">{cat.label}</span>
                    <span class="text-xs text-gray-500">
                        {gemachim.filter(g => g.category === cat.key).length} גמחים
                    </span>
                </button>
            {/each}
        </div>

        <!-- Featured Gemachim -->
        <h2 class="text-2xl font-black text-white text-center mb-6">גמחים מומלצים</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each gemachim.slice(0, 6) as gemach (gemach.id)}
                <article class="bg-white/5 border border-white/10 rounded-2xl p-5 hover:bg-white/8 hover:border-white/20 transition-all">
                    <div class="flex items-start gap-3">
                        <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                            {getCategoryIcon(gemach.category)}
                        </div>
                        <div class="flex-1 min-w-0">
                            <h3 class="font-black text-white text-lg leading-tight">{gemach.name}</h3>
                            <div class="flex items-center gap-2 mt-1 flex-wrap">
                                <span class="text-xs bg-blue-900/50 text-blue-300 px-2 py-0.5 rounded-full border border-blue-500/30">
                                    {getCategoryLabel(gemach.category)}
                                </span>
                                <span class="text-xs text-gray-400">
                                    📍 {gemach.city}{gemach.neighborhood ? ` – ${gemach.neighborhood}` : ''}
                                </span>
                            </div>
                            <p class="text-gray-300 text-sm mt-2 leading-relaxed line-clamp-2">{gemach.description}</p>
                            {#if gemach.phone}
                                <a
                                    href="tel:{gemach.phone}"
                                    class="inline-flex items-center gap-2 mt-3 text-sm font-bold text-green-400 hover:text-green-300 transition-colors"
                                    aria-label="התקשר ל{gemach.name}"
                                >
                                    📞 {gemach.phone}
                                </a>
                            {/if}
                        </div>
                    </div>
                </article>
            {/each}
        </div>

        <!-- CTA -->
        <div class="text-center mt-10 p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/20">
            <div class="text-4xl mb-3" aria-hidden="true">➕</div>
            <h3 class="text-xl font-black text-white mb-2">יש לך גמח?</h3>
            <p class="text-gray-300 text-sm mb-4">הוסף אותו למאגר הארצי ועזור לאנשים למצוא אותך בקלות</p>
            <a
                href="/add"
                class="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
                הוסף גמח חינם
            </a>
        </div>
    </section>
{/if}
