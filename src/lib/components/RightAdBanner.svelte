<script lang="ts">
    import { onMount } from "svelte";
    import { adSlots, loadApprovedAds } from "$lib/adSlots";
    import { markAdSeen, trackAdClick } from "$lib/adTrack";
    import { adImgFit, parseAdImageFit } from "$lib/adImageFit";
    import {
        parseAdStyle, legacyAdStyle, adStyleVars, logoAnchorClass, logoFreeStyle, logoCornerSide,
        type AdStyle,
    } from "$lib/adStyle";
    import type { ApprovedAd } from "$lib/adSlots";

    // העיצוב שהמפרסם קבע בבילדר הוא מה שמוצג כאן — אותו מודול משותף
    // (adStyle.ts) מנרמל אותו בשני הצדדים. מודעה שנשלחה לפני שהעיצוב
    // נשמר מקבלת את הכלל הישן (כותרת ארוכה ← לוגו מעל רצועת ה-CTA),
    // כדי שמודעות שכבר רצות על האתר לא ישנו את מראן.
    function styleOf(ad: ApprovedAd): AdStyle {
        return parseAdStyle(ad.adStyle) ?? legacyAdStyle(ad.title);
    }

    const PER_VIEW = 4;      // כמה משבצות נראות בטור בו-זמנית
    const VIEW_MS = 14000;   // כמה זמן כל קבוצה נשארת על המסך (החלפה איטית)
    const FADE_MS = 900;     // אורך הדעיכה בין קבוצה לקבוצה

    let rotation = $state(0);
    let fading = $state(false);

    let slots = $derived($adSlots);

    // כל המשבצות משתתפות בסבב — גם מודעה בתשלום מתחלפת כמו השאר,
    // והסבב אינסופי (בלי תקרת החלפות שהייתה עוצרת אותו על קבוצה אחת).
    let displayedAds = $derived.by(() => {
        if (slots.length <= PER_VIEW) return slots;
        const start = (rotation * PER_VIEW) % slots.length;
        return Array.from(
            { length: PER_VIEW },
            (_, i) => slots[(start + i) % slots.length],
        );
    });

    // כל מודעה שנכנסת לקבוצה המוצגת נספרת כחשיפה (פעם אחת לכל ביקור)
    $effect(() => {
        for (const item of displayedAds) {
            if (item.kind === 'real') markAdSeen(item.ad.id);
        }
    });

    onMount(() => {
        loadApprovedAds();
        let fadeTimer: ReturnType<typeof setTimeout> | undefined;
        // דעיכה החוצה → החלפת הקבוצה בזמן שהטור שקוף → דעיכה פנימה.
        // כך אין קפיצה: המשבצות לא מתחלפות מול העין אלא מתוך שקיפות מלאה.
        const interval = setInterval(() => {
            if (slots.length <= PER_VIEW) return;
            fading = true;
            fadeTimer = setTimeout(() => {
                rotation++;
                fading = false;
            }, FADE_MS);
        }, VIEW_MS);

        return () => {
            clearInterval(interval);
            clearTimeout(fadeTimer);
        };
    });
</script>

<!-- RightAdBanner.svelte -->
<aside
    aria-label="פרסומות"
    class="hidden xl:block w-36 flex-shrink-0 sticky top-4 h-fit pb-8 text-center"
