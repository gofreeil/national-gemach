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
    import AdInterstitial from '$lib/components/AdInterstitial.svelte';
    import { navigating } from '$app/state';
    import { onMount } from 'svelte';

    let { children, data } = $props();

    // הטענת Google Analytics (gtag) בצד-הלקוח — רק אם הוגדר מזהה מדידה (GA_MEASUREMENT_ID).
    // עלות שרת אפסית: הסקריפט נטען מגוגל, לא מהשרת שלנו.
    onMount(() => {
        const gaId = data.gaId;
        if (!gaId || typeof document === 'undefined') return;
        if (document.getElementById('ga-gtag')) return;
        const s = document.createElement('script');
        s.id = 'ga-gtag';
        s.async = true;
        s.src = `https://www.googletagmanager.com/gtag/js?id=${gaId}`;
        document.head.appendChild(s);
        const w = window as unknown as { dataLayer?: unknown[]; gtag?: (...a: unknown[]) => void };
        w.dataLayer = w.dataLayer || [];
        w.gtag = function () { w.dataLayer!.push(arguments); };
        w.gtag('js', new Date());
        w.gtag('config', gaId);
    });
</script>

<svelte:head>
    <!-- כותרת גיבוי בלבד: כל דף ציבורי דורס אותה דרך <Seo> ($lib/components/Seo.svelte) -->
    <title>הגמ"ח הארצי – כל הגמחים בארץ בכף ידך</title>

    <!-- אייקונים בגדלים אמיתיים — הקובץ המלא (709KB) נשאר רק לסכימת ה-SEO -->
    <link rel="icon" href="/images/favicon.png" type="image/png" />
    <link rel="shortcut icon" href="/images/favicon.png" type="image/png" />
    <link rel="apple-touch-icon" href="/images/apple-touch-icon.png" />

    <!-- תגי Open Graph ו-Twitter מוגדרים פר-דף ברכיב <Seo>. תג גלובלי כאן היה
         מקדים את הפר-דפי ב-HTML, וכל שיתוף של דף גמ"ח בוואטסאפ היה מציג את שם
         האתר ואת כתובת דף הבית במקום את הגמ"ח עצמו. גם מידות התמונה יצאו מכאן:
         לדף גמ"ח יש תמונה משלו, ומידות קשיחות היו משקרות לגביה. -->

    <meta name="theme-color" content="#874b90" />
</svelte:head>

<a href="#main-content" class="skip-link">דלג לתוכן הראשי</a>

<!-- פס התקדמות בזמן ניווט: SvelteKit נשאר על הדף הקודם עד שהחדש מוכן, ובלי סימן
     כלשהו הלחיצה (למשל על "התחברות") מרגישה כאילו לא קרה כלום. הפס מופיע רק
     אחרי ~150ms, כך שניווט מיידי לא מהבהב. -->
{#if navigating.to}
	<div class="nav-progress" role="status" aria-label="טוען…"></div>
{/if}

<!-- מסך פתיחה אחרי התחברות — גלובלי, כדי שיופיע בכל יעד נחיתה.
     ב-dev מוצג גם בלי התחברות, לתצוגה מקדימה עם ?welcome=new/back -->
{#if data.user || import.meta.env.DEV}
    <WelcomeScreen userName={data.user?.name ?? ''} />
{/if}

<MobileAdsDrawer user={data.user} />

<!-- שכבת פרסומת-הביניים (5 שניות בקליק על גמ"ח / "גלה טלפון"). כבויה עד שיעלו פרסומות. -->
<AdInterstitial />

<div class="site-bg min-h-screen flex flex-col">
    <Header user={data.user} pendingCount={data.pendingCount ?? 0} />

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
    /* פס ההתקדמות של הניווט */
    .nav-progress {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        z-index: 100;
        transform-origin: right center; /* האתר RTL קבוע */
        background: linear-gradient(90deg, #4f46e5, #7c3aed, #f5d57a);
        animation: nav-progress 8s cubic-bezier(0.15, 0.85, 0.25, 1) forwards;
    }
    @keyframes nav-progress {
        0% { transform: scaleX(0); opacity: 0; }
        2% { transform: scaleX(0.06); opacity: 0; }
        4% { opacity: 1; }
        25% { transform: scaleX(0.55); }
        60% { transform: scaleX(0.82); }
        100% { transform: scaleX(0.97); opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
        .nav-progress { animation-duration: 0s; transform: scaleX(1); opacity: 1; }
    }

    /* רקע ורוד בהיר בגוונים מעורבים של לילך — כתמי צבע רכים בגדלים ומיקומים
       שונים במקום גוון אחיד. הבסיס שוטח יחסית והכתמים מרוככים כדי שהמעבר
       בין האזורים הבהירים לכהים יישאר עדין. טווח ביניים לשמירת קריאוּת הטקסט הלבן */
    .site-bg {
        background:
            /* הענן הימני-עליון היה נפרש על כל צד ימין עד למרכז; חצי רדיוס ⇒ כתם
               מרוכז בפינה במקום שטח ורוד רחב */
            radial-gradient(550px 300px at 85% -5%, rgba(251, 207, 232, 0.48), transparent 60%),
            radial-gradient(900px 650px at 8% 12%, rgba(244, 194, 231, 0.44), transparent 55%),
            radial-gradient(1000px 750px at 50% 45%, rgba(240, 182, 222, 0.35), transparent 60%),
            radial-gradient(900px 600px at 92% 70%, rgba(249, 168, 212, 0.40), transparent 55%),
            radial-gradient(850px 550px at 12% 88%, rgba(233, 172, 222, 0.38), transparent 60%),
            linear-gradient(170deg, #cb84bc 0%, #c179b3 35%, #b56ea9 68%, #a763a0 100%);
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
