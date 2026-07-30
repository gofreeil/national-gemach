<script lang="ts">
    // ============================================================
    // Seo.svelte — כל תגי ה-SEO של דף בשורה אחת.
    // מזריק title, description, canonical, robots, Open Graph ו-Twitter Card.
    // תגי OG פר-דף מוגדרים כאן ולא ב-+layout.svelte, כדי שכל דף ישותף עם
    // הכותרת והכתובת שלו (ולא של דף הבית) וכדי שלא ייווצרו תגים כפולים.
    // ============================================================
    import {
        SITE_NAME,
        SITE_URL,
        DEFAULT_OG_IMAGE,
        OG_IMAGE_WIDTH,
        OG_IMAGE_HEIGHT,
        canonical,
    } from '$lib/seo';

    let {
        title,
        description,
        path = '/',
        image = DEFAULT_OG_IMAGE,
        type = 'website',
        keywords = '',
        noindex = false,
    }: {
        title: string;
        description: string;
        path?: string;
        image?: string;
        type?: string;
        keywords?: string;
        noindex?: boolean;
    } = $props();

    const url = $derived(canonical(path));
    const robots = $derived(
        noindex ? 'noindex, nofollow' : 'index, follow, max-image-preview:large, max-snippet:-1',
    );
    /** og:image חייב להיות כתובת מוחלטת — נתיב יחסי לא נטען ע"י פייסבוק/וואטסאפ */
    const absImage = $derived(image?.startsWith('http') ? image : SITE_URL + (image || ''));
    /** המידות נשלחות רק לתמונת ברירת המחדל — רק עליה אנחנו יודעים שהיא 1200×630.
     *  הן חוסכות לווצאפ/פייסבוק סבב הורדה ומבטיחות באנר גדול כבר בשיתוף הראשון. */
    const isDefaultImage = $derived(absImage === DEFAULT_OG_IMAGE);
</script>

<svelte:head>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={url} />
    <meta name="robots" content={robots} />
    {#if keywords}<meta name="keywords" content={keywords} />{/if}
    <meta property="og:type" content={type} />
    <meta property="og:site_name" content={SITE_NAME} />
    <meta property="og:locale" content="he_IL" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={url} />
    <meta property="og:image" content={absImage} />
    <meta property="og:image:alt" content={SITE_NAME} />
    {#if isDefaultImage}
        <meta property="og:image:type" content="image/jpeg" />
        <meta property="og:image:width" content={String(OG_IMAGE_WIDTH)} />
        <meta property="og:image:height" content={String(OG_IMAGE_HEIGHT)} />
    {/if}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content={title} />
    <meta name="twitter:description" content={description} />
    <meta name="twitter:image" content={absImage} />
</svelte:head>