>
    <h4
        class="text-xs font-bold text-amber-400 uppercase tracking-widest mb-2 px-2"
    >
        תוכן שיווקי
    </h4>
    <div class="space-y-3 ads-track" class:fading>
        {#each displayedAds as item}
            {#if item.kind === 'real'}
                {@const st = styleOf(item.ad)}
                {@const cornerSide = logoCornerSide(st, Boolean(item.ad.logo))}
                <!-- מודעה אמיתית מהבילדר — קליק מוביל לדף הנחיתה המקומי -->
                <a
                    href="/ads/{item.ad.id}"
                    onclick={() => trackAdClick(item.ad.id)}
                    class="h-[490px] flex flex-col rounded-2xl overflow-hidden shadow-lg transition-transform hover:scale-105 group relative"
                    style={adStyleVars(st)}
                >
                    <div class="flex-1 relative overflow-hidden bg-black/30">
                        {#if item.ad.mainImage}
                            <!-- בריחוף העכבר התמונה נמוגה ומפנה מקום לתוכן שהמפרסם כתב -->
                            <!-- המיקום/זום שנבחרו בבילדר מוחלים גם כאן — הדמו הוא מה שרואים -->
                            <img
                                src={item.ad.mainImage}
                                alt={item.ad.title}
                                loading="lazy"
                                decoding="async"
                                class="absolute inset-0 w-full h-full object-cover transition-opacity duration-700 group-hover:opacity-0"
                                use:adImgFit={parseAdImageFit(item.ad.mainImageFit)}
                            />
                        {/if}
                        <!-- אותן שכבות בדיוק של הדמו החי בבילדר: רצועה אלכסונית
                             בגובה שהמפרסם כיוון, כותרת למעלה בצבע ובמיקום שבחר,
                             סלוגן מעל הרצועה, ולוגו בצורה ובמקום שקבע (כולל
                             גרירה חופשית). קודם כל אלה נבנו כאן מחדש מברירות
                             המחדל של האתר, והמודעה שהתפרסמה נראתה אחרת. -->
                        <div class="promo-diag transition-opacity duration-700 group-hover:opacity-0"
                             style="background: {item.ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"></div>
                        <div class="promo-title-top transition-opacity duration-700 group-hover:opacity-0"
                             class:has-corner-logo-right={cornerSide === 'right'}
                             class:has-corner-logo-left={cornerSide === 'left'}
                             style="transform: translateY({st.titleOffsetY}px);">
                            <h3 class="promo-title" style="color: {st.titleColor};">{item.ad.title}</h3>
                        </div>
                        {#if item.ad.subtitle}
                            <div class="promo-sub-wrap transition-opacity duration-700 group-hover:opacity-0">
                                <p class="promo-sub">{item.ad.subtitle}</p>
                            </div>
                        {/if}
                        {#if item.ad.logo}
                            <img
                                src={item.ad.logo}
                                alt=""
                                loading="lazy"
                                decoding="async"
                                class="promo-logo {logoAnchorClass(st, 'promo')} {st.logoShape === 'circle' ? 'promo-logo-circle' : ''}
                                       transition-opacity duration-700 group-hover:opacity-0"
                                style={logoFreeStyle(st)}
                            />
                        {/if}

                        <!-- שכבת הריחוף: "טקסט הריחוף" מהבילדר — התוכן הנוסף
                             שנועד למכור, בדיוק כמו בכרטיס של קהילה בשכונה -->
                        <div
                            class="absolute inset-0 flex items-center justify-center bg-black/70 backdrop-blur-sm p-3 text-center opacity-0 transition-opacity duration-700 group-hover:opacity-100"
                        >
                            <div>
                                <h3 class="text-white font-black text-sm leading-tight mb-1">{item.ad.title}</h3>
                                {#if item.ad.subtitle}
                                    <p class="text-gray-200 text-[11px] leading-tight">{item.ad.subtitle}</p>
                                {/if}
                                {#if item.ad.hover}
                                    <p class="mt-2 pt-2 border-t border-white/20 text-amber-200 text-[11px] font-bold leading-snug">
                                        {item.ad.hover}
                                    </p>
                                {/if}
                            </div>
                        </div>
                    </div>
                    <div
                        class="p-2.5 text-center"
                        style="background: {item.ad.gradient || 'linear-gradient(135deg, #f59e0b, #ea580c)'}"
                    >
                        <p class="text-white font-bold text-xs leading-tight">{item.ad.cta || 'לפרטים'}</p>
                    </div>
                </a>
            {:else if item.kind === 'pending'}
                <!-- שלד בזמן הטעינה הראשונה — ניטרלי, בלי "מקום פרסום זה"
                     ובלי מספור, כדי שהטור לא ייראה פנוי לרגע ואז יקפוץ -->
                <div
                    class="h-[490px] rounded-2xl border border-white/10 bg-white/5 animate-pulse"
                    aria-hidden="true"
                ></div>
            {:else}
                {@const ad = item.slot}
                <!-- משבצת פנויה — כל הבאנר הוא קישור לדף הפרסום, לא רק כפתור "לפרטים" -->
                <a
                    href={ad.href}
                    aria-label="{ad.text} — {ad.description}: לדף הפרסום"
                    class="h-[490px] flex flex-col items-center justify-center rounded-2xl border-2 border-dashed {ad.borderColor} {ad.bgColor} p-3 text-center transition-all {ad.hoverBorder} {ad.hoverBg} group duration-700 relative overflow-hidden"
                >
                    <!-- Ad Numbering -->
                    <div
                        class="absolute top-3 right-3 text-sm font-black text-white/60 bg-white/10 px-3 py-1 rounded-full border border-white/5 backdrop-blur-sm shadow-sm"
                    >
                        {item.no}
                    </div>

                    <div
                        class="flex flex-col items-center justify-between h-full py-6 relative overflow-hidden w-full"
                    >
                        <div
                            class="text-3xl mt-4 z-10 transition-transform group-hover:scale-125 duration-300"
                        >
                            📢
                        </div>

                        <div
                            class="absolute inset-0 flex items-center justify-center pointer-events-none"
                        >
                            <div
                                class="-rotate-90 flex items-center gap-3 whitespace-nowrap transform origin-center"
                            >
                                <span
                                    class="text-2xl font-black {ad.textColor} {ad.hoverText} tracking-wider drop-shadow-sm"
                                >
                                    {ad.text}
                                </span>
                                <span
                                    class="text-base font-bold {ad.textColor} {ad.hoverText} opacity-90 drop-shadow-sm"
                                >
                                    - {ad.description}
                                </span>
                            </div>
                        </div>

                        <span
                            class="mb-4 z-10 rounded-full {ad.buttonColor} px-5 py-2 text-sm font-bold text-white shadow-xl transition-transform group-hover:scale-105"
                        >
                            לפרטים
                        </span>
                    </div>
                </a>
            {/if}
        {/each}
    </div>
</aside>

<style>
    /* דעיכה רכה בין קבוצות המודעות — במקום החלקה קופצנית של כל כרטיס.
       הערך חייב להתאים ל-FADE_MS שבסקריפט. */
    .ads-track {
        opacity: 1;
        transition: opacity 900ms ease-in-out;
    }
    .ads-track.fading {
        opacity: 0;
    }
    @media (prefers-reduced-motion: reduce) {
        .ads-track {
            transition-duration: 1ms;
        }
    }

    /* ============================================================
       שכבות המודעה — העתק מדויק של הדמו החי בבילדר
       (advertise/builder: .pro-diag / .pro-title-top / .pro-sub / .ad-logo).
       המשתנים --diag-top-* מגיעים מהעיצוב ששמור עם המודעה עצמה, ולכן
       לכל מודעה גובה רצועה משלה - בדיוק כפי שהמפרסם כיוון.
       ============================================================ */
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
    /* לוגו בפינה העליונה יושב באותו גובה של הכותרת. בלי שמירת המקום הזאת
       הוא מכסה לה את המילה האחרונה - המשבצת צרה. ריפוד פיזי ולא לוגי:
       הדף כולו RTL, והקצה הלוגי הפוך לצד שבו הלוגו באמת נמצא. */
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
    /* השורה הראשונה של הסלוגן מתקצרת בעקבות האלכסון */
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
    /* עוגן "מעל ה-CTA": הלוגו רוכב על הפינה הימנית של הרצועה האלכסונית,
       מרכזו על --diag-top-right (18px = חצי מגובה הלוגו) */
    .promo-logo-cta {
        top: auto;
        bottom: calc(100% - var(--diag-top-right, 78%) - 18px);
        right: 6px;
        left: auto;
    }
    /* מיקום חופשי שהמפרסם גרר - הקואורדינטות מגיעות ב-style inline */
    .promo-logo-free { top: 0; left: 0; }
</style>
