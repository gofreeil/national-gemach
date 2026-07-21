<script lang="ts">
    import { cities, type Gemach } from '$lib/gemachData';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();
    let gemachim = $derived(data.gemachim);
    let categories = $derived(data.categories);

    /** מספר הערים שבהן יש גמ"חים בפועל (לשורת הסטטיסטיקה) */
    let cityCount = $derived(new Set(gemachim.map(g => g.city)).size);

    /** גמ"חים שהאדמין נעץ (⭐ בפאנל הניהול) */
    let featuredGemachim = $derived(gemachim.filter(g => g.featured));
    /** החדשים שנוספו — בלי הנעוצים, כדי לא להציג פעמיים */
    let newestGemachim = $derived(gemachim.filter(g => !g.featured).slice(0, 6));

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
                (g.neighborhood?.toLowerCase().includes(q) ?? false) ||
                (g.contact?.toLowerCase().includes(q) ?? false) ||
                (g.notes?.toLowerCase().includes(q) ?? false)
            );
            const cityQ = selectedCity.trim();
            const matchesCategory = !selectedCategory || g.category === selectedCategory;
            const matchesCity = !cityQ || g.city.includes(cityQ);
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
<section class="text-center py-6 md:py-8 px-4">
    <div class="flex items-center justify-center gap-4 md:gap-6 mb-5">
        <div class="h-40 w-40 md:h-52 md:w-52 flex-shrink-0 rounded-2xl overflow-hidden bg-white shadow-xl border-[3px] border-[#D4AF37] shadow-[0_0_0_1px_rgba(212,175,55,0.3),0_25px_50px_-12px_rgba(0,0,0,0.25)]">
            <img
                src="/images/logo.png"
                alt="הגמח הארצי לוגו"
                class="w-full h-full object-cover scale-[1.15]"
                style="object-position: center; translate: 0 4%;"
            />
        </div>

        <!-- סטטיסטיקות חיות — נגזרות מהנתונים בפועל (לא מוקאפ), צמודות ללוגו.
             צ'יפים כהים כדי שהמספרים והתוויות ייקראו על רקע הדף הבהיר. -->
        <div class="flex flex-col gap-2 md:gap-2.5">
            <div class="rounded-2xl bg-[#1c2f5a] border border-[#3b5794] shadow-md px-4 py-2 text-center min-w-[96px]">
                <div class="text-xl md:text-2xl font-black text-blue-300 leading-tight">{gemachim.length}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">גמחים רשומים</div>
            </div>
            <div class="rounded-2xl bg-[#1c2f5a] border border-[#3b5794] shadow-md px-4 py-2 text-center min-w-[96px]">
                <div class="text-xl md:text-2xl font-black text-purple-300 leading-tight">{cityCount}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">ערים</div>
            </div>
            <div class="rounded-2xl bg-[#1c2f5a] border border-[#3b5794] shadow-md px-4 py-2 text-center min-w-[96px]">
                <div class="text-xl md:text-2xl font-black text-pink-300 leading-tight">{categories.length}</div>
                <div class="text-[11px] md:text-xs font-semibold text-gray-300 leading-tight">קטגוריות</div>
            </div>
        </div>
    </div>
    <h1 class="sr-only">הגמ"ח הארצי – כל הגמחים בארץ בכף ידך</h1>

    <!-- Search Bar -->
    <div class="max-w-2xl mx-auto">
        <div class="flex gap-2 mb-4">
            <input
                type="search"
                bind:value={searchQuery}
                onkeydown={handleKey}
                placeholder="חפש לפי שם, עניין או עיר..."
                aria-label="חיפוש גמחים"
                class="flex-1 rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white placeholder-gray-400 px-4 py-3 text-base focus:outline-none focus:border-blue-400 focus:bg-[#243a6e] transition-all"
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
                class="rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white px-4 py-2 text-sm focus:outline-none focus:border-blue-400 cursor-pointer"
            >
                <option value="">כל הקטגוריות</option>
                {#each categories as cat}
                    <option value={cat.key}>{cat.icon} {cat.label}</option>
                {/each}
            </select>

            <input
                type="text"
                bind:value={selectedCity}
                onchange={doSearch}
                onkeydown={handleKey}
                list="home-cities-list"
                placeholder="כל הערים — הקלד שם עיר"
                aria-label="סנן לפי עיר"
                class="w-48 rounded-xl bg-[#1c2f5a] border border-[#4c6cb0] text-white placeholder-gray-400 px-4 py-2 text-sm focus:outline-none focus:border-blue-400 focus:bg-[#243a6e] transition-all"
            />
            <datalist id="home-cities-list">
                {#each cities as city (city)}
                    <option value={city}></option>
                {/each}
            </datalist>

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
                    <article class="bg-[#16264d] border border-[#3b5794] rounded-2xl p-5 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                        <div class="flex items-start gap-3">
                            <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                                {#if gemach.category === 'judaism'}<img src="/icons/menorah.svg" alt="" class="w-9 h-9 object-contain" />{:else}{getCategoryIcon(gemach.category)}{/if}
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
                                {#if gemach.contact}
                                    <p class="text-xs text-gray-400 mt-2">👤 {gemach.contact}</p>
                                {/if}
                                {#if gemach.notes}
                                    <p class="text-xs text-amber-300/80 mt-1">💬 {gemach.notes}</p>
                                {/if}
                                <div class="flex items-center gap-4 mt-3 flex-wrap">
                                    {#if gemach.phone}
                                        <a
                                            href="tel:{gemach.phone}"
                                            class="inline-flex items-center gap-2 text-sm font-bold text-green-400 hover:text-green-300 transition-colors"
                                            aria-label="התקשר ל{gemach.name}"
                                        >
                                            📞 {gemach.phone}
                                        </a>
                                    {/if}
                                    {#if gemach.link}
                                        <a
                                            href={gemach.link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            class="inline-flex items-center gap-2 text-sm font-bold text-blue-400 hover:text-blue-300 transition-colors"
                                        >
                                            🔗 קישור
                                        </a>
                                    {/if}
                                </div>
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
                    class="flex flex-col items-center gap-2 p-4 rounded-2xl bg-[#16264d] border border-[#3b5794]
                           hover:bg-[#213569] hover:border-[#5474b8] hover:scale-105 transition-all cursor-pointer"
                    aria-label="חפש גמחי {cat.label}"
                >
                    {#if cat.key === 'judaism'}<img src="/icons/menorah.svg" alt="" class="w-9 h-9 object-contain" />{:else}<span class="text-3xl" aria-hidden="true">{cat.icon}</span>{/if}
                    <span class="text-sm font-bold text-gray-200">{cat.label}</span>
                    <span class="text-xs text-gray-500">
                        {gemachim.filter(g => g.category === cat.key).length} גמחים
                    </span>
                </button>
            {/each}
        </div>

        {#snippet gemachCard(gemach: Gemach, pinned: boolean = false)}
            <article class="bg-[#16264d] border {pinned ? 'border-amber-500/30' : 'border-[#3b5794]'} rounded-2xl p-5 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                <div class="flex items-start gap-3">
                    <div class="text-3xl flex-shrink-0 mt-0.5" aria-hidden="true">
                        {#if gemach.category === 'judaism'}<img src="/icons/menorah.svg" alt="" class="w-9 h-9 object-contain" />{:else}{getCategoryIcon(gemach.category)}{/if}
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="font-black text-white text-lg leading-tight">
                            {#if pinned}<span class="text-amber-400 text-sm" aria-hidden="true">⭐</span> {/if}{gemach.name}
                        </h3>
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
        {/snippet}

        <!-- Featured Gemachim — נעוצים ע"י האדמין (⭐ בפאנל הניהול) -->
        {#if featuredGemachim.length > 0}
            <h2 class="text-2xl font-black text-white text-center mb-6">גמחים מומלצים</h2>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                {#each featuredGemachim as gemach (gemach.id)}
                    {@render gemachCard(gemach, true)}
                {/each}
            </div>
        {/if}

        <!-- Newest Gemachim -->
        <h2 class="text-2xl font-black text-white text-center mb-6">גמחים חדשים שנוספו</h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
            {#each newestGemachim as gemach (gemach.id)}
                {@render gemachCard(gemach)}
            {/each}
        </div>

        <!-- CTA -->
        <div class="text-center mt-10 p-8 rounded-2xl bg-gradient-to-r from-blue-900/40 to-purple-900/40 border border-blue-500/20">
            <div class="text-4xl mb-3" aria-hidden="true">➕</div>
            <h3 class="text-xl font-black text-white mb-2">יש לך גמח?</h3>
            <p class="text-gray-300 text-sm mb-4">הוסף אותו למאגר הארצי ועזור לאנשים למצוא אותך בקלות</p>
            <a
                href="https://community.gofreeil.com/gmachim/add"
                class="inline-block px-8 py-3 rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold hover:opacity-90 transition-opacity shadow-lg"
            >
                הוסף גמח חינם
            </a>
        </div>
    </section>
{/if}

<!-- מעבר לרשימת כל הגמ"חים (עם עימוד, 20 בכל עמוד) — בסוף דף הבית -->
<section class="px-4 pb-14 pt-2 text-center">
    <a
        href="/gemachim"
        class="group inline-flex flex-col items-center gap-2 rounded-2xl border border-blue-500/30 bg-gradient-to-r from-blue-900/40 to-purple-900/40 px-8 py-6 transition-all hover:border-blue-400/60 hover:from-blue-900/60 hover:to-purple-900/60"
    >
        <h2 class="text-2xl md:text-3xl font-black text-white group-hover:text-blue-200 transition-colors">
            לכלל הגמ"חים ←
        </h2>
        <p class="text-sm text-gray-300">עיון בכל {gemachim.length} הגמ"חים במאגר, 20 בכל עמוד</p>
    </a>
</section>
