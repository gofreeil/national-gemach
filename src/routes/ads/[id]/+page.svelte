<script lang="ts">
    // דף נחיתה של פרסומת מאושרת — פורט מקבוצות רכישה (במקור מ"קהילה בשכונה").
    // עיצוב מינימליסטי: הכותרת, משפט הפתיחה והיתרונות יושבים *ליד* התמונה
    // ולא מתחתיה — כדי לחסוך גלילה. הגולש רואה את כל העיקר במסך הראשון.
    import { onMount } from 'svelte';
    import { trackAdLanding, trackAdLead } from '$lib/adTrack';

    let { data } = $props();
    let ad = $derived(data.ad);
    let lp = $derived(data.ad.landing ?? {});

    // מדידה לדשבורד המפרסם: צפייה בדף, וכל לחיצה על דרך יצירת קשר = פנייה.
    // נמדד בצד הלקוח כי התגובה של הדף נשמרת ב-cache (s-maxage) בשרת.
    onMount(() => trackAdLanding(ad.id));

    // לוגו שנחתך לעיגול בבילדר נשאר עגול גם כאן — ריבוע היה מחזיר לו
    // פינות לבנות שהמפרסם דווקא הסיר
    let logoCircle = $derived(ad.adStyle?.logoShape === 'circle');
    let heroImage = $derived(lp.image || ad.mainImage || '');
    let advList = $derived((lp.advantages ?? []).filter((a: string) => a?.trim()));

    // "אם נכנס בצורה סמטרית" — היתרונות (הקומה השלישית) נכנסים לטור שליד
    // התמונה רק כשמשפט הפתיחה קצר; אחרת הטור היה גבוה מהתמונה ונשבר האיזון,
    // ואז הם יורדים לשורה אחת רחבה מתחת (עדיין בלי גלילה מיותרת).
    // נמדד לפי האורך *המוצג* — כתובות ארוכות מתכווצות לגלולה עם שם האתר.
    let pitchLength = $derived(
        segments(lp.pitch).reduce((n: number, s: Seg) => n + s.text.length, 0)
    );
    let advInHero = $derived(Boolean(heroImage) && advList.length > 0 && pitchLength <= 300);

    // כל דרך קשר מופיעה פעם אחת בלבד: ההדר מציג טלפון + וואטסאפ (או אתר
    // כשאין וואטסאפ), ולכן האתר נשאר לפרטי הקשר רק כשהוואטסאפ תפס את מקומו.
    let websiteInContact = $derived(Boolean(lp.website) && Boolean(lp.whatsapp));

    // מספר מקומי (050...) הופך לפורמט בינלאומי שוואטסאפ מקבל (972...)
    function waNumber(phone: string): string {
        const digits = String(phone ?? '').replace(/\D/g, '');
        return digits.startsWith('0') ? `972${digits.slice(1)}` : digits;
    }

    // כתובות שהמפרסם הדביק בתוך הטקסט הופכות לגלולת קישור קצרה (שם האתר)
    // במקום שורות ארוכות של URL שמנפחות את הדף.
    type Seg = { text: string; url: string };
    function segments(raw: string | null | undefined): Seg[] {
        const text = String(raw ?? '');
        const out: Seg[] = [];
        let last = 0;
        for (const m of text.matchAll(/https?:\/\/\S+/g)) {
            const start = m.index ?? 0;
            const url = m[0].replace(/[.,;:!?)\]]+$/, '');
            if (start > last) out.push({ text: text.slice(last, start), url: '' });
            out.push({ text: linkLabel(url), url });
            last = start + url.length;
        }
        if (last < text.length) out.push({ text: text.slice(last), url: '' });
        return out;
    }
    function linkLabel(url: string): string {
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return url;
        }
    }
</script>

