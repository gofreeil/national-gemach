<script lang="ts">
    import { page } from '$app/stores';
    import GemachAvatar from '$lib/components/GemachAvatar.svelte';
    import Breadcrumbs from '$lib/components/Breadcrumbs.svelte';
    import type { PageData } from './$types';

    let { data }: { data: PageData } = $props();

    /** חזרה מעריכה מוצלחת (redirect עם ?flash=updated) */
    const justUpdated = $derived($page.url.searchParams.get('flash') === 'updated');

    /** גמ"ח שזה עתה נוצר (redirect עם ?flash=created) — מציג אישור וקישור לאתר המקביל */
    const justCreated = $derived($page.url.searchParams.get('flash') === 'created');

    const gemach = $derived(data.gemach);
    const categoryLabel = $derived(
        data.categories.find(c => c.key === gemach.category)?.label ?? gemach.category
    );

    /** הגלריה בלי תמונת הלוגו — כדי לא להציג את אותה תמונה פעמיים */
    const gallery = $derived((gemach.gallery ?? []).filter(u => u !== gemach.image));

    /** התמונה שנפתחה במסך מלא (null = סגור) */
    let lightbox = $state<string | null>(null);

    const fullAddress = $derived(
        [gemach.address, gemach.neighborhood, gemach.city].filter(Boolean).join(', ')
    );

    /** טלפון לחיוג/ואטסאפ: ספרות בלבד, עם קידומת בינלאומית לוואטסאפ */
    const phoneDigits = $derived((gemach.phone ?? '').replace(/\D/g, ''));
    const waPhone = $derived(
        phoneDigits.startsWith('0') ? `972${phoneDigits.slice(1)}` : phoneDigits
    );

    const canonical = $derived(`https://gemach.gofreeil.com/gemach/${gemach.id}`);
    const metaDescription = $derived(
        (gemach.description || `גמ"ח ${categoryLabel} ב${gemach.city}`).slice(0, 155)
    );

    // Schema.org — מאפשר לגוגל להציג את הגמ"ח כעסק מקומי עם כתובת וטלפון
    const jsonLd = $derived(JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'LocalBusiness',
        name: gemach.name,
        description: gemach.description || undefined,
        url: canonical,
        telephone: gemach.phone || undefined,
        image: gemach.image || undefined,
        address: {
            '@type': 'PostalAddress',
            streetAddress: gemach.address || undefined,
            addressLocality: gemach.city,
            addressCountry: 'IL',
        },
        ...(typeof gemach.lat === 'number' && typeof gemach.lng === 'number'
            ? { geo: { '@type': 'GeoCoordinates', latitude: gemach.lat, longitude: gemach.lng } }
            : {}),
    }));
</script>

