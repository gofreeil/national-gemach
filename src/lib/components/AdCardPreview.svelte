<script lang="ts">
    // ============================================================
    // AdCardPreview — עותק סטטי של כרטיס הפרסומת מהטור הימני באתר
    // (RightAdBanner), בלי קישור, בלי סבב ובלי דהיית-ריחוף. משמש את
    // מסך הניהול לתצוגה מקדימה: ריחוף על כותרת בטבלת התזמון (דסקטופ)
    // או הקשה עליה (נייד). אותן שכבות ואותם משתני עיצוב מהבילדר —
    // מה שרואים כאן הוא בדיוק מה שמוצג על האתר.
    // ============================================================
    import { adImgFit, parseAdImageFit } from '$lib/adImageFit';
    import {
        parseAdStyle, legacyAdStyle, adStyleVars, logoAnchorClass, logoFreeStyle, logoCornerSide,
    } from '$lib/adStyle';

    interface PreviewAd {
        title: string;
        subtitle?: string;
        cta?: string;
        gradient?: string;
        logo?: string;
        mainImage?: string;
        mainImageFit?: unknown;
        adStyle?: unknown;
    }

    let { ad }: { ad: PreviewAd } = $props();

    let st = $derived(parseAdStyle(ad.adStyle) ?? legacyAdStyle(ad.title));
    let cornerSide = $derived(logoCornerSide(st, Boolean(ad.logo)));
</script>

<div class="h-[490px] w-36 flex flex-col rounded-2xl overflow-hidden shadow-lg relative bg-gray-900"
     style={adStyleVars(st)}>
    <div class="flex-1 relative overflow-hidden bg-black/30">
        {#if ad.mainImage}
            <img src={ad.mainImage} alt={ad.title}
                 loading="lazy" decoding="async"
                 class="absolute inset-0 w-full h-full object-cover"
                 use:adImgFit={parseAdImageFit(ad.mainImageFit)} />
        {/if}
        <div class="promo-diag"
             style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"></div>
        <div class="promo-title-top"
             class:has-corner-logo-right={cornerSide === 'right'}
             class:has-corner-logo-left={cornerSide === 'left'}
             style="transform: translateY({st.titleOffsetY}px);">
            <h3 class="promo-title" style="color: {st.titleColor};">{ad.title}</h3>
        </div>
        {#if ad.subtitle}
            <div class="promo-sub-wrap">
                <p class="promo-sub">{ad.subtitle}</p>
            </div>
        {/if}
        {#if ad.logo}
            <img src={ad.logo} alt="" loading="lazy" decoding="async"
                 class="promo-logo {logoAnchorClass(st, 'promo')} {st.logoShape === 'circle' ? 'promo-logo-circle' : ''}"
                 style={logoFreeStyle(st)} />
        {/if}
    </div>
    <div class="p-2.5 text-center"
         style="background: {ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}">
        <p class="text-white font-bold text-xs leading-tight">{ad.cta || 'לפרטים'}</p>
    </div>
</div>

<style>
    /* עותק מדויק של שכבות הכרטיס ב-RightAdBanner — כדי שהתצוגה
       המקדימה תהיה זהה למה שבאמת מוצג בטור הפרסומות */
    .promo-diag {
        position: absolute;
        inset: 0;
        clip-path: polygon(
            0 var(--diag-top-left, 88%),
            100% var(--diag-top-right, 78%),
            100% 100%,
            0 100%
        );
        opacity: 0.96;
        pointer-events: none;
        z-index: 3;
    }
    .promo-diag::after {
        content: "";
        position: absolute;
        inset: 0;
        background: linear-gradient(125deg, transparent 30%, rgba(255, 255, 255, 0.18) 45%, transparent 60%);
        pointer-events: none;
    }
    .promo-title-top {
        position: absolute;
        left: 0;
        right: 0;
        top: 0;
        padding: 0.55rem 0.7rem 0.85rem;
        z-index: 4;
        text-align: center;
        background: linear-gradient(180deg, rgba(0, 0, 0, 0.78) 0%, rgba(0, 0, 0, 0.45) 55%, rgba(0, 0, 0, 0) 100%);
        pointer-events: none;
    }
    .promo-title-top.has-corner-logo-right { padding-right: 46px; }
    .promo-title-top.has-corner-logo-left  { padding-left: 46px; }
    .promo-title {
        color: white;
        font-weight: 900;
        font-size: 0.95rem;
        line-height: 1.15;
        margin: 0;
        text-shadow: 0 2px 8px rgba(0, 0, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.9);
    }
    .promo-sub-wrap {
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        padding: 0.55rem 0.7rem 1.1rem;
        z-index: 4;
        text-align: right;
        pointer-events: none;
    }
    .promo-sub {
        color: rgba(255, 255, 255, 0.95);
        font-weight: 600;
        font-size: 0.7rem;
        line-height: 1.3;
        margin: 0;
        text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
    }
    .promo-sub::before {
        content: "";
        float: left;
        width: 28%;
        height: 1.35em;
        shape-outside: polygon(0 0, 100% 0, 0 100%);
    }
    .promo-logo {
        position: absolute;
        width: 36px;
        height: 36px;
        border-radius: 6px;
        background: white;
        padding: 3px;
        object-fit: contain;
        z-index: 5;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
    }
    .promo-logo-circle { border-radius: 50%; }
    .promo-logo-right { top: 6px; right: 6px; left: auto; }
    .promo-logo-left  { top: 6px; left: 6px; right: auto; }
    .promo-logo-cta {
        top: auto;
        bottom: calc(100% - var(--diag-top-right, 78%) - 18px);
        right: 6px;
        left: auto;
    }
    .promo-logo-free { top: 0; left: 0; }
</style>