<svelte:head>
    <title>{ad.title} | הגמ"ח הארצי</title>
    {#if lp.pitch}
        <meta name="description" content={lp.pitch} />
    {/if}
</svelte:head>

{#snippet rich(raw: string)}{#each segments(raw) as s}{#if s.url}<a class="al-link" href={s.url} target="_blank" rel="noopener noreferrer">{s.text} ↗</a>{:else}{s.text}{/if}{/each}{/snippet}

<div class="ad-landing" dir="rtl">
    <!-- קומה 1+2+3 — הכל במסך הראשון, ליד התמונה -->
    <header class="al-hero" style:background={ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}>
        <div class="al-hero-inner" class:has-media={!!heroImage}>
            <div class="al-copy">
                {#if ad.logo}
                    <img src={ad.logo} alt="לוגו {ad.title}" class="al-logo" class:is-circle={logoCircle} />
                {/if}
                <h1>{lp.headline || ad.title}</h1>
                {#if lp.pitch}
                    <p class="al-pitch">{@render rich(lp.pitch)}</p>
                {/if}

                {#if advInHero}
                    <ul class="al-advantages on-hero">
                        {#each advList as adv}
                            <li><span class="al-check" aria-hidden="true">✓</span><span>{adv}</span></li>
                        {/each}
                    </ul>
                {/if}

                {#if lp.phone || lp.whatsapp || lp.website}
                    <div class="al-actions">
                        {#if lp.phone}
                            <a href="tel:{lp.phone}" onclick={() => trackAdLead(ad.id)} class="al-btn light">📞 {lp.phone}</a>
                        {/if}
                        {#if lp.whatsapp}
                            <a href="https://wa.me/{waNumber(lp.whatsapp)}" onclick={() => trackAdLead(ad.id)} target="_blank" rel="noopener noreferrer" class="al-btn wa">וואטסאפ</a>
                        {:else if lp.website}
                            <a href={lp.website} onclick={() => trackAdLead(ad.id)} target="_blank" rel="noopener noreferrer" class="al-btn ghost">לאתר ←</a>
                        {/if}
                    </div>
                {/if}
            </div>

            {#if heroImage}
                <div class="al-media">
                    <img src={heroImage} alt={ad.title} />
                </div>
            {/if}
        </div>
    </header>

    <!-- יתרונות — רק אם לא נכנסו ליד התמונה; שורה אחת רחבה, לא רשימה גבוהה -->
    {#if advList.length && !advInHero}
        <section class="al-section">
            <ul class="al-advantages strip">
                {#each advList as adv}
                    <li>
                        <span class="al-check tinted" style:background={ad.gradient} aria-hidden="true">✓</span>
                        <span>{adv}</span>
                    </li>
                {/each}
            </ul>
        </section>
    {/if}

    <!-- הסיפור + הייחוד זה לצד זה, במקום שתי קומות נפרדות -->
    {#if lp.extended || lp.uniqueness}
        <section class="al-section al-about">
            {#if lp.extended}
                <article>
                    <h2>הסיפור שלנו</h2>
                    <p class="pre-line">{@render rich(lp.extended)}</p>
                </article>
            {/if}
            {#if lp.uniqueness}
                <article>
                    <h2>מה מייחד אותנו</h2>
                    <p class="pre-line">{@render rich(lp.uniqueness)}</p>
                </article>
            {/if}
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

    <!-- פרטי קשר — רק מה שלא כבר מופיע ככפתור בהדר, כדי לא לחזור פעמיים.
         הטלפון והוואטסאפ תמיד למעלה; האתר יורד לכאן רק כשהוואטסאפ תפס
         את מקומו בהדר. -->
    {#if lp.email || websiteInContact || lp.address || lp.hours}
        <section class="al-section al-contact">
            {#if lp.email || websiteInContact}
                <div class="al-pills">
                    {#if lp.email}<a class="al-pill" href="mailto:{lp.email}" onclick={() => trackAdLead(ad.id)}>✉️ {lp.email}</a>{/if}
                    {#if websiteInContact && lp.website}<a class="al-pill" href={lp.website} onclick={() => trackAdLead(ad.id)} target="_blank" rel="noopener noreferrer">🌐 {linkLabel(lp.website)}</a>{/if}
                </div>
            {/if}
            {#if lp.address || lp.hours}
                <p class="al-meta">
                    {#if lp.address}📍 {lp.address}{/if}{#if lp.address && lp.hours} · {/if}{#if lp.hours}🕒 {lp.hours}{/if}
                </p>
            {/if}
        </section>
    {/if}
</div>

<style>
    .ad-landing {
        max-width: 64rem;
        margin: 0 auto;
        background: #0f172a;
        border-radius: 1rem;
        border: 1px solid rgba(255, 255, 255, 0.08);
        overflow: hidden;
    }

    /* ===== קומה 1+2+3 זה לצד זה ===== */
    .al-hero { padding: 1.75rem 1.5rem; }
    .al-hero-inner {
        display: grid;
        gap: 1.5rem;
        align-items: center;
        text-align: center;
    }
    @media (min-width: 860px) {
        .al-hero { padding: 2.25rem 2rem; }
        .al-hero-inner.has-media {
            grid-template-columns: minmax(0, 1fr) minmax(0, 22rem);
            text-align: right;
        }
    }
    .al-copy { min-width: 0; }
    .al-logo {
        width: 68px;
        height: 68px;
        border-radius: 0.9rem;
        background: white;
        padding: 6px;
        object-fit: contain;
        margin-bottom: 0.75rem;
        box-shadow: 0 6px 18px rgba(0, 0, 0, 0.3);
    }
    /* חתך עגול שהמפרסם בחר בבילדר — גובר על הפינות המעוגלות */
    .al-logo.is-circle { border-radius: 50%; }
    @media (min-width: 860px) {
        .al-logo { width: 88px; height: 88px; border-radius: 1.1rem; padding: 7px; }
        .al-logo.is-circle { border-radius: 50%; }
    }
    .al-hero h1 {
        color: white;
        font-size: 1.7rem;
        font-weight: 900;
        line-height: 1.25;
        margin: 0 0 0.6rem;
    }
    @media (min-width: 860px) {
        .al-hero h1 { font-size: 2rem; }
    }
    .al-pitch {
        color: rgba(255, 255, 255, 0.95);
        font-size: 1rem;
        line-height: 1.55;
        margin: 0;
        overflow-wrap: anywhere;
        white-space: pre-line;
    }
    .al-link {
        display: inline-block;
        padding: 0.05rem 0.5rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.18);
        color: #fff;
        font-size: 0.85rem;
        font-weight: 700;
        text-decoration: none;
        white-space: nowrap;
    }
    .al-link:hover { background: rgba(255, 255, 255, 0.3); }

    .al-media { min-width: 0; }
    .al-media img {
        display: block;
        width: auto;
        max-width: 100%;
        max-height: 17rem;
        margin-inline: auto;
        border-radius: 0.9rem;
        box-shadow: 0 12px 30px rgba(0, 0, 0, 0.35);
    }
    /* בדסקטופ התמונה גדלה עד לגובה של טור הטקסט שלידה — פרופורציה מאוזנת */
    @media (min-width: 860px) {
        .al-media img { max-height: 27rem; border-radius: 1.1rem; }
    }

    .al-actions {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
        margin-top: 1rem;
    }
    @media (min-width: 860px) {
        .has-media .al-actions { justify-content: flex-start; }
    }
    .al-btn {
        display: inline-flex;
        align-items: center;
        padding: 0.55rem 1.1rem;
        border-radius: 999px;
        font-weight: 800;
        font-size: 0.95rem;
        text-decoration: none;
    }
    .al-btn.light { background: #fff; color: #111827; }
    .al-btn.wa { background: #16a34a; color: #fff; }
    .al-btn.ghost {
        background: rgba(255, 255, 255, 0.15);
        color: #fff;
        border: 1px solid rgba(255, 255, 255, 0.35);
    }

    /* ===== יתרונות ===== */
    .al-advantages {
        list-style: none;
        padding: 0;
        margin: 0;
        display: grid;
        gap: 0.5rem;
        text-align: right;
    }
    .al-advantages li {
        display: flex;
        align-items: center;
        gap: 0.6rem;
        font-size: 0.95rem;
        font-weight: 600;
        line-height: 1.35;
    }
    .al-advantages.on-hero {
        margin-top: 1rem;
        color: rgba(255, 255, 255, 0.95);
    }
    .al-advantages.strip {
        color: #e5e7eb;
        grid-template-columns: repeat(auto-fit, minmax(15rem, 1fr));
        gap: 0.6rem 1.25rem;
    }
    .al-check {
        flex-shrink: 0;
        width: 22px;
        height: 22px;
        border-radius: 999px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: rgba(255, 255, 255, 0.92);
        color: #111827;
        font-size: 0.75rem;
        font-weight: 900;
        line-height: 1;
    }
    .al-check.tinted { color: #fff; }

    /* ===== שאר הדף — צפוף ומינימלי ===== */
    .al-section {
        padding: 1.25rem 1.5rem;
        border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    .al-section h2 {
        color: white;
        font-size: 1.05rem;
        font-weight: 900;
        margin: 0 0 0.5rem;
    }
    .al-section p {
        color: #d1d5db;
        font-size: 0.925rem;
        line-height: 1.6;
        margin: 0;
        overflow-wrap: anywhere;
    }
    .pre-line { white-space: pre-line; }

    .al-about {
        display: grid;
        gap: 1.25rem;
    }
    @media (min-width: 860px) {
        .al-about { grid-template-columns: repeat(auto-fit, minmax(18rem, 1fr)); gap: 2rem; }
    }

    .al-products {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
        gap: 0.75rem;
    }
    .al-product {
        background: rgba(255, 255, 255, 0.04);
        border: 1px solid rgba(255, 255, 255, 0.07);
        border-radius: 0.75rem;
        overflow: hidden;
    }
    .al-product img {
        width: 100%;
        height: 110px;
        object-fit: cover;
    }
    .al-product-info { padding: 0.6rem 0.7rem; }
    .al-product-name {
        color: white;
        font-weight: 700;
        font-size: 0.9rem;
        margin: 0 0 0.2rem;
    }
    .al-product-desc {
        color: #9ca3af;
        font-size: 0.78rem;
        margin: 0 0 0.25rem;
        line-height: 1.4;
    }
    .al-product-price {
        color: #fbbf24;
        font-weight: 900;
        font-size: 1rem;
        margin: 0;
    }

    .al-contact { text-align: center; }
    .al-pills {
        display: flex;
        flex-wrap: wrap;
        gap: 0.5rem;
        justify-content: center;
    }
    .al-pill {
        display: inline-flex;
        align-items: center;
        gap: 0.35rem;
        padding: 0.45rem 0.9rem;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.06);
        border: 1px solid rgba(255, 255, 255, 0.12);
        color: #e5e7eb;
        font-size: 0.875rem;
        font-weight: 700;
        text-decoration: none;
    }
    .al-pill:hover {
        background: rgba(251, 191, 36, 0.12);
        border-color: rgba(251, 191, 36, 0.45);
        color: #fde68a;
    }
    .al-meta {
        color: #9ca3af;
        font-size: 0.825rem;
        margin: 0.75rem 0 0;
    }
</style>