<svelte:head>
    <title>{gemach.name} – גמ"ח {categoryLabel} ב{gemach.city} | הגמ"ח הארצי</title>
    <meta name="description" content={metaDescription} />
    <link rel="canonical" href={canonical} />
    <meta property="og:title" content={`${gemach.name} – גמ"ח ${categoryLabel} ב${gemach.city}`} />
    <meta property="og:description" content={metaDescription} />
    <meta property="og:url" content={canonical} />
    <meta property="og:type" content="website" />
    {#if gemach.image}<meta property="og:image" content={gemach.image} />{/if}
    {@html `<script type="application/ld+json">${jsonLd}<` + `/script>`}
</svelte:head>

<svelte:window onkeydown={(e) => { if (e.key === 'Escape') lightbox = null; }} />

<article class="px-3 md:px-4 py-6 max-w-3xl mx-auto">
    <!-- ניווט עליון: כפתור חזרה + פירורי לחם, בגלולה כהה לקריאוּת על הרקע הוורוד -->
    <Breadcrumbs
        fallback="/gemachim"
        crumbs={[
            { label: 'דף הבית', href: '/' },
            { label: 'כל הגמ"חים', href: '/gemachim' },
            { label: gemach.name }
        ]}
    />

    {#if justUpdated}
        <div class="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-bold text-emerald-200">
            ✅ הגמ"ח עודכן בהצלחה
        </div>
    {/if}

    {#if justCreated}
        <div class="mb-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-4">
            <p class="text-sm font-black text-emerald-200">✅ הגמ"ח נוצר ופורסם בהצלחה!</p>
            <p class="mt-1 text-sm leading-relaxed text-emerald-100/80">
                הוא מופיע עכשיו גם באתר המקביל <span class="font-bold">קהילה בשכונה</span> — אותו גמ"ח, שתי רשתות.
            </p>
            <a href="https://community.gofreeil.com/?item={gemach.id}" target="_blank" rel="noopener noreferrer"
                class="mt-3 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                🕊️ צפה בגמ"ח שלך על מפת השכונה בקהילה בשכונה
            </a>
        </div>
    {/if}

    {#if data.canEdit}
        <div class="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3">
            <span class="text-sm font-bold text-amber-200">✨ זהו הגמ"ח שלך — אפשר לעדכן את הפרטים</span>
            <a href="/gemach/{gemach.id}/edit"
                class="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-pink-600 px-4 py-2 text-sm font-bold text-white transition hover:opacity-90">
                ✏️ ערוך את הגמ"ח
            </a>
        </div>
    {/if}

    <!-- כותרת -->
    <header class="bg-[#16264d] border border-[#3b5794] rounded-2xl p-5 md:p-6">
        <div class="flex items-start gap-4">
            <div class="flex-shrink-0 text-4xl">
                <GemachAvatar {gemach} categories={data.categories} />
            </div>
            <div class="flex-1 min-w-0">
                <h1 class="text-2xl md:text-3xl font-black text-white leading-tight">{gemach.name}</h1>
                <div class="flex items-center gap-2 mt-2 flex-wrap">
                    <a href="/?category={gemach.category}"
                        class="text-xs bg-blue-900/50 text-blue-300 px-2.5 py-1 rounded-full border border-blue-500/30 hover:bg-blue-900/80 transition-colors">
                        {categoryLabel}
                    </a>
                    <span class="text-xs text-gray-400">📍 {fullAddress || gemach.city}</span>
                    {#if gemach.featured}
                        <span class="text-xs text-amber-300" aria-label="גמ&quot;ח מומלץ">⭐ מומלץ</span>
                    {/if}
                </div>
            </div>
        </div>

        {#if gemach.description}
            <p class="text-gray-200 leading-relaxed mt-4 whitespace-pre-line">{gemach.description}</p>
        {/if}
        {#if gemach.notes}
            <p class="text-sm text-gray-400 mt-3">{gemach.notes}</p>
        {/if}

        <!-- פעולות -->
        <div class="flex flex-wrap gap-2 mt-5">
            {#if gemach.phone}
                <a href="tel:{gemach.phone}"
                    class="inline-flex items-center gap-2 rounded-xl bg-green-600 hover:bg-green-500 px-4 py-2.5 font-bold text-white transition-colors">
                    📞 התקשר
                </a>
                <a href="https://wa.me/{waPhone}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-2.5 font-bold text-white transition-colors">
                    💬 וואטסאפ
                </a>
            {/if}
            {#if fullAddress}
                <a href="https://waze.com/ul?q={encodeURIComponent(fullAddress)}" target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-2.5 font-bold text-white transition-colors">
                    🧭 ניווט
                </a>
            {/if}
            {#if gemach.link}
                <a href={gemach.link} target="_blank" rel="noopener noreferrer"
                    class="inline-flex items-center gap-2 rounded-xl bg-[#1c2f5a] hover:bg-[#2a4379] px-4 py-2.5 font-bold text-white transition-colors">
                    🔗 לאתר הגמ"ח
                </a>
            {/if}
        </div>
    </header>

    <!-- גלריה -->
    {#if gallery.length > 0}
        <section class="mt-4 bg-[#16264d] border border-[#3b5794] rounded-2xl p-5">
            <h2 class="font-black text-white mb-3">תמונות</h2>
            <div class="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {#each gallery as url, i (url + i)}
                    <button type="button" onclick={() => (lightbox = url)}
                        class="aspect-square overflow-hidden rounded-xl border border-[#3b5794] bg-[#0f1c3d] transition-transform hover:scale-[1.02]">
                        <img src={url} alt="תמונה {i + 1} של {gemach.name}" loading="lazy" decoding="async"
                            class="h-full w-full object-cover" />
                    </button>
                {/each}
            </div>
        </section>
    {/if}

    <!-- פרטים -->
    <section class="mt-4 bg-[#16264d] border border-[#3b5794] rounded-2xl p-5">
        <h2 class="font-black text-white mb-3">פרטים</h2>
        <dl class="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
            {#if gemach.contact}
                <div><dt class="text-gray-400">איש קשר</dt><dd class="text-white font-bold">{gemach.contact}</dd></div>
            {/if}
            {#if gemach.phone}
                <div><dt class="text-gray-400">טלפון</dt><dd class="text-white font-bold" dir="ltr">{gemach.phone}</dd></div>
            {/if}
            {#if gemach.hours}
                <div><dt class="text-gray-400">שעות פעילות</dt><dd class="text-white font-bold">{gemach.hours}</dd></div>
            {/if}
            {#if fullAddress}
                <div><dt class="text-gray-400">כתובת</dt><dd class="text-white font-bold">{fullAddress}</dd></div>
            {/if}
        </dl>

        {#if gemach.tags.length > 0}
            <div class="flex flex-wrap gap-1.5 mt-4 pt-4 border-t border-[#3b5794]">
                {#each gemach.tags as tag (tag)}
                    <span class="text-xs bg-[#1c2f5a] text-gray-300 px-2 py-1 rounded-full">{tag}</span>
                {/each}
            </div>
        {/if}
    </section>

    <!-- גמ"חים נוספים -->
    {#if data.related.length > 0}
        <section class="mt-4">
            <h2 class="font-black text-white mb-3 px-1">גמ"חים נוספים</h2>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {#each data.related as g (g.id)}
                    <a href="/gemach/{g.id}"
                        class="flex items-start gap-3 bg-[#16264d] border border-[#3b5794] rounded-xl p-4 hover:bg-[#1e3260] hover:border-[#4c6cb0] transition-all">
                        <div class="flex-shrink-0 text-2xl"><GemachAvatar gemach={g} categories={data.categories} /></div>
                        <div class="min-w-0">
                            <h3 class="font-bold text-white text-sm leading-tight">{g.name}</h3>
                            <p class="text-xs text-gray-400 mt-0.5">📍 {g.city}</p>
                        </div>
                    </a>
                {/each}
            </div>
        </section>
    {/if}

    <div class="mt-6 text-center">
        <a href="/gemachim" class="text-sm text-gray-300 hover:text-white transition-colors">→ חזרה לכל הגמ"חים</a>
    </div>
</article>

<!-- תצוגת תמונה במסך מלא -->
{#if lightbox}
    <!-- svelte-ignore a11y_click_events_have_key_events -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4"
        role="dialog" aria-modal="true" aria-label="תצוגת תמונה" tabindex="-1" onclick={() => (lightbox = null)}>
        <img src={lightbox} alt="" class="max-h-full max-w-full rounded-xl object-contain" />
        <button type="button" onclick={() => (lightbox = null)}
            class="absolute top-4 left-4 rounded-full bg-white/10 hover:bg-white/20 px-4 py-2 font-bold text-white transition-colors">
            ✕ סגור
        </button>
    </div>
{/if}
