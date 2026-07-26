<script lang="ts">
    // דף נחיתה של פרסומת מאושרת — פורט מקבוצות רכישה (במקור מ"קהילה בשכונה").
    let { data } = $props();
    let ad = $derived(data.ad);
    let lp = $derived(data.ad.landing ?? {});

    // מספר מקומי (050...) הופך לפורמט בינלאומי שוואטסאפ מקבל (972...)
    function waNumber(phone: string): string {
        const digits = String(phone ?? '').replace(/\D/g, '');
        return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
    }
</script>

<svelte:head>
    <title>{ad.title} | הגמ"ח הארצי</title>
    {#if lp.pitch}
        <meta name="description" content={lp.pitch} />
    {/if}
</svelte:head>

<div class="ad-landing" dir="rtl">
    <!-- Hero -->
    <header class="al-hero" style:background={ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}>
        {#if ad.logo}
            <img src={ad.logo} alt="לוגו {ad.title}" class="al-logo" />
        {/if}
        <h1>{lp.headline || ad.title}</h1>
        {#if lp.pitch}
            <p class="al-pitch">{lp.pitch}</p>
        {/if}
        {#if lp.image || ad.mainImage}
            <img src={lp.image || ad.mainImage} alt={ad.title} class="al-main-img" />
        {/if}
    </header>

    <!-- יתרונות -->
    {#if lp.advantages?.some((a: string) => a?.trim())}
        <section class="al-section">
            <ul class="al-advantages">
                {#each lp.advantages as adv}
                    {#if adv?.trim()}
                        <li>
                            <span class="al-check" style:background={ad.gradient} aria-hidden="true">✓</span>
                            <span>{adv}</span>
                        </li>
                    {/if}
                {/each}
            </ul>
        </section>
    {/if}

    <!-- הסיפור שלנו -->
    {#if lp.extended}
        <section class="al-section">
            <h2>הסיפור שלנו</h2>
            <p class="pre-line">{lp.extended}</p>
        </section>
    {/if}

    <!-- מוצרים -->
    {#if lp.products?.length}
        <section class="al-section">
            <h2>מוצרים / שירותים</h2>
            <div class="al-products">
                {#each lp.products as p}
                    <div class="al-product">
                        {#if p.image}
                            <img src={p.image} alt={p.name} />
                        {/if}
                        <div class="al-product-info">
                            <p class="al-product-name">{p.name}</p>
                            {#if p.description}<p class="al-product-desc">{p.description}</p>{/if}
                            {#if p.price}<p class="al-product-price">₪{p.price}</p>{/if}
                        </div>
                    </div>
                {/each}
            </div>
        </section>
    {/if}

    <!-- מה מייחד אותנו -->
    {#if lp.uniqueness}
        <section class="al-section">
            <h2>מה מייחד אותנו</h2>
            <p class="pre-line">{lp.uniqueness}</p>
        </section>
    {/if}

    <!-- פרטי קשר -->
    <section class="al-section al-contact">
        <h2>פרטי קשר</h2>
        <ul>
            {#if lp.phone}<li>📞 <a href="tel:{lp.phone}">{lp.phone}</a></li>{/if}
            {#if lp.whatsapp}<li>💬 <a href="https://wa.me/{waNumber(lp.whatsapp)}" target="_blank" rel="noopener noreferrer">וואטסאפ: {lp.whatsapp}</a></li>{/if}
            {#if lp.email}<li>✉️ <a href="mailto:{lp.email}">{lp.email}</a></li>{/if}
            {#if lp.website}<li>🌐 <a href={lp.website} target="_blank" rel="noopener noreferrer">{lp.website}</a></li>{/if}
            {#if lp.address}<li>📍 {lp.address}</li>{/if}
            {#if lp.hours}<li>🕒 {lp.hours}</li>{/if}
        </ul>
    </section>
</div>

<style>
    .ad-landing {
        max-width: 48rem;
        margin: 0 auto;
        background: #0f172a;
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
        padding: 0 0 1rem;
    }

    .al-hero {
        position: relative;
        padding: 2.5rem 1.5rem;
        text-align: center;
    }
    .al-logo {
        width: 80px;
        height: 80px;
        border-radius: 1rem;
        background: white;
        padding: 6px;
        object-fit: contain;
        margin-bottom: 1rem;
        box-shadow: 0 8px 25px rgba(0, 0, 0, 0.35);
    }
    .al-hero h1 {
        color: white;
        font-size: 2rem;
        font-weight: 900;
        margin: 0 0 0.5rem;
        text-shadow: 0 2px 10px rgba(0, 0, 0, 0.4);
    }
    .al-pitch {
        color: rgba(255, 255, 255, 0.95);
        font-size: 1.1rem;
        margin: 0 0 1.25rem;
        line-height: 1.5;
    }
    .al-main-img {
        max-width: 100%;
        max-height: 24rem;
        border-radius: 1rem;
        box-shadow: 0 15px 40px rgba(0, 0, 0, 0.4);
    }

    .al-section {
        padding: 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.05);
    }
    .al-section h2 {
        color: white;
        font-size: 1.3rem;
        font-weight: 900;
        margin: 0 0 1rem;
        text-align: center;
    }
    .al-section p {
        color: #d1d5db;
        font-size: 0.95rem;
        line-height: 1.6;
        margin: 0;
    }
    .pre-line { white-space: pre-line; }

    .al-advantages {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.75rem;
        max-width: 540px;
        margin-inline: auto;
    }
    .al-advantages li {
        display: flex;
        align-items: center;
        gap: 0.85rem;
        color: #e5e7eb;
        font-size: 1rem;
        font-weight: 600;
        line-height: 1.4;
    }
    .al-check {
        flex-shrink: 0;
        width: 34px;
        height: 34px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: 900;
        box-shadow: 0 4px 12px rgba(0, 0, 0, 0.35);
    }

    .al-products {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
        gap: 1rem;
    }
    .al-product {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 0.85rem;
        overflow: hidden;
    }
    .al-product img {
        width: 100%;
        height: 130px;
        object-fit: cover;
    }
    .al-product-info { padding: 0.75rem; }
    .al-product-name {
        color: white;
        font-weight: 700;
        margin: 0 0 0.25rem;
    }
    .al-product-desc {
        color: #9ca3af;
        font-size: 0.8rem;
        margin: 0 0 0.35rem;
        line-height: 1.4;
    }
    .al-product-price {
        color: #fbbf24;
        font-weight: 900;
        font-size: 1.05rem;
        margin: 0;
    }

    .al-contact ul {
        list-style: none;
        padding: 0;
        max-width: 380px;
        margin: 0 auto;
    }
    .al-contact li {
        padding: 0.45rem 0;
        color: #e5e7eb;
        font-size: 0.95rem;
    }
    .al-contact a {
        color: #fbbf24;
        text-decoration: none;
    }
    .al-contact a:hover { text-decoration: underline; }
</style>
