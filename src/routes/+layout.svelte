<script lang="ts">
    import '../app.css';
    import 'flag-icons/css/flag-icons.min.css';
    import '$lib/i18n';
    import Header from '$lib/components/Header.svelte';
    import Footer from '$lib/components/Footer.svelte';
    import AdsSidebar from '$lib/components/AdsSidebar.svelte';
    import RightAdBanner from '$lib/components/RightAdBanner.svelte';
    import MobileAdsDrawer from '$lib/components/MobileAdsDrawer.svelte';
    import WelcomeScreen from '$lib/components/WelcomeScreen.svelte';

    let { children, data } = $props();
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

    <meta name="theme-color" content="#874b90" />
</svelte:head>

<a href="#main-content" class="skip-link">דלג לתוכן הראשי</a>

<!-- מסך פתיחה אחרי התחברות — גלובלי, כדי שיופיע בכל יעד נחיתה -->
{#if data.user}
    <WelcomeScreen userName={data.user.name ?? ''} />
{/if}

<MobileAdsDrawer user={data.user} />

<div class="site-bg min-h-screen flex flex-col">
    <Header user={data.user} adminRole={data.adminRole} />

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
    /* רקע ורוד בהיר בגוונים מעורבים של לילך — כתמי צבע רכים בגדלים ומיקומים
       שונים במקום גוון אחיד. נשאר בטווח ביניים כדי שהטקסט הלבן יישאר קריא */
    .site-bg {
        background:
            radial-gradient(1100px 600px at 85% -5%, rgba(251, 207, 232, 0.55), transparent 60%),
            radial-gradient(900px 650px at 8% 12%, rgba(244, 194, 231, 0.50), transparent 55%),
            radial-gradient(1000px 750px at 50% 45%, rgba(240, 182, 222, 0.38), transparent 60%),
            radial-gradient(900px 600px at 92% 70%, rgba(249, 168, 212, 0.45), transparent 55%),
            radial-gradient(850px 550px at 12% 88%, rgba(233, 172, 222, 0.42), transparent 60%),
            linear-gradient(170deg, #c47ab5 0%, #b268a6 35%, #a3599a 68%, #90548c 100%);
    }

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
