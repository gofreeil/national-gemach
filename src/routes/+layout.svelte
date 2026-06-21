<script lang="ts">
    import '../app.css';
    import 'flag-icons/css/flag-icons.min.css';
    import '$lib/i18n';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import AdsSidebar from '$lib/components/AdsSidebar.svelte';
    import RightAdBanner from '$lib/components/RightAdBanner.svelte';
    import MobileAdsBanner from '$lib/components/MobileAdsBanner.svelte';

    let { children } = $props();
</script>

<svelte:head>
    <title>הגמ"ח הארצי – כל הגמחים בארץ בכף ידך</title>
    <meta name="description" content="מאגר הגמחים הארצי – חפש גמחים לפי שם, עניין או עיר בכל רחבי הארץ" />

    <link rel="icon" href="/images/logo.png" type="image/png" />
    <link rel="shortcut icon" href="/images/logo.png" type="image/png" />
    <link rel="apple-touch-icon" href="/images/logo.png" />

    <meta property="og:type" content="website" />
    <meta property="og:site_name" content="הגמ&quot;ח הארצי" />
    <meta property="og:title" content="הגמ&quot;ח הארצי – כל הגמחים בארץ בכף ידך" />
    <meta property="og:description" content="מאגר הגמחים הארצי – חפש גמחים לפי שם, עניין או עיר בכל רחבי הארץ" />
    <meta property="og:image" content="https://gemach.gofreeil.com/images/logo.png" />
    <meta property="og:image:secure_url" content="https://gemach.gofreeil.com/images/logo.png" />
    <meta property="og:image:type" content="image/png" />
    <meta property="og:image:width" content="1254" />
    <meta property="og:image:height" content="1254" />
    <meta property="og:image:alt" content="הגמ&quot;ח הארצי – לוגו" />
    <meta property="og:url" content="https://gemach.gofreeil.com/" />
    <meta property="og:locale" content="he_IL" />

    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="הגמ&quot;ח הארצי – כל הגמחים בארץ בכף ידך" />
    <meta name="twitter:description" content="מאגר הגמחים הארצי – חפש גמחים לפי שם, עניין או עיר בכל רחבי הארץ" />
    <meta name="twitter:image" content="https://gemach.gofreeil.com/images/logo.png" />

    <meta name="theme-color" content="#0f172a" />
</svelte:head>

<a href="#main-content" class="skip-link">דלג לתוכן הראשי</a>
<MobileAdsBanner />

<div class="min-h-screen flex flex-col bg-[#0f172a]">
    <Header />

    <div class="layout-container flex-grow">
        <RightAdBanner />
        <main id="main-content" tabindex="-1" class="main-content">
            {@render children()}
        </main>
        <AdsSidebar />
    </div>

    <Footer />
</div>

<style>
    .layout-container {
        max-width: 1440px;
        margin: 0 auto;
        display: flex;
        gap: 1.5rem;
        padding: 1.5rem 1.5rem 0 1.5rem;
        width: 100%;
    }

    .main-content {
        flex: 1;
        min-width: 0;
    }
</style>
